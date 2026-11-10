import { timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { expireUnpaidVnpayOrders } from "@/server/services/payment.service"

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // chưa đặt secret thì route bị khoá hoàn toàn
  const given = Buffer.from(req.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

// Huỷ đơn VNPAY quá hạn thanh toán + hoàn tồn kho. Gọi định kỳ (cron/scheduler): GET kèm "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await expireUnpaidVnpayOrders())
}
