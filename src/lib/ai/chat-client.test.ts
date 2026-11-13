import { describe, expect, it } from "vitest"
import type { ChatMessage, MessagePart } from "@/types/assistant"
import { buildChatHistory, CHAT_FALLBACK_MESSAGE, describeShownCards, requestChatReply, requestConfirm, type ChatCardEvent } from "./chat-client"
import { encodeChatEvent, type ChatEvent } from "./chat-events"

const text = (id: string, role: ChatMessage["role"], t: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role,
  parts: [{ type: "text", text: t }],
  ...extra,
})

describe("buildChatHistory", () => {
  it("chỉ lấy phần chữ, bỏ lời chào mở đầu, thẻ, nút trả lời nhanh và câu báo lỗi, rồi thêm câu mới", () => {
    const messages: ChatMessage[] = [
      text("welcome", "assistant", "Xin chào!"),
      text("m1", "user", "Mình cao 1m70"),
      {
        id: "m2",
        role: "assistant",
        parts: [
          { type: "text", text: "Bạn nặng bao nhiêu?" },
          { type: "quickReplies", options: [{ label: "Ôm", value: "tight" }] },
        ],
      },
      text("m3", "user", "hỏi gì đó"),
      text("m4", "assistant", "Trợ lý đang bận", { error: true }),
    ]
    expect(buildChatHistory(messages, "  65kg  ")).toEqual([
      { role: "user", text: "Mình cao 1m70" },
      { role: "assistant", text: "Bạn nặng bao nhiêu?" },
      { role: "user", text: "hỏi gì đó" },
      { role: "user", text: "65kg" },
    ])
  })

  it("bỏ tin không có chữ và cắt độ dài theo từng vai", () => {
    const messages: ChatMessage[] = [
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "   " }] },
      text("m2", "assistant", "a".repeat(5000)),
    ]
    const out = buildChatHistory(messages, "b".repeat(1500))
    expect(out).toHaveLength(2)
    expect(out[0].text).toHaveLength(4000)
    expect(out[1].text).toHaveLength(1000)
  })

  it("chỉ giữ 20 lượt gần nhất", () => {
    const messages = Array.from({ length: 30 }, (_, i) => text(`m${i}`, i % 2 ? "assistant" : "user", `lượt ${i}`))
    const out = buildChatHistory(messages, "cuối")
    expect(out).toHaveLength(20)
    expect(out.at(-1)).toEqual({ role: "user", text: "cuối" })
    expect(out[0].text).toBe("lượt 11")
  })
})

const line = (e: ChatEvent) => encodeChatEvent(e)
const textLine = (delta: string) => line({ type: "text", delta })
const stream = (...chunks: (string | Uint8Array)[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder()
        for (const chunk of chunks) c.enqueue(typeof chunk === "string" ? enc.encode(chunk) : chunk)
        c.close()
      },
    }),
  )

