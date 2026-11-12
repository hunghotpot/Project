"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  adjustStockSchema,
  adminIdSchema,
  createProductSchema,
  updateProductSchema,
} from "@/lib/validators/admin-catalog"
import { getAdminUser, NOT_ADMIN_MESSAGE } from "@/server/auth/admin"
import { AdminCatalogError, type AdminCatalogIssue } from "@/server/services/admin-catalog.service"
import { adjustStock, createProduct, deleteProduct, setProductActive, updateProduct } from "@/server/services/admin-product.service"

/**
 * Kết quả mở rộng của AdminActionResult: lỗi có thể kèm `issues` (đường dẫn trường + thông báo) để form gắn lỗi vào từng ô.
 * Khai báo ở đây (không sửa src/lib/admin-action.ts); vẫn gán được cho AdminActionResult.
 */
export type ProductActionResult = { ok: true; message: string } | { ok: false; message: string; issues?: AdminCatalogIssue[] }

const INVALID = "Dữ liệu không hợp lệ"

const zodIssues = (error: z.ZodError): AdminCatalogIssue[] =>
  error.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== "symbol"), message: i.message }))

const invalid = (error: z.ZodError): ProductActionResult => {
  const issues = zodIssues(error)
  return { ok: false, message: issues[0]?.message ?? INVALID, issues }
}

/** Lỗi nghiệp vụ của service → kết quả có cấu trúc; lỗi lạ ném lại. */
function fromError(e: unknown): ProductActionResult {
  if (e instanceof AdminCatalogError) return { ok: false, message: e.message, issues: e.issues }
  throw e
}

function refresh() {
  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout") // cửa hàng cũng hiển thị lại giá/ảnh/tồn
}

const saveInputSchema = z.object({ id: adminIdSchema.optional(), data: z.unknown() })

/** Thêm mới (không có `id`) hoặc sửa trọn form (có `id`): input = { id?, data }, data theo createProductSchema/updateProductSchema. */
export async function saveProductAction(input: unknown): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const envelope = saveInputSchema.safeParse(input)
  if (!envelope.success) return { ok: false, message: INVALID }
  const { id, data } = envelope.data

  try {
    if (id) {
      const parsed = updateProductSchema.safeParse(data)
      if (!parsed.success) return invalid(parsed.error)
      await updateProduct({ userId: admin.id }, id, parsed.data)
      refresh()
      return { ok: true, message: "Đã cập nhật sản phẩm" }
    }
    const parsed = createProductSchema.safeParse(data)
    if (!parsed.success) return invalid(parsed.error)
    await createProduct({ userId: admin.id }, parsed.data)
    refresh()
    return { ok: true, message: "Đã thêm sản phẩm" }
  } catch (e) {
    return fromError(e)
  }
}

export async function setProductActiveAction(productId: unknown, isActive: unknown): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = adminIdSchema.safeParse(productId)
  const active = z.boolean().safeParse(isActive)
  if (!id.success || !active.success) return { ok: false, message: INVALID }

  try {
    await setProductActive({ userId: admin.id }, id.data, active.data)
  } catch (e) {
    return fromError(e)
  }
  refresh()
  return { ok: true, message: active.data ? "Đã hiện sản phẩm trên cửa hàng" : "Đã ẩn sản phẩm khỏi cửa hàng" }
}

/** Xoá cứng; sản phẩm đã có đơn → service báo PRODUCT_HAS_ORDERS kèm gợi ý ẩn (message được trả nguyên văn). */
export async function deleteProductAction(productId: unknown): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = adminIdSchema.safeParse(productId)
  if (!id.success) return { ok: false, message: INVALID }

  try {
    await deleteProduct({ userId: admin.id }, id.data)
  } catch (e) {
    return fromError(e)
  }
  refresh()
  return { ok: true, message: "Đã xoá sản phẩm" }
}

const adjustItemSchema = z.object({ variantId: adminIdSchema, change: adjustStockSchema })
const adjustInputSchema = z.array(adjustItemSchema).min(1, "Chưa nhập số lượng nào").max(100)

/**
 * Nút "Nhập": input = [{ variantId, change: { delta } | { newStock } }, ...]. Chạy lần lượt từng biến thể (mỗi lần là một thao tác nguyên tử
 * của service); nếu một biến thể lỗi thì dừng và báo rõ đã cập nhật bao nhiêu biến thể trước đó.
 */
export async function adjustStockAction(input: unknown): Promise<ProductActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const items = adjustInputSchema.safeParse(input)
  if (!items.success) return invalid(items.error)

  let done = 0
  for (const { variantId, change } of items.data) {
    try {
      await adjustStock({ userId: admin.id }, variantId, change)
      done++
    } catch (e) {
      const res = fromError(e)
      if (done > 0) refresh()
      return done > 0 ? { ...res, message: `${res.message} (đã cập nhật ${done}/${items.data.length} biến thể trước đó)` } : res
    }
  }
  refresh()
  return { ok: true, message: done === 1 ? "Đã cập nhật tồn kho" : `Đã cập nhật tồn kho ${done} biến thể` }
}
