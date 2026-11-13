import { getAiStatus } from "@/server/ai/core/env"
import { handleChat } from "@/server/ai/chat/handler"
import { createChatTools } from "@/server/ai/tools"
import { chatRequestSchema } from "@/lib/validators/ai"
import { parseChatEventLine } from "@/lib/ai/chat-events"
import { describeShownCards } from "@/lib/ai/chat-client"
import type { MessagePart } from "@/types/assistant"
import { createRateLimiter } from "@/server/ai/core/rate-limit"
import { db } from "@/server/db"

/*
 * npm run ai:chat-check                       chạy bộ câu hỏi mẫu qua handleChat với Ollama thật, in tool đã gọi và câu trả lời
 * npm run ai:chat-check -- "câu hỏi của bạn"  chạy một câu
 * Cần Ollama chạy, DB đã nạp dữ liệu, AI_ENABLED=true (đặt trong lệnh, không sửa .env). Dùng tài khoản khách mẫu của seed.
 * Không nằm trong `npm test` vì gọi model thật.
 */

/** Mỗi ca: câu hỏi và tool BẮT BUỘC phải được gọi (rỗng = không được gọi tool nào, null = chỉ xem, không chấm). */
const CASES: { q: string; expect: string[] | null }[] = [
  { q: "tìm cho mình áo sơ mi nam màu trắng dưới 500k", expect: ["searchProducts"] },
  { q: "áo sơ mi poplin công sở mình cao 1m70 nặng 65kg thì mặc size gì", expect: ["getSizeRecommendation"] },
  { q: "mình cao 1m65 nặng 55kg mặc quần jeans nữ size nào", expect: ["getSizeRecommendation"] },
  { q: "lọc giúp mình đồ nam size M dưới 500k", expect: ["applyFilters"] },
  { q: "giỏ hàng của mình đang có gì", expect: ["viewCart"] },
  { q: "đơn hàng gần nhất của mình đang ở đâu", expect: ["getOrderStatus"] },
  { q: "mở giỏ hàng giúp mình", expect: ["openCart"] },
  { q: "đưa mình tới trang thanh toán", expect: ["navigate"] },
  { q: "áo sơ mi linen giặt thế nào", expect: [] },
  { q: "thêm áo sơ mi poplin công sở size M màu trắng vào giỏ giúp mình", expect: ["addToCart"] },
  { q: "cho mình mua 2 áo sơ mi poplin công sở", expect: [] }, // thiếu size và màu: phải hỏi lại, chưa gọi tool
  { q: "đặt hàng giúp mình luôn đi", expect: [] },
  { q: "phối cho mình bộ đồ đi làm cho nữ", expect: ["getOutfitSuggestion"] },
  { q: "gợi ý outfit đi biển cho nam dưới 1 triệu", expect: ["getOutfitSuggestion"] },
  { q: "hôm nay giá vàng bao nhiêu", expect: [] },
]

async function main(): Promise<number> {
  const status = getAiStatus()
  if (!status.enabled) {
    console.error("AI chưa bật. Chạy với AI_ENABLED=true (xem docs/ai/07-env-and-setup.md).")
    return 1
  }
  const customer = await db.user.findUnique({ where: { email: "customer@example.com" }, select: { id: true } })
  if (!customer) {
    console.error("Không thấy tài khoản khách mẫu (npm run db:seed).")
    return 1
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
  // --convo "câu 1" "câu 2" …: một hội thoại nhiều lượt, mỗi lượt gửi kèm lịch sử (lời của khách và câu trả lời của trợ lý như khung chat thật).
  const convo = process.argv.includes("--convo")
  const history: { role: "user" | "assistant"; text: string; shown?: string[] }[] = []
  const single = convo ? "" : args.join(" ").trim()
  const cases: typeof CASES = convo ? args.map((q) => ({ q, expect: null })) : single ? [{ q: single, expect: null }] : CASES
  const limiter = createRateLimiter(undefined)
  const scored = cases.filter((c) => c.expect)
  let failed = 0

  for (const c of cases) {
    const called: string[] = []
    const tools = (ctx: Parameters<typeof createChatTools>[0]) => {
      const set = createChatTools(ctx)
      for (const [name, def] of Object.entries(set)) {
        const original = def.execute as unknown as (input: unknown, options: unknown) => Promise<unknown>
        ;(def as unknown as { execute: typeof original }).execute = async (input, options) => {
          called.push(name)
          const out = await original(input, options)
          console.log(`   · ${name}(${JSON.stringify(input)}) → ${JSON.stringify(out).slice(0, 160)}`)
          return out
        }
      }
      return set
    }

    const started = Date.now()
    const parsed = chatRequestSchema.parse({ messages: [...history, { role: "user", text: c.q }] })
    const res = await handleChat(customer.id, parsed, { ...status.config, rateLimitPerMinute: 10_000 }, { limiter, tools })
    console.log(`\n? ${c.q}`)
    if (!res.ok) {
      console.log(`   ✗ HTTP ${res.status}: ${await res.text()}`)
      failed++
      continue
    }
    const events = (await res.text()).split("\n").flatMap((l) => parseChatEventLine(l) ?? [])
    const text = events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("")
    const cards = events.filter((e) => e.type !== "text").map((e) => (e.type === "ui" ? `ui:${e.action.type}` : e.type))
    console.log(`   → ${text.replace(/\s+/g, " ").trim()}`)
    // Như khung chat thật: gửi kèm mô tả các thẻ đã hiện (dấu vết tool) cho lượt sau.
    const parts = events.flatMap<MessagePart>((e) =>
      e.type === "products" ? [{ type: "products" as const, items: e.items }]
      : e.type === "confirm" ? [{ type: "confirm" as const, data: e.data }]
      : e.type === "outfit" ? [{ type: "outfit" as const, data: e.data }]
      : e.type === "size" ? [{ type: "size" as const, data: e.advice }]
      : [],
    )
    const shown = describeShownCards(parts)
    history.push({ role: "user", text: c.q }, { role: "assistant", text: text.trim() || "(không có chữ)", ...(shown.length ? { shown } : {}) } as (typeof history)[number])
    console.log(`   thẻ/hành động: ${cards.join(", ") || "(không)"} · ${((Date.now() - started) / 1000).toFixed(1)}s`)

    if (c.expect) {
      const ok = c.expect.length === 0 ? called.length === 0 : c.expect.every((t) => called.includes(t))
      console.log(`   ${ok ? "✓" : "✗"} tool gọi: [${called.join(", ")}] · cần: [${c.expect.join(", ")}]`)
      if (!ok) failed++
    }
  }

  if (!single && !convo) console.log(`\n${scored.length - failed}/${scored.length} ca gọi đúng tool`)
  await db.$disconnect()
  return failed === 0 ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
