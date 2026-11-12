import "server-only"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { LOW_STOCK_THRESHOLD, stockStatus, type StockStatus } from "@/lib/inventory"
import { sizeRank } from "@/lib/product-variants"
import {
  adjustStockSchema,
  adminIdSchema,
  adminProductFilterSchema,
  createProductSchema,
  lowStockLimitSchema,
  resolveVariants,
  updateProductSchema,
  type AdjustStockInput,
  type AdminContext,
  type AdminProductFilterInput,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validators/admin-catalog"
import { db } from "@/server/db"
import {
  AdminCatalogError,
  notifyProductChanged,
  parseAdmin,
  parseInput,
  uniqueSlug,
  withUniqueErrors,
  type Tx,
} from "./admin-catalog.service"

/*
 * Admin: Sản phẩm & Tồn kho (màn "Quản lý Tồn kho & Sản phẩm").
 * Quyền do Server Action/route kiểm tra trước (requireAdmin); service nhận `admin` làm ngữ cảnh.
 * Sau mỗi thao tác ghi thành công gọi hook AI (syncProductEmbedding) ngoài transaction, lỗi chỉ log.
 */

/* ─────────────────────────── DTO ─────────────────────────── */

export interface AdminSizeStock {
  variantId: string
  sku: string
  size: string
  price: number
  stock: number
  status: StockStatus
}

/** Biến thể gom theo màu: danh sách size kèm tồn từng size (cột "Chi tiết" trong bảng). */
export interface AdminColorGroup {
  color: string
  colorHex: string
  totalStock: number
  sizes: AdminSizeStock[]
}

export interface AdminProductListItem {
  id: string
  name: string
  slug: string
  category: { id: string; name: string }
  image: { url: string; alt: string } | null
  basePrice: number
  priceMin: number
  priceMax: number
  isActive: boolean
  totalStock: number
  /** Trạng thái theo TỔNG tồn (stockStatus ở src/lib/inventory.ts). */
  status: StockStatus
  /** SKU của các biến thể (hiển thị ô SKU: thường dùng phần tử đầu). */
  skus: string[]
  colors: AdminColorGroup[]
}

export interface AdminProductListResult {
  items: AdminProductListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface InventorySummary {
  /** Σ tồn của mọi biến thể (kể cả sản phẩm đang ẩn). */
  totalStock: number
  /** Giá trị kho ước tính = Σ (giá biến thể × tồn), VND. */
  inventoryValue: number
  productCount: number
  /** Số sản phẩm (theo tổng tồn) ở trạng thái Sắp hết / Hết hàng. Sản phẩm không có biến thể tính là Hết hàng. */
  lowStockProducts: number
  outOfStockProducts: number
  /** Cùng khái niệm nhưng tính theo từng biến thể (màu × size). */
  lowStockVariants: number
  outOfStockVariants: number
}

export interface LowStockEntry {
  productId: string
  productName: string
  image: { url: string; alt: string } | null
  color: string
  colorHex: string
  /** Chỉ các size sắp hết / hết của màu này. */
  sizes: { variantId: string; sku: string; size: string; stock: number; status: StockStatus }[]
}

export interface AdminProductDetail {
  id: string
  name: string
  slug: string
  description: string
  brand: string
  material: string
  style: string
  occasion: string[]
  season: string[]
  gender: "MEN" | "WOMEN" | "UNISEX"
  tags: string[]
  basePrice: number
  isActive: boolean
  isFeatured: boolean
  categoryId: string
  category: { id: string; name: string }
  images: { id: string; url: string; alt: string; position: number }[]
  variants: { id: string; sku: string; size: string; color: string; colorHex: string; price: number; stock: number }[]
  totalStock: number
  status: StockStatus
  /** Đã có dòng đơn hàng tham chiếu biến thể → không xoá được, chỉ ẩn. */
  hasOrders: boolean
  createdAt: Date
  updatedAt: Date
}

export interface StockAdjustResult {
  variantId: string
  productId: string
  sku: string
  previousStock: number
  stock: number
}

/* ─────────────────────────── Danh sách ─────────────────────────── */

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

/** Mỗi từ phải khớp tên / tag (không dấu) hoặc SKU của một biến thể. */
async function searchProductIds(q: string): Promise<string[]> {
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8)
  const conds = tokens.map((t) => {
    const like = `%${escapeLike(t)}%`
    return Prisma.sql`(
      unaccent(lower(p."name" || ' ' || array_to_string(p."tags", ' '))) LIKE unaccent(lower(${like}))
      OR EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id" AND lower(v."sku") LIKE lower(${like}))
    )`
  })
  const rows = await db.$queryRaw<{ id: string }[]>`SELECT p."id" FROM "Product" p WHERE ${Prisma.join(conds, " AND ")}`
  return rows.map((r) => r.id)
}

/** Danh mục + con của nó; [] nếu không tồn tại. */
async function categoryScope(where: { id: string } | { slug: string }): Promise<string[]> {
  const c = await db.category.findUnique({ where, select: { id: true, children: { select: { id: true } } } })
  return c ? [c.id, ...c.children.map((x) => x.id)] : []
}

async function listWhere(f: ReturnType<typeof adminProductFilterSchema.parse>): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = []
  if (f.isActive !== undefined) and.push({ isActive: f.isActive })
  if (f.categoryId) and.push({ categoryId: { in: await categoryScope({ id: f.categoryId }) } })
  else if (f.categorySlug) and.push({ categoryId: { in: await categoryScope({ slug: f.categorySlug }) } })
  if (f.q) and.push({ id: { in: await searchProductIds(f.q) } })

  if (f.stockStatus) {
    // Trạng thái theo TỔNG tồn của sản phẩm → gom theo productId trong phạm vi các điều kiện trên.
    const sum: { gt?: number; lte?: number } =
      f.stockStatus === "OUT"
        ? { lte: 0 }
        : f.stockStatus === "LOW"
          ? { gt: 0, lte: LOW_STOCK_THRESHOLD }
          : { gt: LOW_STOCK_THRESHOLD }
    const groups = await db.productVariant.groupBy({
      by: ["productId"],
      where: { product: { AND: and } },
      _sum: { stock: true },
      having: { stock: { _sum: sum } },
    })
    const ids = groups.map((g) => g.productId)
    and.push(f.stockStatus === "OUT" ? { OR: [{ id: { in: ids } }, { variants: { none: {} } }] } : { id: { in: ids } })
  }
  return { AND: and }
}

