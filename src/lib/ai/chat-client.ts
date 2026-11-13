import { formatVnd } from "@/lib/format"
import { MAX_CHAT_MESSAGE_CHARS, MAX_CHAT_MESSAGES, MAX_SHOWN_CHARS, MAX_SHOWN_ITEMS } from "@/lib/validators/ai"
import type { ChatMessage, MessagePart } from "@/types/assistant"
import { parseChatEventLine, type ChatEvent } from "./chat-events"

/*
 * Phía trình duyệt của chat: dựng lịch sử gửi lên và đọc luồng sự kiện trả về. Hàm thuần (nhận fetch từ ngoài) để test không cần DOM;
 * hook `useAssistantChat` chỉ nối vào store. Không import gì từ src/server.
 */

export const CHAT_FALLBACK_MESSAGE = "Trợ lý đang bận hoặc chưa phản hồi được. Bạn dùng ô tìm kiếm ở trang sản phẩm trong lúc chờ nhé."

const MAX_ASSISTANT_CHARS = 4000

export interface ChatTurn {
  role: "user" | "assistant"
  text: string
  /** Chỉ ở tin nhắn trợ lý CUỐI: các thẻ đã hiện kèm câu trả lời đó (xem `describeShownCards`). */
  shown?: string[]
}

const MAX_SHOWN_PRODUCTS = 6
/** Nhãn thứ tự bằng chữ: model 4B đếm "cái thứ ba", "cái cuối" hay nhầm nên ghi sẵn trong từng dòng. */
const ORDINALS = ["đầu tiên", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu"]

/**
 * Mô tả ngắn các thẻ trợ lý đã hiện (sản phẩm, size, bộ đồ, xác nhận) để gửi kèm lịch sử: câu trả lời của model thường chỉ tóm tắt và
 * để thẻ hiện danh sách, nên không có dòng này thì lượt sau ("thêm cái đầu tiên", "size M được không") model không biết đang nói tới món nào.
 */
export function describeShownCards(parts: MessagePart[]): string[] {
  const out: string[] = []
  for (const p of parts) {
    if (p.type === "products") {
      const items = p.items.slice(0, MAX_SHOWN_PRODUCTS)
      items.forEach((item, i) => {
        const last = items.length > 1 && i === items.length - 1 ? ", cái cuối cùng" : ""
        out.push(`Sản phẩm ${i + 1} (cái ${ORDINALS[i]}${last}): ${item.name} (${formatVnd(item.price)})`)
      })
    } else if (p.type === "size") {
      const d = p.data
      out.push(`Tư vấn size${d.productName ? ` cho ${d.productName}` : ""}: ${d.recommendedSize ? `size ${d.recommendedSize}` : "cần thêm số đo hoặc chưa có kết quả"}`)
    } else if (p.type === "outfit") {
      out.push(`Bộ đồ gợi ý: ${p.data.items.map((i) => `${i.name} (${i.variantLabel})`).join("; ")}`)
    } else if (p.type === "confirm") {
      const state =
        p.resolved === "added" ? "khách đã xác nhận, ĐÃ thêm vào giỏ"
        : p.resolved === "cancelled" ? "khách đã huỷ, KHÔNG thêm"
        : p.resolved === "failed" ? "KHÔNG thêm được"
        : p.resolved === "confirming" ? "khách vừa bấm xác nhận, đang xử lý"
        : "khách CHƯA bấm, chưa thêm"
      out.push(`Thẻ xác nhận thêm vào giỏ (${state}): ${p.data.lines.join("; ")}`)
    }
  }
  return out.slice(0, MAX_SHOWN_ITEMS).map((line) => line.slice(0, MAX_SHOWN_CHARS))
}

/**
 * Lịch sử gửi lên server: chỉ phần chữ của các lượt trước (bỏ lời chào mở đầu, thẻ, nút trả lời nhanh và các câu báo lỗi) cộng
 * câu vừa gõ, tối đa MAX_CHAT_MESSAGES lượt gần nhất.
 */
export function buildChatHistory(messages: ChatMessage[], userText: string): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (const m of messages) {
    if (m.id === "welcome" || m.error) continue
    const text = m.parts
      .flatMap((p) => (p.type === "text" ? [p.text] : []))
      .join("\n")
      .trim()
    if (!text) continue
    const shown = m.role === "assistant" ? describeShownCards(m.parts) : []
    turns.push({ role: m.role, text: text.slice(0, m.role === "assistant" ? MAX_ASSISTANT_CHARS : MAX_CHAT_MESSAGE_CHARS), ...(shown.length ? { shown } : {}) })
  }
  // Chỉ tin nhắn trợ lý ngay trước câu vừa gõ cần mô tả thẻ (đó là cái khách đang nhắc tới); các lượt cũ hơn bỏ đi cho gọn.
  for (const t of turns.slice(0, -1)) delete t.shown
  turns.push({ role: "user", text: userText.trim().slice(0, MAX_CHAT_MESSAGE_CHARS) })
  return turns.slice(-MAX_CHAT_MESSAGES)
}