describe("requestChatReply", () => {
  const turns = [{ role: "user" as const, text: "Chào" }]

  it("gửi đúng yêu cầu và ghép các sự kiện chữ, báo tiến độ từng mẩu", async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const seen: string[] = []
    const reply = await requestChatReply(turns, {
      onText: (t) => seen.push(t),
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return stream(textLine("Chào "), textLine("bạn!"))
      },
    })
    expect(reply).toEqual({ ok: true, text: "Chào bạn!", events: [] })
    expect(seen).toEqual(["Chào ", "Chào bạn!"])
    expect(calls[0].url).toBe("/api/ai/chat")
    expect(calls[0].init?.method).toBe("POST")
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ messages: turns })
  })

  it("báo hành động và thẻ ngay khi tới, trả lại đủ trong kết quả", async () => {
    const onEvent: ChatCardEvent[] = []
    const reply = await requestChatReply(turns, {
      onText: () => {},
      onEvent: (e) => onEvent.push(e),
      fetchImpl: async () => stream(line({ type: "ui", action: { type: "openCart" } }), textLine("Đã mở giỏ"), line({ type: "products", items: [] })),
    })
    expect(onEvent).toEqual([{ type: "ui", action: { type: "openCart" } }, { type: "products", items: [] }])
    expect(reply).toEqual({ ok: true, text: "Đã mở giỏ", events: onEvent })
  })

  it("một dòng bị cắt giữa hai mẩu mạng, kể cả giữa ký tự tiếng Việt 2 byte, vẫn ghép đúng", async () => {
    const bytes = new TextEncoder().encode(textLine("Xin chào bạn"))
    const cut = bytes.indexOf(0xc3) + 1 // giữa chữ "à" (2 byte), cũng là giữa dòng
    const reply = await requestChatReply(turns, {
      onText: () => {},
      fetchImpl: async () => stream(bytes.slice(0, cut), bytes.slice(cut)),
    })
    expect(reply).toEqual({ ok: true, text: "Xin chào bạn", events: [] })
  })

  it("bỏ qua dòng hỏng, sai schema và hành động ngoài whitelist", async () => {
    const onEvent: ChatCardEvent[] = []
    const reply = await requestChatReply(turns, {
      onText: () => {},
      onEvent: (e) => onEvent.push(e),
      fetchImpl: async () =>
        stream(
          "{không phải json\n",
          '{"type":"ui","action":{"type":"navigate","to":"https://evil.example"}}\n',
          '{"type":"ui","action":{"type":"addToCart","variantId":"v1"}}\n',
          textLine("Ổn"),
        ),
    })
    expect(onEvent).toEqual([])
    expect(reply).toEqual({ ok: true, text: "Ổn", events: [] })
  })

  it("mã HTTP lỗi: lấy câu thân thiện của server", async () => {
    const res = Response.json({ error: { code: "RATE_LIMITED", message: "Bạn nhắn hơi nhanh, thử lại sau 20 giây nhé" } }, { status: 429 })
    expect(await requestChatReply(turns, { onText: () => {}, fetchImpl: async () => res })).toEqual({
      ok: false,
      message: "Bạn nhắn hơi nhanh, thử lại sau 20 giây nhé",
    })
  })

  it("lỗi mạng, phản hồi lỗi không phải JSON, luồng rỗng và luồng chỉ có lỗi đều ra câu thân thiện chung", async () => {
    const network = await requestChatReply(turns, {
      onText: () => {},
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch")
      },
    })
    expect(network).toEqual({ ok: false, message: CHAT_FALLBACK_MESSAGE })

    const html = await requestChatReply(turns, { onText: () => {}, fetchImpl: async () => new Response("<html>502</html>", { status: 502 }) })
    expect(html).toEqual({ ok: false, message: CHAT_FALLBACK_MESSAGE })

    const empty = await requestChatReply(turns, { onText: () => {}, fetchImpl: async () => stream() })
    expect(empty).toEqual({ ok: false, message: CHAT_FALLBACK_MESSAGE })

    const onlyError = await requestChatReply(turns, { onText: () => {}, fetchImpl: async () => stream(line({ type: "error" })) })
    expect(onlyError).toEqual({ ok: false, message: CHAT_FALLBACK_MESSAGE })
  })

  it("model đứt giữa chừng (sự kiện error) thì giữ phần đã nhận", async () => {
    const reply = await requestChatReply(turns, {
      onText: () => {},
      fetchImpl: async () => stream(textLine("Một nửa câu"), line({ type: "error" })),
    })
    expect(reply).toEqual({ ok: true, text: "Một nửa câu", events: [] })
  })

  it("luồng mạng đứt giữa chừng thì giữ phần đã nhận; đứt trước khi có gì thì báo lỗi", async () => {
    // Mẩu đầu đến được tay người đọc rồi mới đứt (c.error ngay trong start sẽ làm mất cả mẩu đã xếp hàng).
    const broken = (first?: string) => {
      let sent = false
      return new Response(
        new ReadableStream<Uint8Array>({
          pull(c) {
            if (first && !sent) {
              sent = true
              c.enqueue(new TextEncoder().encode(first))
              return
            }
            c.error(new Error("mất kết nối"))
          },
        }),
      )
    }
    expect(await requestChatReply(turns, { onText: () => {}, fetchImpl: async () => broken(textLine("Một nửa câu")) })).toEqual({
      ok: true,
      text: "Một nửa câu",
      events: [],
    })
    expect((await requestChatReply(turns, { onText: () => {}, fetchImpl: async () => broken() })).ok).toBe(false)
  })
})

describe("requestConfirm", () => {
  const ID = "a".repeat(32)

  it("gửi đúng id và hành động tới /api/ai/confirm, trả trạng thái đã thêm hoặc đã huỷ", async () => {
    const calls: { url: string; body: unknown }[] = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) })
      return Response.json({ ok: true, status: JSON.parse(String(init?.body)).action === "cancel" ? "cancelled" : "added" })
    }) as typeof fetch
    expect(await requestConfirm(ID, "confirm", fetchImpl)).toEqual({ ok: true, status: "added" })
    expect(await requestConfirm(ID, "cancel", fetchImpl)).toEqual({ ok: true, status: "cancelled" })
    expect(calls).toEqual([
      { url: "/api/ai/confirm", body: { confirmationId: ID, action: "confirm" } },
      { url: "/api/ai/confirm", body: { confirmationId: ID, action: "cancel" } },
    ])
  })

  it("mã lỗi: lấy câu thân thiện của server (hết hạn, hết hàng)", async () => {
    const res = Response.json({ error: { code: "CONFIRMATION_INVALID", message: "Yêu cầu này đã hết hạn" } }, { status: 410 })
    expect(await requestConfirm(ID, "confirm", (async () => res) as typeof fetch)).toEqual({ ok: false, message: "Yêu cầu này đã hết hạn" })
  })

  it("lỗi mạng, phản hồi không phải JSON hoặc trạng thái lạ đều ra câu thân thiện, không coi là đã thêm", async () => {
    const network = await requestConfirm(ID, "confirm", (async () => {
      throw new TypeError("Failed to fetch")
    }) as typeof fetch)
    expect(network.ok).toBe(false)
    expect((await requestConfirm(ID, "confirm", (async () => new Response("<html>", { status: 502 })) as typeof fetch)).ok).toBe(false)
    expect((await requestConfirm(ID, "confirm", (async () => Response.json({ ok: true })) as typeof fetch)).ok).toBe(false)
    expect((await requestConfirm(ID, "confirm", (async () => Response.json({ ok: true, status: "weird" })) as typeof fetch)).ok).toBe(false)
  })
})