const listSelect = {
  id: true,
  name: true,
  slug: true,
  basePrice: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
  variants: { select: { id: true, sku: true, size: true, color: true, colorHex: true, price: true, stock: true } },
} satisfies Prisma.ProductSelect

type ListRow = Prisma.ProductGetPayload<{ select: typeof listSelect }>

function groupByColor(variants: ListRow["variants"]): AdminColorGroup[] {
  const groups = new Map<string, AdminColorGroup>()
  const sorted = [...variants].sort((a, b) => a.color.localeCompare(b.color, "vi") || sizeRank(a.size) - sizeRank(b.size))
  for (const v of sorted) {
    let g = groups.get(v.color)
    if (!g) groups.set(v.color, (g = { color: v.color, colorHex: v.colorHex, totalStock: 0, sizes: [] }))
    g.totalStock += v.stock
    g.sizes.push({ variantId: v.id, sku: v.sku, size: v.size, price: v.price, stock: v.stock, status: stockStatus(v.stock) })
  }
  return [...groups.values()]
}

function toListItem(p: ListRow): AdminProductListItem {
  const totalStock = p.variants.reduce((s, v) => s + v.stock, 0)
  const prices = p.variants.map((v) => v.price)
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    image: p.images[0] ?? null,
    basePrice: p.basePrice,
    priceMin: prices.length ? Math.min(...prices) : p.basePrice,
    priceMax: prices.length ? Math.max(...prices) : p.basePrice,
    isActive: p.isActive,
    totalStock,
    status: stockStatus(totalStock),
    skus: [...p.variants].sort((a, b) => a.sku.localeCompare(b.sku)).map((v) => v.sku),
    colors: groupByColor(p.variants),
  }
}

/** Danh sách cho bảng Tồn kho & Sản phẩm: tìm tên/SKU/tag, lọc danh mục (gốc gồm cả con), trạng thái tồn, hiển thị, phân trang. */
export async function listAdminProducts(input: AdminProductFilterInput = {}): Promise<AdminProductListResult> {
  const f = parseInput(adminProductFilterSchema, input)
  const where = await listWhere(f)
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: listSelect,
    }),
    db.product.count({ where }),
  ])
  return {
    items: rows.map(toListItem),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
  }
}

/* ─────────────────────────── Thẻ tổng quan & cảnh báo ─────────────────────────── */

