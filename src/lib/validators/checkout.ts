import { z } from "zod"
import { PAYMENT_METHODS } from "@/lib/order"
import { addressSchema } from "@/lib/validators/auth"

// Địa chỉ nhận hàng: chọn từ sổ địa chỉ HOẶC nhập địa chỉ mới (sẽ được lưu vào sổ địa chỉ).
const shippingSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("saved"),
    addressId: z.string().min(1, "Vui lòng chọn địa chỉ nhận hàng").max(64),
  }),
  z.object({
    mode: z.literal("new"),
    address: addressSchema,
  }),
])

export const checkoutSchema = z.object({
  shipping: shippingSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Vui lòng chọn phương thức thanh toán" }),
  note: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => v || undefined),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
