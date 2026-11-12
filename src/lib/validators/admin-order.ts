import { z } from "zod"
import { orderIdSchema, ORDER_STATUSES } from "@/lib/validators/order-list"

/* Validator cho màn Quản lý Đơn hàng của Admin. Bộ lọc nằm trong URL nên lỏng: giá trị sai rơi về mặc định. */

export const ADMIN_PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const
export const ADMIN_PAYMENT_METHODS = ["COD", "BANK_TRANSFER", "VNPAY", "MOMO"] as const

export const DEFAULT_ADMIN_ORDER_PAGE_SIZE = 10
export const MAX_ADMIN_ORDER_PAGE_SIZE = 50

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

function lenientEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).toUpperCase() : v), z.enum(values).optional())
    .catch(undefined)
}

export const adminOrderListFilterSchema = z.object({
  status: lenientEnum(ORDER_STATUSES),
  paymentStatus: lenientEnum(ADMIN_PAYMENT_STATUSES),
  paymentMethod: lenientEnum(ADMIN_PAYMENT_METHODS),
  /** Tìm theo mã đơn, tên khách hoặc số điện thoại. */
  q: z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).trim() : undefined), z.string().max(100).optional())
    .transform((v) => v || undefined)
    .catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
  pageSize: z
    .preprocess(first, z.coerce.number().int().min(1).max(MAX_ADMIN_ORDER_PAGE_SIZE))
    .catch(DEFAULT_ADMIN_ORDER_PAGE_SIZE),
})

export type AdminOrderListFilters = z.output<typeof adminOrderListFilterSchema>
export type AdminOrderListFilterInput = Partial<AdminOrderListFilters>

export const adminOrderIdSchema = orderIdSchema

export const adminCancelOrderSchema = z.object({
  orderId: adminOrderIdSchema,
  reason: z
    .string()
    .trim()
    .max(200, "Lý do tối đa 200 ký tự")
    .optional()
    .transform((v) => v || undefined),
})

/** Admin chỉ đẩy đơn tiến lên; huỷ đi qua adminCancelOrderSchema. */
export const ADMIN_NEXT_STATUSES = ["CONFIRMED", "SHIPPING", "DELIVERED"] as const

export const adminChangeOrderStatusSchema = z.object({
  orderId: adminOrderIdSchema,
  to: z.enum(ADMIN_NEXT_STATUSES, { message: "Trạng thái không hợp lệ" }),
  note: z
    .string()
    .trim()
    .max(200, "Ghi chú tối đa 200 ký tự")
    .optional()
    .transform((v) => v || undefined),
})