export async function getInventorySummary(): Promise<InventorySummary> {
  const [groups, productCount, valueRows, lowVariants, outVariants] = await Promise.all([
    db.productVariant.groupBy({ by: ["productId"], _sum: { stock: true } }),
    db.product.count(),
    db.$queryRaw<{ value: bigint }[]>`SELECT COALESCE(SUM("price"::bigint * "stock"), 0)::bigint AS value FROM "ProductVariant"`,
    db.productVariant.count({ where: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
    db.productVariant.count({ where: { stock: { lte: 0 } } }),
  ])
  let totalStock = 0
  let low = 0
  let out = productCount - groups.length // sản phẩm chưa có biến thể nào
  for (const g of groups) {
    const s = g._sum.stock ?? 0
    totalStock += s
    const st = stockStatus(s)
    if (st === "LOW") low++
    else if (st === "OUT") out++
  }
  return {
    totalStock,
    inventoryValue: Number(valueRows[0]?.value ?? 0),
    productCount,
    lowStockProducts: low,
    outOfStockProducts: out,
    lowStockVariants: lowVariants,
    outOfStockVariants: outVariants,
  }
}

/** Khối "Cảnh báo tồn kho thấp": theo (sản phẩm, màu), chỉ sản phẩm đang hiển thị; nhóm ít hàng nhất đứng đầu. */
/** `only.productIds`: giới hạn trong vài sản phẩm (vd trang chi tiết sản phẩm); bỏ trống = toàn cửa hàng. */
export async function listLowStockVariants(limit = 10, only?: { productIds?: string[] }): Promise<LowStockEntry[]> {
  const take = parseInput(lowStockLimitSchema, limit)
  const rows = await db.productVariant.findMany({
    where: {
      stock: { lte: LOW_STOCK_THRESHOLD },
      product: { isActive: true, ...(only?.productIds ? { id: { in: only.productIds } } : {}) },
    },
    orderBy: [{ stock: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      colorHex: true,
      stock: true,
      product: { select: { id: true, name: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } } } },
    },
  })
  const groups = new Map<string, LowStockEntry>() // Map giữ thứ tự chèn → nhóm có size ít hàng nhất trước
  for (const v of rows) {
    const key = `${v.product.id}|${v.color}`
    let g = groups.get(key)
    if (!g) {
      groups.set(key, (g = { productId: v.product.id, productName: v.product.name, image: v.product.images[0] ?? null, color: v.color, colorHex: v.colorHex, sizes: [] }))
    }
    g.sizes.push({ variantId: v.id, sku: v.sku, size: v.size, stock: v.stock, status: stockStatus(v.stock) })
  }
  return [...groups.values()].slice(0, take).map((g) => ({ ...g, sizes: g.sizes.sort((a, b) => sizeRank(a.size) - sizeRank(b.size)) }))
}

/* ─────────────────────────── Chi tiết ─────────────────────────── */

const detailSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  brand: true,
  material: true,
  style: true,
  occasion: true,
  season: true,
  gender: true,
  tags: true,
  basePrice: true,
  isActive: true,
  isFeatured: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  images: { orderBy: { position: "asc" }, select: { id: true, url: true, alt: true, position: true } },
  variants: { select: { id: true, sku: true, size: true, color: true, colorHex: true, price: true, stock: true } },
} satisfies Prisma.ProductSelect

/** Dữ liệu điền form sửa; null nếu không có sản phẩm (kể cả đang ẩn). */
export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const pid = parseInput(adminIdSchema, id)
  const [p, orderRefs] = await Promise.all([
    db.product.findUnique({ where: { id: pid }, select: detailSelect }),
    db.orderItem.count({ where: { variant: { productId: pid } } }),
  ])
  if (!p) return null
  const variants = [...p.variants].sort((a, b) => a.color.localeCompare(b.color, "vi") || sizeRank(a.size) - sizeRank(b.size))
  const totalStock = variants.reduce((s, v) => s + v.stock, 0)
  return { ...p, variants, totalStock, status: stockStatus(totalStock), hasOrders: orderRefs > 0 }
}

/* ─────────────────────────── Tạo / sửa / ẩn / xoá ─────────────────────────── */

async function assertCategory(tx: Tx, categoryId: string) {
  if (!(await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } })))
    throw new AdminCatalogError("CATEGORY_NOT_FOUND", "Danh mục không tồn tại")
}