describe("describeShownCards và dấu vết thẻ trong lịch sử", () => {
  const product = (name: string, price: number) => ({ id: name, name, slug: name, categoryName: "Áo", gender: "MEN" as const, price, image: null, hoverImage: null, colors: [], inStock: true })
  const withCards = (parts: MessagePart[]): ChatMessage => ({ id: "a1", role: "assistant", parts: [{ type: "text", text: "Mình tìm được vài mẫu, bạn xem thẻ nhé." }, ...parts] })

  it("thẻ sản phẩm: đánh số theo thứ tự hiện, kèm giá; tối đa 6 sản phẩm", () => {
    const items = Array.from({ length: 9 }, (_, i) => product(`Áo ${i + 1}`, 100000 * (i + 1)))
    const lines = describeShownCards([{ type: "products", items }])
    expect(lines).toHaveLength(6)
    expect(lines[0]).toMatch(/^Sản phẩm 1 \(cái đầu tiên\): Áo 1 \(100\.000\s?đ\)$/)
    expect(lines[1]).toContain("Sản phẩm 2 (cái thứ hai): Áo 2")
    expect(lines[5]).toContain("Sản phẩm 6 (cái thứ sáu, cái cuối cùng): Áo 6")
  })

  it("thẻ size, bộ đồ và xác nhận (ghi rõ CHƯA thêm vào giỏ)", () => {
    const lines = describeShownCards([
      { type: "size", data: { status: "recommended", productName: "Áo thun", recommendedSize: "M" } },
      { type: "outfit", data: { items: [{ name: "Áo A", variantLabel: "Trắng · L" }, { name: "Quần B", variantLabel: "Đen · 30" }] } },
      { type: "confirm", data: { id: "x", title: "t", lines: ["Mũ bucket · Xanh rêu · Free size × 1"], total: 1, expiresInMinutes: 5 } },
    ] as unknown as MessagePart[])
    expect(lines).toEqual([
      "Tư vấn size cho Áo thun: size M",
      "Bộ đồ gợi ý: Áo A (Trắng · L); Quần B (Đen · 30)",
      "Thẻ xác nhận thêm vào giỏ (khách CHƯA bấm, chưa thêm): Mũ bucket · Xanh rêu · Free size × 1",
    ])
  })

  it("thẻ xác nhận phản ánh quyết định của khách (để model không tưởng thẻ còn chờ)", () => {
    const confirm = (resolved?: "confirming" | "added" | "cancelled" | "failed") =>
      describeShownCards([{ type: "confirm", data: { id: "x", title: "t", lines: ["Áo · M × 1"], total: 1, expiresInMinutes: 5 }, ...(resolved ? { resolved } : {}) }])[0]
    expect(confirm()).toContain("khách CHƯA bấm, chưa thêm")
    expect(confirm("added")).toContain("ĐÃ thêm vào giỏ")
    expect(confirm("cancelled")).toContain("khách đã huỷ, KHÔNG thêm")
    expect(confirm("failed")).toContain("KHÔNG thêm được")
    expect(confirm("confirming")).toContain("đang xử lý")
    expect(confirm("added")).not.toContain("CHƯA")
  })

  it("không có thẻ thì không có dòng nào; tin nhắn chỉ có chữ không gắn shown", () => {
    expect(describeShownCards([{ type: "text", text: "xin chào" }])).toEqual([])
    expect(buildChatHistory([text("a1", "assistant", "Chào bạn")], "hi")).toEqual([{ role: "assistant", text: "Chào bạn" }, { role: "user", text: "hi" }])
  })

  it("buildChatHistory gắn shown vào tin nhắn trợ lý CUỐI, bỏ ở các lượt cũ hơn", () => {
    const old = withCards([{ type: "products", items: [product("Áo cũ", 100000)] }])
    const recent = { ...withCards([{ type: "products", items: [product("Áo mới", 200000)] }]), id: "a2" }
    const turns = buildChatHistory([text("u1", "user", "tìm áo"), old, text("u2", "user", "tìm tiếp"), recent], "thêm cái đầu tiên")
    expect(turns.map((t) => t.shown?.length ?? 0)).toEqual([0, 0, 0, 1, 0])
    expect(turns[3].shown?.[0]).toContain("Áo mới")
    expect(JSON.stringify(turns)).not.toContain("Áo cũ")
  })

  it("dòng quá dài bị cắt theo giới hạn schema", () => {
    const long = product("A".repeat(500), 1)
    expect(describeShownCards([{ type: "products", items: [long] }])[0].length).toBeLessThanOrEqual(200)
  })
})
