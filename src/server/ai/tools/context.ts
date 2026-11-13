import "server-only"
import type { ChatEvent } from "@/lib/ai/chat-events"
import type { AiConfig } from "../core/env"
import type { ConfirmationStore } from "../core/confirmations"
import { toToolError, type ToolError } from "../core/errors"

/*
 * Ngữ cảnh dựng bởi route/handler cho mọi tool (docs/ai/04-tool-calling.md mục 1): `userId` do server xác thực,
 * KHÔNG phải tham số LLM sinh ra. `emit` đẩy thẻ hoặc hành động giao diện vào luồng trả lời (LLM không thấy nội dung đó).
 */
export interface ToolContext {
  userId: string
  /** Tin nhắn cuối của khách (đã qua kiểm tra độ dài): để tool điền các điều kiện model bỏ sót bằng code. */
  userText: string
  /** Vài câu gần đây của khách, cũ → mới, gồm cả câu cuối (để tool nhớ điều khách đã nói ở lượt trước, vd dịp đi làm rồi mới nói nữ). */
  userHistory: string[]
  /** Có cấu hình AI thì tìm kiếm dùng vector; null: chỉ từ khoá. */
  config: AiConfig | null
  emit: (event: ChatEvent) => void
  /** Kho xác nhận cho tool ghi (addToCart chỉ tạo bản ghi ở đây, không ghi giỏ). */
  confirmations: ConfirmationStore
}

/** Chạy một tool: lỗi nào cũng thành `{ ok: false, code, message }` có cấu trúc, không ném stack trace ra cho model. */
export async function runTool<T extends { ok: true }>(name: string, run: () => Promise<T | ToolError>): Promise<T | ToolError> {
  try {
    return await run()
  } catch (e) {
    const error = toToolError(e)
    if (error.code === "INTERNAL") console.error(`[ai-tool] ${name} lỗi:`, e instanceof Error ? e.message : e)
    return error
  }
}

export const notFound = (code: string, message: string, details?: Record<string, unknown>): ToolError =>
  details ? { ok: false, code, message, details } : { ok: false, code, message }

/** Cắt chữ tự do trước khi đưa cho model (mô tả, ghi chú). */
export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)