/** SKU đã thuộc biến thể khác (loại trừ các biến thể trong `keepIds`) → lỗi nêu rõ SKU nào. */
async function assertSkusFree(tx: Tx, skus: string[], keepIds: string[] = []) {
  const clash = await tx.productVariant.findMany({ where: { sku: { in: skus }, id: { notIn: keepIds } }, select: { sku: true } })
  if (clash.length) throw new AdminCatalogError("DUPLICATE_SKU", `SKU đã tồn tại: ${clash.map((c) => c.sku).join(", ")}`)
}

const imageRows = (images: { url: string; alt?: string }[], name: string) =>
  images.map((img, position) => ({ url: img.url, alt: img.alt || name, position }))

export async function createProduct(admin: AdminContext, input: CreateProductInput): Promise<AdminProductDetail> {
  parseAdmin(admin)
  const data = parseInput(createProductSchema, input)
  const variants = resolveVariants(data.variants, data.skuPrefix, data.basePrice)

  const id = await withUniqueErrors(() =>
    db.$transaction(async (tx) => {
      await assertCategory(tx, data.categoryId)
      await assertSkusFree(tx, variants.map((v) => v.sku))
      const taken = async (slug: string) => (await tx.product.findUnique({ where: { slug }, select: { id: true } })) !== null
      let slug: string
      if (data.slug) {
        if (await taken(data.slug)) throw new AdminCatalogError("DUPLICATE_SLUG", `Slug "${data.slug}" đã được dùng cho sản phẩm khác`)
        slug = data.slug
      } else slug = await uniqueSlug(data.name, taken, "san-pham")

      const p = await tx.product.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          brand: data.brand,
          material: data.material,
          style: data.style,
          occasion: data.occasion,
          season: data.season,
          gender: data.gender,
          tags: data.tags,
          basePrice: data.basePrice,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          categoryId: data.categoryId,
          images: { create: imageRows(data.images, data.name) },
          variants: { create: variants.map((v) => ({ sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex, price: v.price, stock: v.stock })) },
        },
        select: { id: true },
      })
      return p.id
    })
  )

  await notifyProductChanged(id)
  return (await getAdminProduct(id)) as AdminProductDetail
}

/**
 * Sửa trọn form trong MỘT transaction: thông tin chung, ảnh (thay cả danh sách), biến thể
 * (có id = sửa, không id = thêm, vắng mặt = xoá; dòng đơn cũ vẫn giữ nguyên vì OrderItem là snapshot).
 * Lưu ý: `stock` của biến thể được ĐẶT bằng giá trị gửi lên; muốn cộng dồn an toàn khi đang có đơn đặt hãy dùng adjustStock.
 */
export async function updateProduct(admin: AdminContext, id: string, input: UpdateProductInput): Promise<AdminProductDetail> {
  parseAdmin(admin)
  const pid = parseInput(adminIdSchema, id)
  const data = parseInput(updateProductSchema, input)
  const variants = resolveVariants(data.variants, data.skuPrefix, data.basePrice)

  await withUniqueErrors(() =>
    db.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id: pid }, select: { slug: true, variants: { select: { id: true } } } })
      if (!existing) throw new AdminCatalogError("PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại")
      await assertCategory(tx, data.categoryId)

      let slug = existing.slug
      if (data.slug && data.slug !== existing.slug) {
        if (await tx.product.findUnique({ where: { slug: data.slug }, select: { id: true } }))
          throw new AdminCatalogError("DUPLICATE_SLUG", `Slug "${data.slug}" đã được dùng cho sản phẩm khác`)
        slug = data.slug
      }

      const owned = new Set(existing.variants.map((v) => v.id))
      const keepIds = variants.flatMap((v) => (v.id ? [v.id] : []))
      if (keepIds.some((k) => !owned.has(k))) throw new AdminCatalogError("VARIANT_NOT_FOUND", "Có biến thể không thuộc sản phẩm này")
      const removeIds = [...owned].filter((o) => !keepIds.includes(o))

      if (removeIds.length) await tx.productVariant.deleteMany({ where: { id: { in: removeIds } } })
      await assertSkusFree(tx, variants.map((v) => v.sku), keepIds)

      await tx.product.update({
        where: { id: pid },
        data: {
          name: data.name,
          slug,
          description: data.description,
          brand: data.brand,
          material: data.material,
          style: data.style,
          occasion: data.occasion,
          season: data.season,
          gender: data.gender,
          tags: data.tags,
          basePrice: data.basePrice,
          isActive: data.isActive,
          isFeatured: data.isFeatured,
          categoryId: data.categoryId,
        },
      })

      await tx.productImage.deleteMany({ where: { productId: pid } })
      if (data.images.length) await tx.productImage.createMany({ data: imageRows(data.images, data.name).map((r) => ({ ...r, productId: pid })) })

      for (const v of variants) {
        const fields = { sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex, price: v.price, stock: v.stock }
        if (v.id) await tx.productVariant.update({ where: { id: v.id }, data: fields })
        else await tx.productVariant.create({ data: { ...fields, productId: pid } })
      }
    })
  )

  await notifyProductChanged(pid)
  return (await getAdminProduct(pid)) as AdminProductDetail
}

