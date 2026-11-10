import { z } from "zod"

/* Bộ lọc danh sách đơn hàng nằm hoàn toàn trong URL (?status=SHIPPING&q=áo&page=2). Lỏng với URL: giá trị sai rơi về mặc định. */

export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"] as const
export type OrderStatusFilter = (typeof ORDER_STATUSES)[number]

export const DEFAULT_ORDER_PAGE_SIZE = 5
export const MAX_ORDER_PAGE_SIZE = 20

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

export const orderListFilterSchema = z.object({
  status: z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).toUpperCase() : v), z.enum(ORDER_STATUSES).optional())
    .catch(undefined),
  /** Tìm theo mã đơn hoặc tên sản phẩm. */
  q: z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).trim() : undefined), z.string().max(100).optional())
    .transform((v) => v || undefined)
    .catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
  pageSize: z
    .preprocess(first, z.coerce.number().int().min(1).max(MAX_ORDER_PAGE_SIZE))
    .catch(DEFAULT_ORDER_PAGE_SIZE),
})

export type OrderListFilters = z.output<typeof orderListFilterSchema>
export type OrderListFilterInput = Partial<OrderListFilters>

export type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>

export function parseOrderListFilters(input: SearchParamsLike): OrderListFilters {
  const raw: Record<string, string | string[] | undefined> = {}
  if (input instanceof URLSearchParams) {
    for (const key of new Set(input.keys())) raw[key] = input.getAll(key)
  } else {
    Object.assign(raw, input)
  }
  return orderListFilterSchema.parse(raw)
}

/** Bỏ giá trị mặc định để URL ngắn gọn. */
export function serializeOrderListFilters(f: OrderListFilters): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.status) sp.set("status", f.status)
  if (f.q) sp.set("q", f.q)
  if (f.page > 1) sp.set("page", String(f.page))
  if (f.pageSize !== DEFAULT_ORDER_PAGE_SIZE) sp.set("pageSize", String(f.pageSize))
  return sp
}

export const orderIdSchema = z.string().min(1).max(64)

export const cancelOrderSchema = z.object({
  orderId: orderIdSchema,
  /** Lý do huỷ (tuỳ chọn), lưu vào lịch sử trạng thái. */
  reason: z
    .string()
    .trim()
    .max(200, "Lý do tối đa 200 ký tự")
    .optional()
    .transform((v) => v || undefined),
})
