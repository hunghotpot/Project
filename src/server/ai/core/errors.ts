import "server-only"
import { ZodError } from "zod"
import { AddressNotFoundError } from "@/server/services/address.service"
import { AuthError } from "@/server/services/auth.service"
import { CartError } from "@/server/services/cart.service"
import { OrderError } from "@/server/services/order.service"

/**
 * Lỗi trả về cho LLM và giao diện (docs/ai/04-tool-calling.md): `{ ok: false, code, message, details? }`.
 * Không bao giờ chứa stack trace hay nội dung lỗi lạ; lỗi không nhận ra chỉ trả mã chung.
 */
export interface ToolError {
  ok: false
  code: string
  message: string
  details?: Record<string, unknown>
}

const fail = (code: string, message: string, details?: Record<string, unknown>): ToolError =>
  details ? { ok: false, code, message, details } : { ok: false, code, message }

export function toToolError(e: unknown): ToolError {
  if (e instanceof CartError) return fail(e.code, e.message, e.available === undefined ? undefined : { available: e.available })
  if (e instanceof OrderError) return fail(e.code, e.message, e.shortages ? { shortages: e.shortages } : undefined)
  if (e instanceof AuthError) return fail(e.code, e.message, e.retryAfter === undefined ? undefined : { retryAfter: e.retryAfter })
  if (e instanceof AddressNotFoundError) return fail("ADDRESS_NOT_FOUND", e.message)
  if (e instanceof ZodError) {
    // Chỉ đưa tên trường và lý do, không đưa giá trị người dùng nhập.
    const fields = e.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
    return fail("INVALID_INPUT", "Dữ liệu đầu vào không hợp lệ", { fields })
  }
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return fail("TIMEOUT", "Yêu cầu mất quá nhiều thời gian, bạn thử lại sau nhé")
  }
  return fail("INTERNAL", "Có lỗi xảy ra, bạn thử lại sau nhé")
}