/** Bật/tắt hiển thị trên cửa hàng. */
export async function setProductActive(admin: AdminContext, id: string, isActive: boolean): Promise<void> {
  parseAdmin(admin)
  const pid = parseInput(adminIdSchema, id)
  const active = parseInput(z.boolean({ error: "Trạng thái hiển thị không hợp lệ" }), isActive)
  const r = await db.product.updateMany({ where: { id: pid }, data: { isActive: active } })
  if (r.count === 0) throw new AdminCatalogError("PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại")
  await notifyProductChanged(pid)
}

/** Xoá cứng, chỉ khi chưa có dòng đơn hàng nào tham chiếu; ngược lại báo lỗi và gợi ý ẩn sản phẩm. */
export async function deleteProduct(admin: AdminContext, id: string): Promise<void> {
  parseAdmin(admin)
  const pid = parseInput(adminIdSchema, id)
  await db.$transaction(async (tx) => {
    if (!(await tx.product.findUnique({ where: { id: pid }, select: { id: true } })))
      throw new AdminCatalogError("PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại")
    const refs = await tx.orderItem.count({ where: { variant: { productId: pid } } })
    if (refs > 0)
      throw new AdminCatalogError(
        "PRODUCT_HAS_ORDERS",
        `Không thể xoá: sản phẩm đã có ${refs} dòng trong đơn hàng. Hãy ẩn sản phẩm thay vì xoá để giữ lịch sử đơn.`
      )
    await tx.product.delete({ where: { id: pid } }) // cascade: ảnh, biến thể, mục giỏ hàng
  })
  await notifyProductChanged(pid)
}

/* ─────────────────────────── Tồn kho ─────────────────────────── */

/**
 * Nút "Nhập": `{ delta }` cộng (hoặc trừ khi kiểm kê) vào tồn hiện tại, `{ newStock }` đặt lại.
 * Cộng/trừ chạy nguyên tử trong DB nên không đè lên đơn đang đặt; tồn không bao giờ âm.
 */
export async function adjustStock(admin: AdminContext, variantId: string, input: AdjustStockInput): Promise<StockAdjustResult> {
  parseAdmin(admin)
  const vid = parseInput(adminIdSchema, variantId)
  const change = parseInput(adjustStockSchema, input)

  const result = await db.$transaction(async (tx) => {
    const v = await tx.productVariant.findUnique({ where: { id: vid }, select: { productId: true, sku: true, stock: true } })
    if (!v) throw new AdminCatalogError("VARIANT_NOT_FOUND", "Biến thể không tồn tại")

    if (change.newStock !== undefined) {
      await tx.productVariant.update({ where: { id: vid }, data: { stock: change.newStock } })
      return { variantId: vid, productId: v.productId, sku: v.sku, previousStock: v.stock, stock: change.newStock }
    }

    const delta = change.delta as number
    if (delta < 0) {
      const r = await tx.productVariant.updateMany({ where: { id: vid, stock: { gte: -delta } }, data: { stock: { decrement: -delta } } })
      if (r.count === 0) throw new AdminCatalogError("NEGATIVE_STOCK", `Không thể trừ ${-delta}: tồn kho hiện chỉ còn ${v.stock}`)
    } else {
      await tx.productVariant.update({ where: { id: vid }, data: { stock: { increment: delta } } })
    }
    const after = await tx.productVariant.findUniqueOrThrow({ where: { id: vid }, select: { stock: true } })
    return { variantId: vid, productId: v.productId, sku: v.sku, previousStock: after.stock - delta, stock: after.stock }
  })

  await notifyProductChanged(result.productId)
  return result
}
