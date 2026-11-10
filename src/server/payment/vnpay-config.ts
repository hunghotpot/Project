import "server-only"

export interface VnpayConfig {
  tmnCode: string
  hashSecret: string
  /** Cổng thanh toán: sandbox mặc định, đổi sang URL production khi chạy thật. */
  url: string
  returnUrl: string
}

/**
 * Đọc env mỗi lần gọi (không cache lúc import) để thiếu cấu hình không làm sập app, chỉ khoá phương thức VNPAY.
 * Trả null nếu chưa có VNP_TMN_CODE / VNP_HASH_SECRET.
 */
export function getVnpayConfig(): VnpayConfig | null {
  const tmnCode = process.env.VNP_TMN_CODE?.trim()
  const hashSecret = process.env.VNP_HASH_SECRET?.trim()
  if (!tmnCode || !hashSecret) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return {
    tmnCode,
    hashSecret,
    url: process.env.VNP_URL?.trim() || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    returnUrl: process.env.VNP_RETURN_URL?.trim() || `${appUrl}/api/payment/vnpay/return`,
  }
}

export const isVnpayConfigured = () => getVnpayConfig() !== null
