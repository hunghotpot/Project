"use server"

import { revalidatePath } from "next/cache"
import type { AdminActionResult } from "@/lib/admin-action"
import { adminCancelOrderSchema, adminChangeOrderStatusSchema, adminOrderIdSchema } from "@/lib/validators/admin-order"
import { getAdminUser, NOT_ADMIN_MESSAGE } from "@/server/auth/admin"
import { adminCancelOrder, adminChangeOrderStatus, markBankTransferPaid } from "@/server/services/admin-order.service"
import { OrderError } from "@/server/services/order.service"

// Mọi Server Action của Admin: kiểm quyền TRƯỚC (getAdminUser), rồi validate input, rồi mới gọi service.
export async function approveOrderAction(orderId: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = adminOrderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, message: "Đơn hàng không hợp lệ" }

  try {
    await adminChangeOrderStatus({ userId: admin.id }, id.data, "CONFIRMED")
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Đã duyệt đơn hàng" }
}

const ADVANCE_MESSAGE = {
  CONFIRMED: "Đã duyệt đơn hàng",
  SHIPPING: "Đã chuyển đơn sang đang giao",
  DELIVERED: "Đã hoàn thành đơn hàng",
} as const

/** Đẩy đơn sang bước kế tiếp (Duyệt / Giao đi / Hoàn thành). Service từ chối nhảy cóc và đi lùi. */
export async function advanceOrderAction(orderId: unknown, to: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const parsed = adminChangeOrderStatusSchema.safeParse({ orderId, to })
  if (!parsed.success) return { ok: false, message: "Yêu cầu không hợp lệ" }

  try {
    await adminChangeOrderStatus({ userId: admin.id }, parsed.data.orderId, parsed.data.to)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: ADVANCE_MESSAGE[parsed.data.to] }
}

/** Huỷ đơn PENDING/CONFIRMED (hoàn kho, hoàn tiền nếu đã trả). Lý do tuỳ chọn, tối đa 200 ký tự. */
export async function cancelOrderAction(orderId: unknown, reason?: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const parsed = adminCancelOrderSchema.safeParse({ orderId, reason: reason ?? undefined })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ" }

  try {
    await adminCancelOrder({ userId: admin.id }, parsed.data.orderId, parsed.data.reason)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Đã hủy đơn hàng" }
}

/** Xác nhận đã nhận tiền chuyển khoản (chỉ đơn BANK_TRANSFER chưa trả, chưa huỷ; service kiểm lại). */
export async function markBankTransferPaidAction(orderId: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = adminOrderIdSchema.safeParse(orderId)
  if (!id.success) return { ok: false, message: "Đơn hàng không hợp lệ" }

  try {
    await markBankTransferPaid({ userId: admin.id }, id.data)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Đã xác nhận thanh toán chuyển khoản" }
}
