import { describe, expect, it } from "vitest"
import type { SizeRecommendationView } from "@/types/assistant"
import { encodeChatEvent, parseChatEventLine, type ChatEvent } from "./chat-events"

const advice: SizeRecommendationView = {
  status: "recommended",
  productName: "Áo thun",
  recommendedSize: "M",
  alternativeSize: null,
  confidence: "high",
  reasons: ["Khớp bảng size"],
  missingFields: [],
  stock: { size: "M", available: true, colors: ["Trắng"] },
  message: null,
}

describe("chat events (NDJSON)", () => {
  it("mỗi sự kiện mã hoá thành một dòng và đọc lại đúng", () => {
    const events: ChatEvent[] = [
      { type: "text", delta: "Chào bạn" },
      { type: "ui", action: { type: "openCart" } },
      { type: "ui", action: { type: "navigate", to: "/cart" } },
      { type: "products", items: [{ slug: "ao", name: "Áo", price: 199000, categoryName: "Áo thun", image: null, colors: ["Trắng"] }] },
      { type: "size", advice, chart: [], categoryName: "Áo thun nam" },
      { type: "confirm", data: { id: "a".repeat(32), title: "Thêm vào giỏ hàng?", lines: ["Áo · Trắng · M × 1"], total: 429000, expiresInMinutes: 5 } },
      {
        type: "outfit",
        data: { title: "Bộ đồ đi làm cho nam", occasion: "đi làm", seasons: ["hè"], items: [{ slot: "top", slug: "ao", name: "Áo", image: null, variantLabel: "Trắng", price: 199000, reason: null }], totalPrice: 199000, knowledgeSources: ["Phối đồ đi làm"], missingSlots: [], note: null },
      },
      { type: "error" },
    ]
    for (const e of events) {
      const line = encodeChatEvent(e)
      expect(line.endsWith("\n")).toBe(true)
      expect(line.slice(0, -1)).not.toContain("\n")
      expect(parseChatEventLine(line)).toEqual(e)
    }
  })

  it("chữ có xuống dòng và dấu tiếng Việt vẫn nằm trên một dòng", () => {
    const line = encodeChatEvent({ type: "text", delta: "Dòng 1\nDòng 2 — đẹp" })
    expect(line.trimEnd().split("\n")).toHaveLength(1)
    expect(parseChatEventLine(line)).toEqual({ type: "text", delta: "Dòng 1\nDòng 2 — đẹp" })
  })

  it("dòng rỗng, JSON hỏng hoặc sai schema bị bỏ qua (null)", () => {
    for (const line of ["", "   ", "{not json", "[]", '{"type":"text"}', '{"type":"lạ"}', '{"type":"products","items":"x"}']) {
      expect(parseChatEventLine(line)).toBeNull()
    }
  })

  it("hành động giao diện ngoài whitelist làm cả sự kiện bị bỏ", () => {
    expect(parseChatEventLine('{"type":"ui","action":{"type":"navigate","to":"https://evil.example"}}')).toBeNull()
    expect(parseChatEventLine('{"type":"ui","action":{"type":"addToCart","variantId":"v1"}}')).toBeNull()
  })
})
