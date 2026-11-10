// Hằng số/hàm thuần về đơn hàng, dùng chung server/client.

export const PAYMENT_METHODS = ["COD", "BANK_TRANSFER", "VNPAY"] as const
export type CheckoutPaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Phương thức đặt được. VNPAY còn cần cấu hình VNP_* (xem isVnpayConfigured) — kiểm ở tầng gọi. */
export const SUPPORTED_PAYMENT_METHODS: readonly CheckoutPaymentMethod[] = ["COD", "BANK_TRANSFER", "VNPAY"]

/** Đơn VNPAY chưa thanh toán sau chừng này phút sẽ bị huỷ và hoàn tồn kho (cũng là hạn của link thanh toán). */
export const PAYMENT_WINDOW_MINUTES = 15

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "Thanh toán khi nhận hàng (COD)",
  BANK_TRANSFER: "Chuyển khoản Ngân hàng / VietQR",
  VNPAY: "Thẻ Tín dụng / Ghi nợ (VNPAY)",
  MOMO: "Ví MoMo",
}

/** Nhãn ngắn của phương thức thanh toán (thẻ đơn hàng). */
export const PAYMENT_METHOD_SHORT: Record<string, string> = {
  COD: "COD",
  BANK_TRANSFER: "Chuyển khoản VietQR",
  VNPAY: "VNPay",
  MOMO: "MoMo",
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Ngày theo giờ Việt Nam dạng YYYYMMDD (khoá của bộ đếm số thứ tự). */
export function orderDayKey(date: Date): string {
  return DAY_FORMAT.format(date).replaceAll("-", "")
}

/** (20261109, 1) → "FS-20261109-0001". */
export function formatOrderCode(day: string, sequence: number): string {
  return `FS-${day}-${String(sequence).padStart(4, "0")}`
}

/** Nội dung chuyển khoản: mã đơn bỏ dấu gạch (ngân hàng thường không nhận ký tự đặc biệt). */
export function transferContent(orderCode: string): string {
  return orderCode.replaceAll("-", "")
}

