import "server-only"
import { stepCountIs, streamText, type LanguageModel, type ToolSet } from "ai"
import { CHAT_STREAM_CONTENT_TYPE, encodeChatEvent, type ChatEvent } from "@/lib/ai/chat-events"
import type { ChatRequest } from "@/lib/validators/ai"
import { searchKnowledge, type KnowledgeHit } from "../advisor/knowledge.service"
import { getConfirmationStore, type ConfirmationStore } from "../core/confirmations"
import type { AiConfig } from "../core/env"
import { getBreaker } from "../core/breaker"
import { buildLogRow, traceTools, type ToolTrace, type TurnStatus } from "../core/log"
import { writeChatLog, type ChatLogSink } from "../core/log-store"
import { createAiModels, CHAT_PROVIDER_OPTIONS } from "../core/models"
import { getAiRateLimiter, type AiRateLimiter } from "../core/rate-limit"
import { redactText } from "../core/redact"
import { createChatTools, type ToolContext } from "../tools"
import { BARE_CONFIRMATION_REPLY, CLAIM_FALLBACK, detectUngroundedClaim, isBareConfirmation, isOutfitPlan, outfitReplyText, retryPlanFor, type RetryPlan } from "./claims"
import { buildSystemPrompt } from "./prompts"
import { createLeadRepair } from "./text-repair"

/*
 * Xử lý một lượt chat (docs/ai/05-safety-and-guardrails.md, bản tối thiểu): giới hạn độ dài, tốc độ, ngân sách token,
 * che PII trong lịch sử, gọi model (kèm tập tool đóng) có timeout, trả luồng sự kiện NDJSON (chữ, thẻ, hành động giao diện; xem
 * `src/lib/ai/chat-events.ts`). Không đọc cookie: route đã xác thực và truyền `userId` vào.
 * Câu trả lời không gọi tool mà khẳng định điều cần bằng chứng (đã có thẻ xác nhận, giá, size) bị giữ lại và kiểm bởi `claims.ts`.
 * Lỗi trước khi có sự kiện đầu tiên trả về mã HTTP đúng (giao diện hiện thông báo thân thiện), không trả luồng rỗng.
 */

const DEFAULT_RATE_LIMIT_PER_MINUTE = 10
const DEFAULT_MAX_TOOL_STEPS = 3
/** Thấp để model 4B chọn và gọi tool ổn định hơn (mặc định của Ollama 0,8 làm nó hay bỏ qua tool). */
const CHAT_TEMPERATURE = 0.1
/** Số lần thử lại tối đa của cổng kiểm chứng (claims.ts) khi lượt đầu không gọi tool mà cần bằng chứng. */
const MAX_RETRIES = 2
/** Số câu gần nhất của khách đưa cho tool (nhớ điều đã nói ở lượt trước). */
const RECENT_USER_TURNS = 3
const WINDOW_SECONDS = 60
/** Số lượt gần nhất gửi lên model (docs/ai/05 mục 4). */
const MAX_CONTEXT_MESSAGES = 20
/**
 * Tổng số ký tự lịch sử gửi lên: chỉ dẫn + kiến thức (~5.000 ký tự) + lịch sử phải nằm gọn trong num_ctx 8192 token của model,
 * nên lượt cũ nhất bị bỏ trước. Lượt cuối của người dùng luôn được giữ.
 */
const MAX_CONTEXT_CHARS = 6000

export interface ChatDeps {
  limiter?: AiRateLimiter
  /** Chỉ dùng trong test để thay model thật. */
  model?: LanguageModel
  /** Chỉ dùng trong test để thay bước truy xuất kiến thức. */
  retrieve?: (query: string, config: AiConfig) => Promise<KnowledgeHit[]>
  /** Chỉ dùng trong test để thay kho xác nhận (mặc định là kho dùng chung, Redis hoặc bộ nhớ). */
  confirmations?: ConfirmationStore
  /** Chỉ dùng trong test để thay tập tool (mặc định là tập tool đóng của trợ lý). */
  tools?: (ctx: ToolContext) => ToolSet
  /** Chỉ dùng trong test để thay nơi ghi nhật ký (mặc định ghi vào bảng AiChatLog). */
  log?: ChatLogSink
}

