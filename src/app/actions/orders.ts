"use server"

import { revalidatePath } from "next/cache"
import { cancelOrderSchema, orderIdSchema } from "@/lib/validators/order-list"
import { getCurrentUser } from "@/server/auth/session"
import { cancelOrder, OrderError, reorder } from "@/server/services/order.service"
import type { ReorderResult } from "@/types/order"

export type OrderActionResult =
  | { ok: true; message: string; skipped?: ReorderResult["skipped"] }
  | { ok: false; message: string }

const NOT_SIGNED_IN: OrderActionResult = { ok: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" }

// Quyền nằm ở order.service (luôn ràng buộc theo user); action chỉ validate input rồi gọi service.
export async function cancelOrderAction(input: unknown): Promise<OrderActionResult> {
  const user = await getCurrentUser()
  if (!user) return NOT_SIGNED_IN
  const parsed = cancelOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  try {
    await cancelOrder(user, parsed.data.orderId, parsed.data.reason)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/account/orders", "layout")
  return { ok: true, message: "Đã hủy đơn hàng" }
}

export async function reorderAction(orderId: unknown): Promise<OrderActionResult> {
  const user = await getCurrentUser()
  if (!user) return NOT_SIGNED_IN
  const id = orderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, message: "Đơn hàng không hợp lệ" }

  try {
    const res = await reorder(user, id.data)
    if (res.added === 0) {
      return { ok: false, message: "Không thêm được sản phẩm nào: tất cả đã hết hàng hoặc ngừng bán" }
    }
    return {
      ok: true,
      message: `Đã thêm ${res.added} sản phẩm vào giỏ hàng`,
      skipped: res.skipped.length > 0 ? res.skipped : undefined,
    }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message }
    throw e
  }
}
