import "server-only"
import { Prisma } from "@prisma/client"
import {
  adminIdSchema,
  createCategorySchema,
  updateCategorySchema,
  type AdminContext,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/validators/admin-catalog"
import { db } from "@/server/db"
import { AdminCatalogError, parseAdmin, parseInput, uniqueSlug, withUniqueErrors } from "./admin-catalog.service"

/*
 * Admin: Danh mục. Cây tối đa 2 cấp (gốc → con); sản phẩm có thể nằm ở bất kỳ cấp nào.
 * Slug tự sinh từ tên không dấu, duy nhất toàn hệ thống và được GIỮ NGUYÊN khi đổi tên (không gãy URL).
 */

export interface AdminCategory {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  /** Số sản phẩm nằm trực tiếp trong danh mục này. */
  productCount: number
  /** Số dòng bảng size của danh mục. */
  sizeChartRowCount: number
  /** Chỉ danh mục gốc mới có con. */
  children: AdminCategory[]
}

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  _count: { select: { products: true, sizeCharts: true } },
} as const

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  _count: { products: number; sizeCharts: number }
}

const toCategory = (c: CategoryRow, children: AdminCategory[] = []): AdminCategory => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description,
  parentId: c.parentId,
  productCount: c._count.products,
  sizeChartRowCount: c._count.sizeCharts,
  children,
})

/** Toàn bộ cây: gốc theo thứ tự tạo, con theo tên. */
export async function listCategoriesTree(): Promise<AdminCategory[]> {
  const rows = await db.category.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: categorySelect })
  const childrenOf = new Map<string, CategoryRow[]>()
  for (const r of rows) if (r.parentId) childrenOf.set(r.parentId, [...(childrenOf.get(r.parentId) ?? []), r])
  return rows
    .filter((r) => !r.parentId)
    .map((r) =>
      toCategory(
        r,
        (childrenOf.get(r.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, "vi")).map((c) => toCategory(c))
      )
    )
}

/** Danh mục cha phải tồn tại và là danh mục gốc (cây tối đa 2 cấp). */
async function assertValidParent(tx: Pick<typeof db, "category">, parentId: string) {
  const parent = await tx.category.findUnique({ where: { id: parentId }, select: { parentId: true } })
  if (!parent) throw new AdminCatalogError("CATEGORY_NOT_FOUND", "Danh mục cha không tồn tại")
  if (parent.parentId) throw new AdminCatalogError("CATEGORY_TOO_DEEP", "Danh mục chỉ có tối đa 2 cấp: không thể tạo danh mục con của danh mục con")
}

export async function createCategory(admin: AdminContext, input: CreateCategoryInput): Promise<AdminCategory> {
  parseAdmin(admin)
  const data = parseInput(createCategorySchema, input)
  return withUniqueErrors(() =>
    db.$transaction(async (tx) => {
      if (data.parentId) await assertValidParent(tx, data.parentId)
      const slug = await uniqueSlug(data.name, async (s) => (await tx.category.findUnique({ where: { slug: s }, select: { id: true } })) !== null, "danh-muc")
      const c = await tx.category.create({
        data: { name: data.name, slug, description: data.description, parentId: data.parentId },
        select: categorySelect,
      })
      return toCategory(c)
    })
  )
}

/** Sửa tên / mô tả / danh mục cha (null = đưa lên làm danh mục gốc). Chỉ các trường có trong input được đổi. */
export async function updateCategory(admin: AdminContext, id: string, input: UpdateCategoryInput): Promise<AdminCategory> {
  parseAdmin(admin)
  const cid = parseInput(adminIdSchema, id)
  const data = parseInput(updateCategorySchema, input)
  return db.$transaction(async (tx) => {
    const current = await tx.category.findUnique({ where: { id: cid }, select: { id: true, _count: { select: { children: true } } } })
    if (!current) throw new AdminCatalogError("CATEGORY_NOT_FOUND", "Danh mục không tồn tại")
    if (data.parentId) {
      if (data.parentId === cid) throw new AdminCatalogError("CATEGORY_CYCLE", "Không thể chọn chính danh mục này làm danh mục cha")
      await assertValidParent(tx, data.parentId)
      if (current._count.children > 0)
        throw new AdminCatalogError("CATEGORY_TOO_DEEP", "Danh mục đang có danh mục con nên không thể chuyển thành danh mục con của danh mục khác")
    }
    const c = await tx.category.update({ where: { id: cid }, data, select: categorySelect })
    return toCategory(c)
  })
}

/** Chỉ xoá khi không còn danh mục con và không còn sản phẩm; bảng size của danh mục bị xoá theo. */
export async function deleteCategory(admin: AdminContext, id: string): Promise<void> {
  parseAdmin(admin)
  const cid = parseInput(adminIdSchema, id)
  try {
    await db.$transaction(async (tx) => {
      const c = await tx.category.findUnique({ where: { id: cid }, select: { name: true, _count: { select: { children: true, products: true } } } })
      if (!c) throw new AdminCatalogError("CATEGORY_NOT_FOUND", "Danh mục không tồn tại")
      if (c._count.children > 0)
        throw new AdminCatalogError("CATEGORY_HAS_CHILDREN", `Không thể xoá "${c.name}": còn ${c._count.children} danh mục con. Hãy xoá hoặc chuyển danh mục con trước.`)
      if (c._count.products > 0)
        throw new AdminCatalogError("CATEGORY_HAS_PRODUCTS", `Không thể xoá "${c.name}": còn ${c._count.products} sản phẩm. Hãy chuyển sản phẩm sang danh mục khác trước.`)
      await tx.category.delete({ where: { id: cid } })
    })
  } catch (e) {
    // Có người thêm sản phẩm/danh mục con ngay giữa lúc kiểm tra và xoá: khoá ngoại Restrict (P2003) chặn lại.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003")
      throw new AdminCatalogError("CATEGORY_HAS_PRODUCTS", "Không thể xoá: danh mục vừa có sản phẩm hoặc danh mục con mới. Hãy thử lại sau khi kiểm tra.")
    throw e
  }
}
