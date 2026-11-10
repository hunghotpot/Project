import { NextResponse, type NextRequest } from "next/server"
import { getCurrentUser } from "@/server/auth/session"
import { isVnpayConfigured } from "@/server/payment/vnpay-config"
import { OrderError } from "@/server/services/order.service"
import { getVnpayPayUrl } from "@/server/services/payment.service"

// Chuyển người dùng sang cổng VNPay (và dùng cho "Thanh toán lại"). Link ký sẵn có hạn tới hết cửa sổ 15 phút của đơn.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId") ?? ""
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/orders/${orderId}/payment`)}`, req.url))
  }

  const back = (query = "") => NextResponse.redirect(new URL(`/orders/${encodeURIComponent(orderId)}/payment${query}`, req.url))
  if (!isVnpayConfigured()) return back("?result=unconfigured")

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
  try {
    return NextResponse.redirect(await getVnpayPayUrl(user.id, orderId, ip))
  } catch (e) {
    if (e instanceof OrderError) {
      if (e.code === "ORDER_NOT_FOUND") return NextResponse.redirect(new URL("/account/profile", req.url))
      return back(e.code === "PAYMENT_EXPIRED" ? "?result=expired" : "")
    }
    throw e
  }
}
