import "server-only"
import { Prisma } from "@prisma/client"
import type { ZodType } from "zod"
import { adminContextSchema, slugify, type AdminContext } from "@/lib/validators/admin-catalog"
import { syncProductEmbedding } from "./product-hooks"

/*
 * Phần dùng chung của các service Admin về catalog (sản phẩm, danh mục, bảng size):
 * lớp lỗi, parse đầu vào, ánh xạ lỗi Prisma sang tiếng Việt, sinh slug duy nhất, gọi hook AI.
 * Service KHÔNG đọc cookie và KHÔNG tự kiểm quyền: Server Action / route gọi requireAdmin() rồi truyền `admin`.
 *
 * Các file: admin-product.service.ts (sản phẩm + tồn kho), admin-category.service.ts, admin-size-chart.service.ts.
 */

export type AdminCatalogErrorCode =
  | "INVALID_INPUT"
  | "PRODUCT_NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_SKU"
  | "DUPLICATE_VARIANT"
  | "CATEGORY_TOO_DEEP"
  | "CATEGORY_CYCLE"
  | "CATEGORY_HAS_CHILDREN"
  | "CATEGORY_HAS_PRODUCTS"
  | "PRODUCT_HAS_ORDERS"
  | "NEGATIVE_STOCK"
  | "SIZE_CHART_ROW_NOT_FOUND"

export interface AdminCatalogIssue {
  /** Đường dẫn tới trường lỗi, ví dụ ["variants", 0, "sku"]. */
  path: (string | number)[]
  message: string
}

export class AdminCatalogError extends Error {
  constructor(
    public readonly code: AdminCatalogErrorCode,
    message: string,
    /** INVALID_INPUT: danh sách lỗi theo từng trường để form hiển thị. */
    public readonly issues?: AdminCatalogIssue[]
  ) {
    super(message)
    this.name = "AdminCatalogError"
  }
}

export type Tx = Prisma.TransactionClient

/** Parse bằng Zod; lỗi → AdminCatalogError("INVALID_INPUT") với thông báo tiếng Việt của schema. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input)
  if (r.success) return r.data
  const issues = r.error.issues.map((i) => ({ path: i.path.filter((p): p is string | number => typeof p !== "symbol"), message: i.message }))
  throw new AdminCatalogError("INVALID_INPUT", issues[0]?.message ?? "Dữ liệu không hợp lệ", issues)
}

export function parseAdmin(admin: AdminContext): AdminContext {
  return parseInput(adminContextSchema, admin)
}

/** Lỗi P2002 (vi phạm unique) → chuỗi tên cột/ràng buộc bị trùng, hoặc null nếu không phải P2002. */
export function uniqueViolation(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return null
  const target = e.meta?.target
  return Array.isArray(target) ? target.join(",") : typeof target === "string" ? target : ""
}

/** Chạy một thao tác ghi; bắt lỗi trùng của Prisma và đổi sang AdminCatalogError tiếng Việt (chỉ khi đua nhau, vì đã kiểm trước). */
export async function withUniqueErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const target = uniqueViolation(e)
    if (target === null) throw e
    if (target.includes("sku")) throw new AdminCatalogError("DUPLICATE_SKU", "SKU đã tồn tại, hãy dùng SKU khác")
    if (target.includes("slug")) throw new AdminCatalogError("DUPLICATE_SLUG", "Slug đã tồn tại, hãy đổi tên hoặc slug")
    if (target.includes("size") || target.includes("color"))
      throw new AdminCatalogError("DUPLICATE_VARIANT", "Sản phẩm đã có biến thể trùng màu và size")
    throw new AdminCatalogError("DUPLICATE_SLUG", "Dữ liệu bị trùng với bản ghi khác")
  }
}

/** Slug chưa dùng: base, base-2, base-3… `taken` kiểm tra trong transaction hiện tại. */
export async function uniqueSlug(name: string, taken: (slug: string) => Promise<boolean>, fallback: string): Promise<string> {
  const base = slugify(name) || fallback
  let candidate = base
  for (let n = 2; await taken(candidate); n++) {
    candidate = `${base}-${n}`
    if (n > 200) throw new AdminCatalogError("DUPLICATE_SLUG", "Không tạo được slug duy nhất, hãy đổi tên")
  }
  return candidate
}

/** Gọi hook AI sau khi thao tác sản phẩm đã commit; nuốt và log mọi lỗi. */
export async function notifyProductChanged(productId: string): Promise<void> {
  try {
    await syncProductEmbedding(productId)
  } catch (e) {
    console.error(`[admin-catalog] syncProductEmbedding(${productId}) lỗi:`, e)
  }
}

