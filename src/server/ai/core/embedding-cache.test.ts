import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AiConfig } from "./env"

const embedTexts = vi.fn()
vi.mock("./embeddings", () => ({ embedTexts: (...a: unknown[]) => embedTexts(...a) }))

import { clearEmbeddingCache, embedQuery, EMBEDDING_CACHE_MAX_ENTRIES } from "./embedding-cache"

const config = { embeddingModel: "bge-m3", embeddingDimensions: 2 } as AiConfig

beforeEach(() => {
  clearEmbeddingCache()
  embedTexts.mockReset()
  embedTexts.mockImplementation(async (texts: string[]) => texts.map((t) => [t.length, 1]))
})

describe("embedQuery (cache embedding câu hỏi)", () => {
  it("cùng câu thì chỉ gọi model một lần", async () => {
    expect(await embedQuery("áo sơ mi", config)).toEqual([8, 1])
    expect(await embedQuery("áo sơ mi", config)).toEqual([8, 1])
    expect(embedTexts).toHaveBeenCalledTimes(1)
  })

  it("khoảng trắng thừa ở đầu, cuối và giữa không làm lệch cache", async () => {
    await embedQuery("áo  sơ mi", config)
    await embedQuery("  áo sơ mi ", config)
    expect(embedTexts).toHaveBeenCalledTimes(1)
  })

  it("câu khác hoặc model khác thì không dùng chung", async () => {
    await embedQuery("áo", config)
    await embedQuery("quần", config)
    await embedQuery("áo", { ...config, embeddingModel: "other" })
    expect(embedTexts).toHaveBeenCalledTimes(3)
  })

  it("các yêu cầu giống nhau chạy cùng lúc chỉ gọi model một lần", async () => {
    const [a, b] = await Promise.all([embedQuery("áo", config), embedQuery("áo", config)])
    expect(a).toEqual(b)
    expect(embedTexts).toHaveBeenCalledTimes(1)
  })

  it("lỗi không bị nhớ: lần sau gọi lại model", async () => {
    embedTexts.mockRejectedValueOnce(new Error("ECONNREFUSED"))
    await expect(embedQuery("áo", config)).rejects.toThrow("ECONNREFUSED")
    expect(await embedQuery("áo", config)).toEqual([2, 1])
    expect(embedTexts).toHaveBeenCalledTimes(2)
  })

  it("quá số câu tối đa thì bỏ câu ít dùng nhất trước, câu mới dùng gần đây được giữ", async () => {
    await embedQuery("giữ-lại", config)
    for (let i = 0; i < EMBEDDING_CACHE_MAX_ENTRIES - 1; i++) await embedQuery(`q${i}`, config)
    await embedQuery("giữ-lại", config) // dùng lại: lên đầu hàng
    await embedQuery("câu-mới", config) // đẩy một câu cũ nhất ra
    embedTexts.mockClear()
    await embedQuery("giữ-lại", config)
    expect(embedTexts).not.toHaveBeenCalled()
    await embedQuery("q0", config) // đã bị bỏ
    expect(embedTexts).toHaveBeenCalledTimes(1)
  })
})
