import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/server/db"
import type { AiConfig } from "../core/env"

/*
 * Test tích hợp trên PostgreSQL thật. Không gọi Ollama: embed trả vector biết trước. Đoạn thử có vector gần/xa vector câu hỏi khác nhau;
 * vector thật của kho kiến thức nằm xa vector thử (gần trực giao) nên không lọt vào kết quả khi ngưỡng đủ chặt.
 */

const unit = (a: number, b: number) => {
  const v = new Array<number>(1024).fill(0)
  v[0] = a
  v[1] = b
  return v
}
const QUERY = unit(1, 0)

vi.mock("../core/embeddings", async (importOriginal) => {
  const original = await importOriginal<typeof import("../core/embeddings")>()
  return { ...original, embedTexts: vi.fn(async (texts: string[]) => texts.map(() => QUERY)) }
})

import { clearEmbeddingCache } from "../core/embedding-cache"
import { embedTexts } from "../core/embeddings"
import { KNOWLEDGE_MAX_DISTANCE, searchKnowledge } from "./knowledge.service"

const embed = vi.mocked(embedTexts)

// Cache embedding câu hỏi là trạng thái dùng chung giữa các test: xoá để mỗi test tự gọi model giả.
beforeEach(() => clearEmbeddingCache())
const config = { embeddingModel: "bge-m3", embeddingDimensions: 1024, timeoutMs: 1000 } as AiConfig
const SOURCE = `zz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.md`

const CHUNKS = [
  { title: "Sát", type: "care", vec: unit(1, 0) }, // khoảng cách 0
  { title: "Gần", type: "faq", vec: unit(0.9, Math.sqrt(1 - 0.81)) }, // ≈ 0,1
  { title: "Vừa", type: "care", vec: unit(0.7, Math.sqrt(1 - 0.49)) }, // ≈ 0,3
  { title: "Xa", type: "policy", vec: unit(0.4, Math.sqrt(1 - 0.16)) }, // ≈ 0,6 (quá ngưỡng)
]

beforeAll(async () => {
  for (const [i, c] of CHUNKS.entries()) {
    const literal = `[${c.vec.join(",")}]`
    await db.$executeRaw`INSERT INTO "KnowledgeChunk" ("id","source","type","title","content","metadata","embedding","contentHash","model","templateVersion","updatedAt")
      VALUES (${`${SOURCE}-${i}`}, ${SOURCE}, ${c.type}, ${c.title}, ${`Nội dung ${c.title}`}, '{"basis":"tra-cuu"}'::jsonb, ${literal}::vector, 'h', 'm', 1, now())`
  }
})

afterAll(async () => {
  await db.knowledgeChunk.deleteMany({ where: { source: SOURCE } })
  await db.$disconnect()
})

const titles = (hits: { title: string }[]) => hits.filter((h) => CHUNKS.some((c) => c.title === h.title)).map((h) => h.title)

describe("searchKnowledge", () => {
  it("trả đoạn gần nhất trước, kèm khoảng cách, loại, nội dung và metadata", async () => {
    const hits = await searchKnowledge("câu hỏi", config)
    expect(titles(hits).slice(0, 3)).toEqual(["Sát", "Gần", "Vừa"])
    expect(hits[0]).toMatchObject({ source: SOURCE, type: "care", content: "Nội dung Sát", metadata: { basis: "tra-cuu" } })
    expect(hits[0].distance).toBeCloseTo(0, 5)
    expect(hits[1].distance).toBeCloseTo(0.1, 2)
  })

  it("bỏ đoạn xa hơn ngưỡng (coi như không có tri thức)", async () => {
    const hits = await searchKnowledge("câu hỏi", config, { limit: 10 })
    expect(titles(hits)).not.toContain("Xa")
    expect(hits.every((h) => h.distance <= KNOWLEDGE_MAX_DISTANCE)).toBe(true)
    expect(titles(await searchKnowledge("câu hỏi", config, { limit: 10, maxDistance: 0.7 }))).toContain("Xa")
  })

  it("mặc định tối đa 3 đoạn; limit tuỳ chỉnh được", async () => {
    expect(await searchKnowledge("câu hỏi", config)).toHaveLength(3)
    expect(await searchKnowledge("câu hỏi", config, { limit: 1 })).toHaveLength(1)
  })

  it("lọc theo loại", async () => {
    const hits = await searchKnowledge("câu hỏi", config, { types: ["faq"], limit: 10 })
    expect(titles(hits)).toEqual(["Gần"])
    expect(hits.every((h) => h.type === "faq")).toBe(true)
  })

  it("câu rỗng trả mảng rỗng và không gọi embedding", async () => {
    embed.mockClear()
    expect(await searchKnowledge("   ", config)).toEqual([])
    expect(embed).not.toHaveBeenCalled()
  })

  it("lỗi embedding được ném ra cho nơi gọi xử lý", async () => {
    embed.mockRejectedValueOnce(new Error("Ollama tắt"))
    await expect(searchKnowledge("câu hỏi", config)).rejects.toThrow("Ollama tắt")
  })
})

describe("searchKnowledge: cache embedding câu hỏi", () => {
  it("hỏi lại đúng câu đó (kể cả khoảng trắng thừa) thì không gọi model embedding lần nữa", async () => {
    embed.mockClear()
    await searchKnowledge("giặt áo len thế nào", config)
    await searchKnowledge("  giặt áo len   thế nào ", config)
    expect(embed).toHaveBeenCalledTimes(1)
  })
})