/** Giữ các lượt gần nhất cho tới khi hết ngân sách ký tự (luôn giữ ít nhất lượt cuối). */
function fitContext<T extends { content: string }>(messages: T[]): T[] {
  const kept: T[] = []
  let used = 0
  for (const m of [...messages].reverse()) {
    if (kept.length > 0 && used + m.content.length > MAX_CONTEXT_CHARS) break
    kept.unshift(m)
    used += m.content.length
  }
  return kept
}

const json = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...headers } })

export async function handleChat(userId: string, input: ChatRequest, config: AiConfig, deps: ChatDeps = {}): Promise<Response> {
  const limiter = deps.limiter ?? getAiRateLimiter()

  const tooLong = input.messages.some((m) => m.role === "user" && m.text.length > config.maxInputChars)
  if (tooLong) return json(400, "MESSAGE_TOO_LONG", `Tin nhắn dài quá ${config.maxInputChars} ký tự, bạn rút gọn lại nhé`)

  const limit = config.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE
  const rate = await limiter.consume(`chat:${userId}`, limit, WINDOW_SECONDS)
  if (!rate.allowed) {
    return json(429, "RATE_LIMITED", `Bạn nhắn hơi nhanh, thử lại sau ${rate.retryAfterSeconds} giây nhé`, {
      "Retry-After": String(rate.retryAfterSeconds),
    })
  }

  if (config.dailyTokenBudgetPerUser && (await limiter.tokensUsedToday(userId)) >= config.dailyTokenBudgetPerUser) {
    return json(429, "BUDGET_EXCEEDED", "Hôm nay bạn đã trò chuyện khá nhiều rồi, mai quay lại nhé. Bạn vẫn có thể dùng ô tìm kiếm trên website")
  }

  // Trần token cả hệ thống mỗi ngày (bảo vệ máy chạy model khỏi bị dùng quá tải); tắt khi không đặt AI_DAILY_TOKEN_BUDGET_TOTAL.
  if (config.dailyTokenBudgetTotal && (await limiter.totalTokensToday()) >= config.dailyTokenBudgetTotal) {
    return json(429, "BUDGET_EXCEEDED_GLOBAL", "Trợ lý hôm nay đã đạt giới hạn sử dụng, mai quay lại nhé. Bạn vẫn có thể dùng ô tìm kiếm trên website")
  }

  // Model chat lỗi liên tiếp: không bắt khách chờ hết timeout, trả ngay 503 (giao diện hiện thông báo, ô tìm kiếm vẫn dùng được).
  // Đặt SAU các kiểm tra 400/429 để yêu cầu bị từ chối không lấy mất lượt thăm dò; lượt "xác nhận" gõ tay không gọi model nên không qua cổng.
  const breaker = getBreaker("chat")
  if (!isBareConfirmation(input.messages[input.messages.length - 1].text)) {
    const gate = breaker.allow()
    if (!gate.allowed) {
      return json(503, "AI_TEMPORARILY_UNAVAILABLE", "Trợ lý đang tạm nghỉ một lát. Bạn dùng ô tìm kiếm ở trang sản phẩm trong lúc chờ nhé", {
        "Retry-After": String(gate.retryAfterSeconds),
      })
    }
  }

  const messages = fitContext(input.messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({ role: m.role, content: redactText(m.text, 4000) })))

  // Truy xuất kiến thức theo câu hỏi cuối. Lỗi hoặc không có đoạn đủ gần thì chat vẫn chạy, không có khối kiến thức
  // (trợ lý khi đó phải nói chưa có thông tin về chăm sóc, size, chính sách).
  let knowledge: KnowledgeHit[] = []
  try {
    knowledge = await (deps.retrieve ?? searchKnowledge)(input.messages[input.messages.length - 1].text, config)
  } catch (e) {
    console.warn("[ai] truy xuất kiến thức lỗi, trả lời không có kiến thức:", e instanceof Error ? e.message : e)
  }

  const startedAt = Date.now()
  // Số liệu cho nhật ký (core/log.ts): tool đã gọi, token, thời điểm chữ đầu tiên, câu trả lời, can thiệp của cổng kiểm chứng.
  const traces: ToolTrace[] = []
  let tokensIn = 0
  let tokensOut = 0
  let ttftMs: number | undefined
  let replyText = ""
  let claimSeen: string | undefined
  let retries = 0
  let status: TurnStatus = "ok"
  const encoder = new TextEncoder()
  const abort = new AbortController()
  let streamError: unknown
  let wrote = false
  let closed = false
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let resolveFirst!: (ok: boolean) => void
  /** Có sự kiện đầu tiên (chữ, thẻ hoặc hành động) hay chưa; false = kết thúc mà không có gì. */
  const first = new Promise<boolean>((resolve) => (resolveFirst = resolve))

  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      closed = true
      abort.abort()
    },
  })
  // Model 4B thỉnh thoảng bỏ chữ "m" đầu câu ("ình không thể…"): sửa ở mẩu chữ đầu tiên của câu trả lời (xem text-repair.ts).
  const lead = createLeadRepair()
  const write = (event: ChatEvent) => {
    if (closed) return
    if (event.type === "text") {
      const delta = lead.push(event.delta)
      if (!delta) return
      event = { ...event, delta }
      replyText += delta
    }
    controller.enqueue(encoder.encode(encodeChatEvent(event)))
    if (!wrote) {
      wrote = true
      resolveFirst(true)
    }
  }
  const finish = () => {
    if (closed) return
    const rest = lead.flush()
    if (rest) write({ type: "text", delta: rest })
    closed = true
    resolveFirst(wrote)
    controller.close()
  }

  const maxToolSteps = config.maxToolSteps ?? DEFAULT_MAX_TOOL_STEPS
  const model = deps.model ?? createAiModels(config).chat
  // Thẻ trợ lý đã hiện ở lượt ngay trước (khách có thể đang nhắc tới: "cái đầu tiên", "thêm đi"); chỉ lấy khi tin nhắn kề trước là của trợ lý.
  const prev = input.messages[input.messages.length - 2]
  const shown = prev?.role === "assistant" ? (prev.shown ?? []) : []
  const baseInstructions = buildSystemPrompt(knowledge, shown)
  // Tool dùng userId đã xác thực từ route; `emit` đẩy thẻ và hành động giao diện vào cùng luồng với chữ.
  const tools = traceTools((deps.tools ?? createChatTools)({
    userId,
    userText: input.messages[input.messages.length - 1].text,
    userHistory: input.messages.filter((m) => m.role === "user").slice(-RECENT_USER_TURNS).map((m) => m.text),
    config,
    emit: write,
    confirmations: deps.confirmations ?? getConfirmationStore(),
  }), traces)

  /**
   * Một lần gọi model. Chữ được GIỮ LẠI cho tới khi biết lượt này có gọi tool hay không (để cổng kiểm chứng xem được trước khi
   * khách thấy); khi tool được gọi thì chữ chảy thẳng ra như thường. `retry` thu hẹp tập tool và nhắc việc cần làm.
   */
  async function attempt(retry?: RetryPlan): Promise<{ held: string[]; usedTools: boolean }> {
    const held: string[] = []
    let usedTools = false
    const result = streamText({
      model,
      instructions: baseInstructions + (retry?.note ?? ""),
      // Yêu cầu tự đủ nghĩa thì lần thử lại chỉ gửi câu hỏi cuối của khách (xem `RetryPlan.standalone`).
      messages: retry?.standalone ? messages.slice(-1) : messages,
      tools,
      // Bước cuối bắt buộc trả lời bằng chữ để lượt nào cũng có câu kết: bỏ hết tool khỏi yêu cầu (không dùng toolChoice vì
      // Ollama không hỗ trợ và provider bỏ qua tuỳ chọn đó). Lần thử lại chỉ giữ các tool trong `retry.tools`.
      stopWhen: stepCountIs(maxToolSteps + 1),
      prepareStep: ({ stepNumber }) =>
        stepNumber >= maxToolSteps ? { activeTools: [] } : retry ? { activeTools: retry.tools as never } : undefined,
      maxOutputTokens: config.maxOutputTokens,
      temperature: CHAT_TEMPERATURE,
      providerOptions: CHAT_PROVIDER_OPTIONS,
      timeout: { totalMs: config.timeoutMs },
      abortSignal: abort.signal,
      onError: ({ error }) => {
        streamError = error
      },
      onFinish: ({ usage }) => {
        tokensIn += usage.inputTokens ?? 0
        tokensOut += usage.outputTokens ?? 0
        void limiter.addTokens(userId, usage.totalTokens ?? 0)
      },
    })
    try {
      for await (const part of result.fullStream) {
        if ((part.type === "tool-call" || part.type === "text-delta") && ttftMs === undefined) ttftMs = Date.now() - startedAt
        if (part.type === "tool-call") {
          usedTools = true
          for (const delta of held.splice(0)) write({ type: "text", delta })
        } else if (part.type === "text-delta" && part.text) {
          if (usedTools) write({ type: "text", delta: part.text })
          else held.push(part.text)
        } else if (part.type === "error") streamError ??= part.error
        // Đầu vào tool sai schema (model sinh sai) làm SDK báo lỗi mà không chạy tool: ghi lại tên tool, không ghi nội dung khách nhập.
        else if (part.type === "tool-error") {
          traces.push({ name: part.toolName, ok: false, code: "INVALID_INPUT", ms: 0, input: part.input })
          console.warn(`[ai] tool ${part.toolName} bị từ chối:`, part.error instanceof Error ? part.error.name : "lỗi")
        }
      }
    } catch (e) {
      streamError ??= e
    }
    return { held, usedTools }
  }

  /** Ghi nhật ký đúng một lần cho lượt này (không bao giờ ném lỗi, không chặn luồng trả lời). */
  let recorded = false
  async function record() {
    if (recorded) return
    recorded = true
    // Báo kết quả cho breaker: lỗi hạ tầng (model không kết nối được, timeout, luồng đứt) tính là lỗi; khách tự đóng trang thì không tính.
    // Lượt trả lời cố định không gọi model ("xác nhận" gõ tay) không nói gì về sức khoẻ của model.
    if (status !== "bare_confirmation") {
      if (abort.signal.aborted) {
        // khách đóng trang: không biết model khoẻ hay yếu
      } else if (streamError || !wrote) breaker.failure()
      else breaker.success()
    }
    try {
      await (deps.log ?? writeChatLog)(
        buildLogRow(config.logLevel ?? 0, {
          userId,
          model: config.chatModel ?? "unknown",
          status: streamError ? "error" : status,
          claim: claimSeen,
          retries,
          latencyMs: Date.now() - startedAt,
          ttftMs,
          tokensIn,
          tokensOut,
          tools: traces,
          error: streamError instanceof Error ? streamError.message : streamError ? String(streamError) : undefined,
          userText: input.messages[input.messages.length - 1].text,
          replyText,
        }),
      )
    } catch (e) {
      console.warn("[ai] không ghi được nhật ký chat:", e instanceof Error ? e.message : e)
    }
  }

  // Chuyển luồng của model thành các dòng sự kiện. Lỗi trước sự kiện đầu tiên → 502 bên dưới; lỗi sau đó → sự kiện "error"
  // để client giữ phần đã nhận (không dùng controller.error vì nó bỏ mất dữ liệu còn trong hàng đợi).
  void (async () => {
    // Khách chỉ gõ chữ "xác nhận": chỉ nút trên thẻ mới thêm được vào giỏ, trả lời cố định, không gọi model.
    if (isBareConfirmation(input.messages[input.messages.length - 1].text)) {
      write({ type: "text", delta: BARE_CONFIRMATION_REPLY })
      status = "bare_confirmation"
      finish()
      await record()
      return
    }
    let out = await attempt()
    // Cổng kiểm chứng (claims.ts): lượt không gọi tool mà khẳng định điều cần bằng chứng thì thử lại một lần với tool thu hẹp,
    // vẫn không có bằng chứng thì thay bằng câu trung thực. Lỗi model thì không thử lại (đã có đường 502/error).
    if (!out.usedTools && !streamError) {
      const hasKnowledge = knowledge.length > 0
      const lastAssistant = input.messages.slice(0, -1).findLast((m) => m.role === "assistant")
      const userText = input.messages[input.messages.length - 1].text
      const claim = detectUngroundedClaim(out.held.join(""), {
        hasKnowledge,
        userText,
        previousAssistant: input.messages[input.messages.length - 2]?.role === "assistant" ? lastAssistant?.text : undefined,
      })
      if (claim === "junk") {
        claimSeen = "junk"
        status = "fallback"
        out = { held: [CLAIM_FALLBACK.junk], usedTools: false }
      } else if (claim) {
        claimSeen = claim
        console.warn(`[ai] lượt này cần bằng chứng từ tool (${claim}) nhưng chưa gọi tool nào, thử lại với tool thu hẹp`)
        // Thử lại tối đa MAX_RETRIES lần: model 4B có lần vẫn bỏ qua tool dù đã thu hẹp (đo: lần đầu chưa gọi thì lần thử lại hỏng
        // khoảng một nửa); mỗi lần chỉ tốn vài giây và chỉ chạy ở đường lỗi này.
        for (let i = 0; i < MAX_RETRIES; i++) {
          retries++
          out = await attempt(retryPlanFor(claim, userText))
          if (out.usedTools || streamError) break
          const text = out.held.join("")
          // Kiểm lại chỉ bằng chữ của model. Khách đã hỏi thẳng về dữ liệu cửa hàng mà vẫn không có tool: giá, size, còn hàng trong câu
          // trả lời không thể đến từ kiến thức. Chỉ một câu HỎI LẠI ("bạn muốn sản phẩm nào?") mới hợp lệ; câu khẳng định thì không.
          if (!detectUngroundedClaim(text, { hasKnowledge: claim === "catalog" || claim === "confirmation" ? false : hasKnowledge }) && text.includes("?")) break
        }
        if (!out.usedTools && !streamError && claim === "catalog" && isOutfitPlan(retryPlanFor(claim, userText))) {
          // Tool phối đồ không cần tham số của model: model vẫn bỏ qua thì server tự chạy (thẻ bộ đồ do tool phát), câu trả lời cố định.
          const direct = (tools as Record<string, { execute?: (input: unknown, options: unknown) => Promise<unknown> }>).getOutfitSuggestion
          const result = (await direct?.execute?.({}, { toolCallId: "direct", messages: [] })) as Parameters<typeof outfitReplyText>[0]
          out = { held: [outfitReplyText(result)], usedTools: true }
        }
        if (!out.usedTools && !streamError) {
          const text = out.held.join("")
          const again = detectUngroundedClaim(text, { hasKnowledge: claim === "catalog" || claim === "confirmation" ? false : hasKnowledge })
          if (again) {
            status = "fallback"
            out = { held: [CLAIM_FALLBACK[again]], usedTools: false }
          } else if (!text.includes("?")) {
            status = "fallback"
            out = { held: [CLAIM_FALLBACK[claim]], usedTools: false }
          }
        }
      }
    }
    for (const delta of out.held) write({ type: "text", delta })
    if (wrote && streamError) {
      console.error("[ai] chat đứt giữa chừng:", streamError instanceof Error ? streamError.message : streamError)
      write({ type: "error" })
    }
    finish()
    await record()
  })().catch((e) => {
    // Lỗi bất ngờ trong xử lý (không phải lỗi model): không để luồng treo mãi, kết thúc như lỗi model (502 nếu chưa có gì).
    streamError ??= e
    finish()
    void record()
  })

  if (!(await first)) {
    console.error("[ai] chat không có phản hồi:", streamError instanceof Error ? streamError.message : streamError ?? "luồng rỗng")
    return json(502, "MODEL_UNAVAILABLE", "Trợ lý đang bận hoặc chưa phản hồi được. Bạn dùng ô tìm kiếm ở trang sản phẩm trong lúc chờ nhé")
  }

  return new Response(body, {
    headers: { "Content-Type": CHAT_STREAM_CONTENT_TYPE, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  })
}
