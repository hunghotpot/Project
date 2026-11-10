"use server"

import { fieldErrorsByPath } from "@/lib/action-result"
import { checkoutSchema } from "@/lib/validators/checkout"
import { getCurrentUser } from "@/server/auth/session"
import { isVnpayConfigured } from "@/server/payment/vnpay-config"
import { createOrder, OrderError } from "@/server/services/order.service"
import type { StockShortage } from "@/types/order"

export type PlaceOrderResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false
      code?: "OUT_OF_STOCK" | "EMPTY_CART"
      message?: string
      fieldErrors?: Record<string, string>
      shortages?: StockShortage[]
    }

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" }

  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsByPath(parsed.error) }
  const { shipping, paymentMethod, note } = parsed.data
  // Kiểm trước khi tạo đơn: nếu chưa cấu hình VNPay thì không để lại đơn treo giữ tồn kho.
  if (paymentMethod === "VNPAY" && !isVnpayConfigured()) {
    return { ok: false, message: "Thanh toán qua VNPay hiện chưa khả dụng, vui lòng chọn phương thức khác" }
  }

  try {
    const order = await createOrder(user, {
      addressId: shipping.mode === "saved" ? shipping.addressId : undefined,
      newAddress: shipping.mode === "new" ? shipping.address : undefined,
      paymentMethod,
      note,
    })
    // VNPAY → route ký URL rồi chuyển sang cổng VNPay; chuyển khoản → trang quét mã; COD → trang thành công.
    if (paymentMethod === "VNPAY") return { ok: true, redirectTo: `/api/payment/vnpay/pay?orderId=${order.id}` }
    const next = paymentMethod === "BANK_TRANSFER" ? "payment" : "success"
    return { ok: true, redirectTo: `/orders/${order.id}/${next}` }
  } catch (e) {
    if (e instanceof OrderError) {
      if (e.code === "OUT_OF_STOCK") return { ok: false, code: "OUT_OF_STOCK", message: e.message, shortages: e.shortages }
      if (e.code === "EMPTY_CART") return { ok: false, code: "EMPTY_CART", message: e.message }
      return { ok: false, message: e.message }
    }
    throw e
  }
}

