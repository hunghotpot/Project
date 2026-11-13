import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createFixtures } from "@/test/db-fixtures"
import { db } from "@/server/db"
import type { AiConfig } from "../core/env"

// Không gọi Ollama thật: embed trả vector 1024 chiều xác định theo nội dung.
vi.mock("../core/embeddings", async (importOriginal) => {
  const original = await importOriginal<typeof import("../core/embeddings")>()
  return {
    ...original,
    embedTexts: vi.fn(async (texts: string[]) => texts.map((t) => Array.from({ length: 1024 }, (_, j) => ((t.length + j) % 7) / 10))),
  }
})

import { embedTexts } from "../core/embeddings"
import { syncAllProducts, syncOneProduct } from "./sync-embeddings"

const embed = vi.mocked(embedTexts)
const config = { embeddingModel: "bge-m3", embeddingDimensions: 1024, timeoutMs: 1000 } as AiConfig

const fx = createFixtures()
afterAll(async () => {
  await fx.cleanup()
  await db.$disconnect()
})
beforeEach(() => {
  embed.mockClear()
})

const rowOf = (productId: string) =>
  db.$queryRaw<{ content: string; contentHash: string; model: string; dimensions: number; dims: number }[]>`
    SELECT "content", "contentHash", "model", "dimensions", vector_dims("embedding") AS dims
    FROM "ProductEmbedding" WHERE "productId" = ${productId}`

describe("syncOneProduct", () => {
  it("embed lần đầu: ghi vector 1024 chiều kèm nội dung, model và hash", async () => {
    const { productId } = await fx.makeVariant(5)
    expect(await syncOneProduct(productId, config)).toBe("embedded")
    const [row] = await rowOf(productId)
    expect(row).toMatchObject({ model: "bge-m3", dimensions: 1024, dims: 1024 })
    expect(row.content).toContain("Màu sắc: Đen.")
    expect(row.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("chạy lại khi dữ liệu không đổi thì bỏ qua, không gọi embed", async () => {
    const { productId } = await fx.makeVariant(5)
    await syncOneProduct(productId, config)
    embed.mockClear()
    expect(await syncOneProduct(productId, config)).toBe("skipped")
    expect(embed).not.toHaveBeenCalled()
  })

  it("đổi trường nằm trong template thì embed lại; đổi giá và tồn kho thì không", async () => {
    const { productId } = await fx.makeVariant(5)
    await syncOneProduct(productId, config)
    const [before] = await rowOf(productId)

    await db.product.update({ where: { id: productId }, data: { basePrice: 999_000 } })
    await db.productVariant.updateMany({ where: { productId }, data: { stock: 0, price: 888_000 } })
    expect(await syncOneProduct(productId, config)).toBe("skipped")

    await db.product.update({ where: { id: productId }, data: { name: "Tên đã đổi hoàn toàn" } })
    expect(await syncOneProduct(productId, config)).toBe("embedded")
    const [after] = await rowOf(productId)
    expect(after.content).toContain("Tên đã đổi hoàn toàn.")
    expect(after.contentHash).not.toBe(before.contentHash)
  })

  it("đổi model embedding thì hash đổi và embed lại", async () => {
    const { productId } = await fx.makeVariant(5)
    await syncOneProduct(productId, config)
    expect(await syncOneProduct(productId, { ...config, embeddingModel: "model-khac" })).toBe("embedded")
    expect((await rowOf(productId))[0].model).toBe("model-khac")
  })

  it("sản phẩm đang ẩn vẫn được embed", async () => {
    const { productId } = await fx.makeVariant(5)
    await db.product.update({ where: { id: productId }, data: { isActive: false } })
    expect(await syncOneProduct(productId, config)).toBe("embedded")
  })

  it("sản phẩm không tồn tại trả missing; xoá sản phẩm thì embedding tự xoá theo", async () => {
    expect(await syncOneProduct("khong-ton-tai", config)).toBe("missing")
    const { productId } = await fx.makeVariant(5)
    await syncOneProduct(productId, config)
    await db.product.delete({ where: { id: productId } })
    expect(await rowOf(productId)).toHaveLength(0)
  })

  it("lỗi embed thì ném lỗi và không ghi gì", async () => {
    const { productId } = await fx.makeVariant(5)
    embed.mockRejectedValueOnce(new Error("Ollama tắt"))
    await expect(syncOneProduct(productId, config)).rejects.toThrow("Ollama tắt")
    expect(await rowOf(productId)).toHaveLength(0)
  })
})

describe("syncAllProducts", () => {
  it("chỉ embed sản phẩm thiếu hoặc đổi, theo lô; --force thì embed lại tất cả", async () => {
    const a = (await fx.makeVariant(1)).productId
    const b = (await fx.makeVariant(1)).productId
    const c = (await fx.makeVariant(1)).productId
    await syncOneProduct(a, config)
    embed.mockClear()

    const progress: number[] = []
    const first = await syncAllProducts(config, { productIds: [a, b, c], batchSize: 1, onProgress: (done) => progress.push(done) })
    expect(first).toEqual({ total: 3, embedded: 2, skipped: 1 })
    expect(embed).toHaveBeenCalledTimes(2) // batchSize 1: mỗi sản phẩm một lô
    expect(progress).toEqual([1, 2])

    embed.mockClear()
    expect(await syncAllProducts(config, { productIds: [a, b, c] })).toEqual({ total: 3, embedded: 0, skipped: 3 })
    expect(embed).not.toHaveBeenCalled()

    expect(await syncAllProducts(config, { productIds: [a, b, c], force: true })).toEqual({ total: 3, embedded: 3, skipped: 0 })
    expect(embed).toHaveBeenCalledTimes(1) // một lô 3 văn bản
  })

  it("lỗi giữa chừng thì dừng, phần đã ghi vẫn giữ để chạy lại tiếp tục", async () => {
    const a = (await fx.makeVariant(1)).productId
    const b = (await fx.makeVariant(1)).productId
    embed.mockRejectedValueOnce(new Error("hết thời gian")) // lô đầu lỗi
    await expect(syncAllProducts(config, { productIds: [a, b], batchSize: 1 })).rejects.toThrow("hết thời gian")
    expect(await rowOf(a)).toHaveLength(0)
    expect(await syncAllProducts(config, { productIds: [a, b], batchSize: 1 })).toEqual({ total: 2, embedded: 2, skipped: 0 })
  })
})
