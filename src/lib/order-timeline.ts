import type { OrderStatusValue } from "@/types/order"

/* Dựng timeline từ lịch sử đổi trạng thái. Hàm thuần: dùng chung server/client và test được. */

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao hàng",
  DELIVERED: "Hoàn thành",
  CANCELLED: "Đã hủy",
}

/** Tên bước trên timeline (khác nhãn trạng thái: nói về việc đã xảy ra). */
const STEP_LABEL: Record<Exclude<OrderStatusValue, "CANCELLED">, string> = {
  PENDING: "Đã đặt đơn",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao hàng",
  DELIVERED: "Hoàn thành",
}

const FLOW = ["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED"] as const

export interface HistoryEntry {
  fromStatus: OrderStatusValue | null
  toStatus: OrderStatusValue
  actorType: "CUSTOMER" | "ADMIN" | "SYSTEM"
  actorName: string | null
  note: string | null
  createdAt: Date
}

export interface TimelineStep {
  status: OrderStatusValue
  label: string
  /** done: đã qua · current: đang ở bước này · upcoming: chưa tới · cancelled: bước huỷ */
  state: "done" | "current" | "upcoming" | "cancelled"
  at: Date | null
  actor: string | null
  note: string | null
}

export const ACTOR_LABEL = { CUSTOMER: "Khách hàng", ADMIN: "Quản trị viên", SYSTEM: "Hệ thống" } as const

/**
 * Các bước PENDING → CONFIRMED → SHIPPING → DELIVERED. Mỗi bước lấy thời gian/người đổi từ lần đầu đơn vào trạng thái đó.
 * Đơn bị huỷ: giữ các bước đã đi qua, bỏ các bước chưa tới và thêm bước "Đã hủy" ở cuối.
 */
export function buildTimeline(status: OrderStatusValue, history: HistoryEntry[]): TimelineStep[] {
  const firstEntry = (s: OrderStatusValue) =>
    [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).find((h) => h.toStatus === s) ?? null
  const make = (s: OrderStatusValue, label: string, state: TimelineStep["state"]): TimelineStep => {
    const h = firstEntry(s)
    return {
      status: s,
      label,
      state,
      at: h?.createdAt ?? null,
      actor: h ? (h.actorName ?? ACTOR_LABEL[h.actorType]) : null,
      note: h?.note ?? null,
    }
  }

  if (status === "CANCELLED") {
    const reached = FLOW.filter((s) => firstEntry(s))
    return [
      ...reached.map((s) => make(s, STEP_LABEL[s], "done")),
      make("CANCELLED", ORDER_STATUS_LABEL.CANCELLED, "cancelled"),
    ]
  }

  const currentIndex = FLOW.indexOf(status)
  return FLOW.map((s, i) => make(s, STEP_LABEL[s], i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"))
}

/** Đơn còn huỷ được không (khớp luật trong order.service). */
export const canCancelStatus = (status: OrderStatusValue) => status === "PENDING" || status === "CONFIRMED"
