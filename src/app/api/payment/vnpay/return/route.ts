import { NextResponse, type NextRequest } from "next/server"
import { findOrderIdByCode, verifyReturn } from "@/server/services/payment.service"

// Người dùng quay về từ VNPay. CHỈ hiển thị kết quả: không ghi nhận thanh toán ở đây (việc đó của IPN).
export async function GET(req: NextRequest) {
  const home = NextResponse.redirect(new URL("/", req.url))

  let result
  try {
    result = verifyReturn(req.nextUrl.searchParams)
  } catch {
    return home // chưa cấu hình VNPay
  }
  const orderId = result.orderCode ? await findOrderIdByCode(result.orderCode) : null
  if (!orderId) return home

  if (result.success) return NextResponse.redirect(new URL(`/orders/${orderId}/success`, req.url))

  const status = result.valid ? "failed" : "invalid"
  const code = result.responseCode ? `&code=${encodeURIComponent(result.responseCode)}` : ""
  return NextResponse.redirect(new URL(`/orders/${orderId}/payment?result=${status}${code}`, req.url))
}
