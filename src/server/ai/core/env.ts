import "server-only"
import { z } from "zod"

/*
 * Cấu hình AI đọc từ biến môi trường `AI_*` qua MỘT module (docs/ai/07-env-and-setup.md).
 * Thiếu hoặc sai cấu hình ⇒ AI tự tắt (enabled: false kèm lý do), không ném lỗi, không làm hỏng build hay trang web.
 * Hiện chỉ hỗ trợ Ollama chạy local (đã chốt 2026-11-13).
 */

const positiveInt = z.coerce.number().int().positive()

const envSchema = z.object({
  AI_PROVIDER: z.literal("ollama"),
  AI_BASE_URL: z.url().default("http://localhost:11434"),
  AI_CHAT_MODEL: z.string().min(1),
  AI_FAST_MODEL: z.string().min(1).optional(),
  AI_EMBEDDING_PROVIDER: z.literal("ollama"),
  AI_EMBEDDING_MODEL: z.string().min(1),
  AI_EMBEDDING_DIMENSIONS: positiveInt,
  AI_REQUEST_TIMEOUT_MS: positiveInt.default(60_000),
  AI_MAX_INPUT_CHARS: positiveInt.default(1000),
  AI_MAX_OUTPUT_TOKENS: positiveInt.default(800),
  AI_MAX_TOOL_STEPS: positiveInt.default(3),
  AI_RATE_LIMIT_PER_MINUTE: positiveInt.optional(),
  AI_DAILY_TOKEN_BUDGET_PER_USER: positiveInt.optional(),
  AI_DAILY_TOKEN_BUDGET_TOTAL: positiveInt.optional(),
  AI_LOG_LEVEL: z.enum(["0", "1", "2"]).default("0"),
})

export interface AiConfig {
  provider: "ollama"
  baseUrl: string
  chatModel: string
  /** Model rẻ cho bước trích bộ lọc; mặc định dùng chung model chat. */
  fastModel: string
  embeddingModel: string
  /** Phải khớp N của cột `vector(N)` trong DB. */
  embeddingDimensions: number
  timeoutMs: number
  maxInputChars: number
  maxOutputTokens: number
  maxToolSteps: number
  rateLimitPerMinute?: number
  dailyTokenBudgetPerUser?: number
  dailyTokenBudgetTotal?: number
  logLevel: 0 | 1 | 2
}

export type AiStatus = { enabled: true; config: AiConfig } | { enabled: false; reason: string }

type Env = Record<string, string | undefined>

/** Hàm thuần (nhận env), để test không đụng `process.env`. Chuỗi rỗng coi như chưa đặt. */
export function parseAiEnv(env: Env): AiStatus {
  if (env.AI_ENABLED !== "true") return { enabled: false, reason: "AI_ENABLED không phải true" }

  const raw = Object.fromEntries(
    Object.entries(env).filter(([key, value]) => key.startsWith("AI_") && value !== undefined && value.trim() !== ""),
  )
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    return { enabled: false, reason: `Cấu hình AI chưa hợp lệ (${detail})` }
  }

  const e = parsed.data
  return {
    enabled: true,
    config: {
      provider: e.AI_PROVIDER,
      baseUrl: e.AI_BASE_URL.replace(/\/+$/, ""),
      chatModel: e.AI_CHAT_MODEL,
      fastModel: e.AI_FAST_MODEL ?? e.AI_CHAT_MODEL,
      embeddingModel: e.AI_EMBEDDING_MODEL,
      embeddingDimensions: e.AI_EMBEDDING_DIMENSIONS,
      timeoutMs: e.AI_REQUEST_TIMEOUT_MS,
      maxInputChars: e.AI_MAX_INPUT_CHARS,
      maxOutputTokens: e.AI_MAX_OUTPUT_TOKENS,
      maxToolSteps: e.AI_MAX_TOOL_STEPS,
      rateLimitPerMinute: e.AI_RATE_LIMIT_PER_MINUTE,
      dailyTokenBudgetPerUser: e.AI_DAILY_TOKEN_BUDGET_PER_USER,
      dailyTokenBudgetTotal: e.AI_DAILY_TOKEN_BUDGET_TOTAL,
      logLevel: Number(e.AI_LOG_LEVEL) as 0 | 1 | 2,
    },
  }
}

let cached: AiStatus | undefined

/** Trạng thái AI của tiến trình hiện tại (đọc `process.env` một lần). */
export function getAiStatus(): AiStatus {
  cached ??= parseAiEnv(process.env)
  return cached
}