/** Sự kiện không phải chữ (hành động giao diện, thẻ sản phẩm, thẻ size) mà server đã gửi trong lượt trả lời. */
export type ChatCardEvent = Exclude<ChatEvent, { type: "text" } | { type: "error" }>

export type ChatReply = { ok: true; text: string; events: ChatCardEvent[] } | { ok: false; message: string }

/**
 * Gọi `/api/ai/chat` và đọc luồng sự kiện NDJSON (xem `chat-events.ts`): chữ báo qua `onText` (toàn bộ chữ tới lúc này), mỗi
 * hành động hoặc thẻ báo qua `onEvent` ngay khi tới. Dòng hỏng hoặc không đúng schema bị bỏ qua. Mọi lỗi (mạng, mã HTTP lỗi,
 * luồng không có gì) trả về `{ ok: false, message }` với câu thân thiện; luồng đứt giữa chừng thì giữ phần đã nhận.
 */
export async function requestChatReply(
  turns: ChatTurn[],
  options: { onText: (textSoFar: string) => void; onEvent?: (event: ChatCardEvent) => void; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<ChatReply> {
  const fail = (message = CHAT_FALLBACK_MESSAGE): ChatReply => ({ ok: false, message })

  let res: Response
  try {
    res = await (options.fetchImpl ?? fetch)("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: turns }),
      signal: options.signal,
    })
  } catch {
    return fail()
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    const message = (body as { error?: { message?: unknown } } | null)?.error?.message
    return fail(typeof message === "string" && message ? message : CHAT_FALLBACK_MESSAGE)
  }
  if (!res.body) return fail()

  let text = ""
  const events: ChatCardEvent[] = []
  const handleLine = (line: string) => {
    const event = parseChatEventLine(line)
    if (!event || event.type === "error") return
    if (event.type === "text") {
      text += event.delta
      options.onText(text)
    } else {
      events.push(event)
      options.onEvent?.(event)
    }
  }
  const result = (): ChatReply => (text.trim() || events.length > 0 ? { ok: true, text, events } : fail())

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      lines.forEach(handleLine)
    }
    buffer += decoder.decode()
    handleLine(buffer)
  } catch {
    return result()
  }
  return result()
}

export type ConfirmOutcome = { ok: true; status: "added" | "cancelled" } | { ok: false; message: string }

/**
 * Bước 2 của tool ghi: khách bấm nút trên thẻ xác nhận thì gọi `/api/ai/confirm` (KHÔNG qua model). Mọi lỗi trả về
 * `{ ok: false, message }` với câu thân thiện (hết hạn, hết hàng, mất mạng…).
 */
export async function requestConfirm(
  confirmationId: string,
  action: "confirm" | "cancel",
  fetchImpl: typeof fetch = fetch,
): Promise<ConfirmOutcome> {
  let res: Response
  try {
    res = await fetchImpl("/api/ai/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationId, action }),
    })
  } catch {
    return { ok: false, message: "Mất kết nối nên mình chưa thực hiện được. Bạn thử lại nhé." }
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (body as { error?: { message?: unknown } } | null)?.error?.message
    return { ok: false, message: typeof message === "string" && message ? message : "Mình chưa thực hiện được lúc này. Bạn thử lại sau nhé." }
  }
  const status = (body as { status?: unknown } | null)?.status
  if (status === "added" || status === "cancelled") return { ok: true, status }
  return { ok: false, message: "Mình chưa thực hiện được lúc này. Bạn thử lại sau nhé." }
}
