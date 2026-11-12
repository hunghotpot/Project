/*
 * Hạng khách hàng (Admin). Không lưu cột: suy ra từ tổng chi tiêu của các đơn không bị huỷ.
 * Hạng "Tiềm năng" trong Figma đã bỏ.
 */

/** Tổng chi tiêu (VND) từ mức này trở lên là VIP. */
export const VIP_SPEND_THRESHOLD = 10_000_000

export type CustomerTier = "VIP" | "MEMBER"

export function customerTier(totalSpend: number): CustomerTier {
  return totalSpend >= VIP_SPEND_THRESHOLD ? "VIP" : "MEMBER"
}

export const CUSTOMER_TIER_LABEL: Record<CustomerTier, string> = {
  VIP: "VIP",
  MEMBER: "Thành viên",
}
