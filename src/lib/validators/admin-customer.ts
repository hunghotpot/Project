import { z } from "zod"
import { registerSchema } from "@/lib/validators/auth"

/* Validator cho Admin → Khách hàng. Quy tắc tên/email/SĐT/mật khẩu dùng lại từ đăng ký. */

export const CUSTOMER_FILTERS = ["all", "vip", "member", "locked"] as const
export type CustomerFilterKey = (typeof CUSTOMER_FILTERS)[number]

export const DEFAULT_CUSTOMER_PAGE_SIZE = 10
export const MAX_CUSTOMER_PAGE_SIZE = 50

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

export const customerListFilterSchema = z.object({
  filter: z.preprocess(first, z.enum(CUSTOMER_FILTERS)).catch("all"),
  /** Tìm theo tên, email hoặc SĐT. */
  q: z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).trim() : undefined), z.string().max(100).optional())
    .transform((v) => v || undefined)
    .catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
  pageSize: z
    .preprocess(first, z.coerce.number().int().min(1).max(MAX_CUSTOMER_PAGE_SIZE))
    .catch(DEFAULT_CUSTOMER_PAGE_SIZE),
})

export type CustomerListFilters = z.output<typeof customerListFilterSchema>
export type CustomerListFilterInput = Partial<CustomerListFilters>

export const createCustomerSchema = z.object({
  name: registerSchema.shape.name,
  email: registerSchema.shape.email,
  phone: registerSchema.shape.phone,
  password: registerSchema.shape.password,
})

/** Dữ liệu form (trước khi parse). */
export type CreateCustomerInput = z.input<typeof createCustomerSchema>

export const customerIdSchema = z.string().min(1).max(64)
