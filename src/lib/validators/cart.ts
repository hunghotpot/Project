import { z } from "zod"
import { MAX_LINE_QUANTITY } from "@/lib/cart"

const variantId = z.string().trim().min(1, "Thiếu mã biến thể").max(64)

export const addItemSchema = z.object({
  variantId,
  quantity: z.number().int("Số lượng phải là số nguyên").min(1, "Số lượng tối thiểu là 1").max(MAX_LINE_QUANTITY),
})

// 0 = xoá dòng khỏi giỏ.
export const updateQuantitySchema = z.object({
  quantity: z.number().int("Số lượng phải là số nguyên").min(0, "Số lượng không hợp lệ").max(MAX_LINE_QUANTITY),
})

export const variantIdSchema = variantId

export type AddItemInput = z.infer<typeof addItemSchema>
