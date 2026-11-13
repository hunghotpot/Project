import { NextResponse } from "next/server"
import { chatRequestSchema } from "@/lib/validators/ai"
import { handleChat } from "@/server/ai/chat/handler"
import { getAiStatus } from "@/server/ai/core/env"
import { getCurrentUser } from "@/server/auth/session"

// Route AI là nơi duy nhất đọc cookie/phiên (docs/ai/05 mục 3): xác thực, kiểm cờ AI, validate Zod rồi giao cho handler.
const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request) {
  // Khách chưa đăng nhập không dùng được trợ lý.
  const user = await getCurrentUser()
  if (!user) return error(401, "UNAUTHENTICATED", "Bạn cần đăng nhập để dùng trợ lý mua sắm")

  const status = getAiStatus()
  if (!status.enabled) return error(503, "AI_DISABLED", "Trợ lý hiện chưa hoạt động. Bạn dùng ô tìm kiếm trên website nhé")

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return error(400, "INVALID_JSON", "Yêu cầu không hợp lệ")
  }
  const parsed = chatRequestSchema.safeParse(raw)
  if (!parsed.success) return error(400, "INVALID_INPUT", "Tin nhắn không hợp lệ")

  // Chỉ truyền userId (không truyền role): mọi tài khoản, kể cả ADMIN, chỉ nhận quyền của khách hàng.
  return handleChat(user.id, parsed.data, status.config)
}
