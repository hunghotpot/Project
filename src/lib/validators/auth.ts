import { z } from "zod"

const PHONE_REGEX = /^(0|\+84)\d{9}$/

const email = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập email")
  .max(254, "Email quá dài")
  .email("Email không hợp lệ")
  .transform((v) => v.toLowerCase())

const name = z
  .string()
  .trim()
  .min(2, "Họ tên tối thiểu 2 ký tự")
  .max(100, "Họ tên tối đa 100 ký tự")

// Bắt buộc có chữ và số; bcrypt chỉ xử lý 72 byte đầu nên chặn ở 72 ký tự.
const newPassword = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(72, "Mật khẩu tối đa 72 ký tự")
  .regex(/[A-Za-z]/, "Mật khẩu phải có ít nhất 1 chữ cái")
  .regex(/\d/, "Mật khẩu phải có ít nhất 1 chữ số")

const phone = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Số điện thoại không hợp lệ (VD: 0901234567)")

// Ô SĐT không bắt buộc: rỗng/null/undefined => null. Nhận cả null để parse lại được output của chính schema này.
const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null)
  .pipe(phone.nullable())

export const registerSchema = z
  .object({
    name,
    email,
    phone: optionalPhone,
    password: newPassword,
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp",
  })

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(72, "Mật khẩu không hợp lệ"),
})

export const updateProfileSchema = z.object({
  name,
  phone: optionalPhone,
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
    newPassword,
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu mới"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
  })

export const addressSchema = z.object({
  fullName: name,
  phone,
  street: z.string().trim().min(1, "Vui lòng nhập số nhà, tên đường").max(200, "Tối đa 200 ký tự"),
  ward: z.string().trim().min(1, "Vui lòng nhập phường/xã").max(100, "Tối đa 100 ký tự"),
  district: z.string().trim().min(1, "Vui lòng nhập quận/huyện").max(100, "Tối đa 100 ký tự"),
  province: z.string().trim().min(1, "Vui lòng nhập tỉnh/thành phố").max(100, "Tối đa 100 ký tự"),
  isDefault: z.boolean(),
})

export const addressIdSchema = z.string().min(1).max(64)

// Chỉ cho phép redirect nội bộ (chặn open redirect: //evil.com, https://...).
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback
  }
  return value
}

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type AddressInput = z.infer<typeof addressSchema>
