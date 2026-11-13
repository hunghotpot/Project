import { NextResponse } from "next/server"
import { confirmRequestSchema } from "@/lib/validators/ai"
import { handleConfirm } from "@/server/ai/chat/confirm"
import { getAiStatus } from "@/server/ai/core/env"
import { getCurrentUser } from "@/server/auth/session"

// Bước 2 của tool ghi (addToCart): khách bấm "Xác nhận" trên thẻ trong chat. Route chỉ xác thực, validate rồi giao cho handler;
// userId lấy từ phiên, không bao giờ từ nội dung yêu cầu.
const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return error(401, "UNAUTHENTICATED", "Bạn cần đăng nhập để dùng trợ lý mua sắm")

  if (!getAiStatus().enabled) return error(503, "AI_DISABLED", "Trợ lý hiện chưa hoạt động. Bạn dùng ô tìm kiếm trên website nhé")

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return error(400, "INVALID_JSON", "Yêu cầu không hợp lệ")
  }
  const parsed = confirmRequestSchema.safeParse(raw)
  if (!parsed.success) return error(400, "INVALID_INPUT", "Yêu cầu không hợp lệ")

  return handleConfirm(user.id, parsed.data)
}
