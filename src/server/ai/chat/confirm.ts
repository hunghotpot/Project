import "server-only"
import type { ConfirmRequest } from "@/lib/validators/ai"
import { addItem, CartError } from "@/server/services/cart.service"
import { getConfirmationStore, type ConfirmationStore } from "../core/confirmations"
import { toToolError } from "../core/errors"
import { getAiRateLimiter, type AiRateLimiter } from "../core/rate-limit"

/*
 * Bước 2 của tool ghi (docs/ai/04-tool-calling.md mục 3): chỉ khách bấm "Xác nhận" trên giao diện mới tới đây, KHÔNG qua model.
 * Đây là NƠI DUY NHẤT trong tầng AI ghi vào giỏ hàng. Bản ghi chờ xác nhận được lấy ra và xoá trước khi ghi (dùng một lần, gắn
 * đúng userId, hết hạn sau 5 phút), nên bấm hai lần, phát lại hay dùng id của người khác đều không thêm được gì.
 * Không đọc cookie: route đã xác thực và truyền `userId` vào.
 */

const CONFIRM_LIMIT_PER_MINUTE = 20

export interface ConfirmDeps {
  confirmations?: ConfirmationStore
  limiter?: AiRateLimiter
  /** Chỉ dùng trong test để thay bước ghi giỏ. */
  addItem?: typeof addItem
}

const json = (status: number, body: Record<string, unknown>, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
const failure = (status: number, code: string, message: string) => json(status, { error: { code, message } })

export async function handleConfirm(userId: string, input: ConfirmRequest, deps: ConfirmDeps = {}): Promise<Response> {
  const limiter = deps.limiter ?? getAiRateLimiter()
  const rate = await limiter.consume(`confirm:${userId}`, CONFIRM_LIMIT_PER_MINUTE, 60)
  if (!rate.allowed) {
    return failure(429, "RATE_LIMITED", `Bạn thao tác hơi nhanh, thử lại sau ${rate.retryAfterSeconds} giây nhé`)
  }

  // Lấy ra và xoá ngay (nguyên tử): từ đây không ai dùng lại được id này, dù ghi giỏ thành công hay không.
  const pending = await (deps.confirmations ?? getConfirmationStore()).consume(userId, input.confirmationId)

  if (input.action === "cancel") return json(200, { ok: true, status: "cancelled" })

  if (!pending) {
    return failure(410, "CONFIRMATION_INVALID", "Yêu cầu này đã hết hạn hoặc đã được dùng rồi. Bạn nhờ trợ lý thêm lại nhé")
  }

  try {
    const cart = await (deps.addItem ?? addItem)({ userId }, pending.variantId, pending.quantity)
    return json(200, { ok: true, status: "added", itemCount: cart.itemCount, subtotal: cart.subtotal })
  } catch (e) {
    // Hết hàng, vượt tồn kho… từ cart.service: báo đúng lý do để khách biết.
    if (e instanceof CartError) return failure(409, e.code, e.message)
    const err = toToolError(e)
    console.error("[ai] xác nhận thêm vào giỏ lỗi:", e instanceof Error ? e.message : e)
    return failure(500, err.code, err.message)
  }
}
