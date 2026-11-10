import { NextResponse, type NextRequest } from "next/server"
import { handleIPN } from "@/server/services/payment.service"

// VNPay gọi server-to-server: nguồn sự thật để cập nhật paymentStatus. Luôn trả JSON { RspCode, Message } theo spec.
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await handleIPN(req.nextUrl.searchParams))
  } catch {
    // Không log nội dung lỗi/tham số (có thể chứa dữ liệu giao dịch); 99 để VNPay gọi lại sau.
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" })
  }
}
