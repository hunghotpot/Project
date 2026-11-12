import type { PillTone } from "@/components/admin/status-pill"

export const ORDER_PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thanh toán lỗi",
  REFUNDED: "Đã hoàn tiền",
}

export const ORDER_PAYMENT_STATUS_TONE: Record<string, PillTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
}

export const ORDER_ACTOR_LABEL: Record<string, string> = {
  CUSTOMER: "Khách hàng",
  ADMIN: "Quản trị viên",
  SYSTEM: "Hệ thống",
}

export type NextStatus = "CONFIRMED" | "SHIPPING" | "DELIVERED"

/** Bước kế tiếp của đơn (chỉ để hiện nút; service mới là chốt cuối). */
export const NEXT_STEP: Partial<Record<string, { to: NextStatus; label: string }>> = {
  PENDING: { to: "CONFIRMED", label: "Duyệt" },
  CONFIRMED: { to: "SHIPPING", label: "Giao đi" },
  SHIPPING: { to: "DELIVERED", label: "Hoàn thành" },
}
