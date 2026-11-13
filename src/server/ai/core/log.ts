import type { ToolSet } from "ai"
import { redactForPrompt, redactText } from "./redact"

/*
 * Nhật ký một lượt chat (docs/ai/05-safety-and-guardrails.md mục 7). Phần này THUẦN (không đụng DB) để test được:
 *  - mức 0: số liệu kỹ thuật + tên tool/kết quả (luôn ghi);
 *  - mức 1: thêm tham số tool đã che PII (không có nội dung tin nhắn);
 *  - mức 2: thêm toàn văn câu hỏi và câu trả lời (đã che email/SĐT/token), chỉ dùng khi gỡ lỗi hoặc đánh giá.
 * Ghi vào DB nằm ở `log-store.ts`.
 */

export type LogLevel = 0 | 1 | 2

export interface ToolTrace {
  name: string
  ok: boolean
  /** Mã lỗi có cấu trúc của tool (NEED_SIZE_OR_COLOR, INVALID_INPUT...), có khi ok = false. */
  code?: string
  ms: number
  /** Tham số model đã gửi; chỉ vào log từ mức 1. */
  input?: unknown
}

export type TurnStatus = "ok" | "fallback" | "error" | "bare_confirmation"

export interface TurnLog {
  userId: string
  model: string
  status: TurnStatus
  claim?: string
  retries: number
  latencyMs: number
  ttftMs?: number
  tokensIn: number
  tokensOut: number
  tools: ToolTrace[]
  error?: string
  userText: string
  replyText: string
}

/** Dòng ghi vào bảng `AiChatLog` (khớp prisma/schema.prisma). */
export interface ChatLogRow {
  userId: string
  level: LogLevel
  model: string
  status: TurnStatus
  claim: string | null
  retries: number
  latencyMs: number
  ttftMs: number | null
  tokensIn: number
  tokensOut: number
  tools: { name: string; ok: boolean; code?: string; ms: number }[]
  params: { name: string; input: unknown }[] | null
  error: string | null
  userText: string | null
  replyText: string | null
}

const MAX_LOGGED_TEXT = 4000

/** Áp quy tắc mức log: phần nào được phép lưu ở mức này. */
export function buildLogRow(level: LogLevel, turn: TurnLog): ChatLogRow {
  return {
    userId: turn.userId,
    level,
    model: turn.model,
    status: turn.status,
    claim: turn.claim ?? null,
    retries: turn.retries,
    latencyMs: Math.round(turn.latencyMs),
    ttftMs: turn.ttftMs === undefined ? null : Math.round(turn.ttftMs),
    tokensIn: turn.tokensIn,
    tokensOut: turn.tokensOut,
    tools: turn.tools.map((t) => ({ name: t.name, ok: t.ok, ...(t.code ? { code: t.code } : {}), ms: Math.round(t.ms) })),
    params: level >= 1 ? turn.tools.map((t) => ({ name: t.name, input: redactForPrompt(t.input ?? null) })) : null,
    // Thông báo lỗi chỉ lấy dòng đầu và che PII: có thể chứa địa chỉ nội bộ nhưng không chứa nội dung khách.
    error: turn.error ? redactText(turn.error.split("\n")[0], 300) : null,
    userText: level >= 2 ? redactText(turn.userText, MAX_LOGGED_TEXT) : null,
    replyText: level >= 2 ? redactText(turn.replyText, MAX_LOGGED_TEXT) : null,
  }
}

/** Mã lỗi của kết quả tool dạng `{ ok: false, code }`; undefined nếu tool thành công. */
function failureOf(result: unknown): { ok: boolean; code?: string } {
  if (result && typeof result === "object" && "ok" in result && (result as { ok: unknown }).ok === false) {
    const code = (result as { code?: unknown }).code
    return { ok: false, code: typeof code === "string" ? code : undefined }
  }
  return { ok: true }
}

/**
 * Bọc mọi tool để ghi lại tên, tham số, kết quả (ok hay mã lỗi) và thời gian vào `traces`. Không đổi hành vi của tool:
 * kết quả và lỗi ném ra giữ nguyên.
 */
export function traceTools(tools: ToolSet, traces: ToolTrace[]): ToolSet {
  const wrapped: ToolSet = {}
  for (const [name, def] of Object.entries(tools)) {
    const execute = def.execute
    if (!execute) {
      wrapped[name] = def
      continue
    }
    wrapped[name] = {
      ...def,
      execute: async (input: unknown, options: never) => {
        const started = Date.now()
        try {
          const result = await (execute as (i: unknown, o: unknown) => Promise<unknown>)(input, options)
          traces.push({ name, ...failureOf(result), ms: Date.now() - started, input })
          return result
        } catch (e) {
          traces.push({ name, ok: false, code: "THROWN", ms: Date.now() - started, input })
          throw e
        }
      },
    } as ToolSet[string]
  }
  return wrapped
}
