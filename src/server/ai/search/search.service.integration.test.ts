import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/server/db"
import { clearEmbeddingCache } from "../core/embedding-cache"
import type { AiConfig } from "../core/env"

/*
 * Test tích hợp trên PostgreSQL thật. Không gọi Ollama: embed được giả bằng các vector 1024 chiều biết trước.
 * Bốn sản phẩm thử có vector gần/xa câu truy vấn khác nhau; vector thật của 125 sản phẩm seed nằm xa vector thử (gần trực giao),
 * nên bốn sản phẩm thử luôn đứng đầu khi xếp theo vector. Tên chứa TOKEN chỉ gồm chữ để tìm từ khoá không trúng sản phẩm thật.
 */

const unit = (a: number, b: number) => {
  const v = new Array<number>(1024).fill(0)
  v[0] = a
  v[1] = b
  return v
}
const QUERY_VECTOR = unit(1, 0)
const VECTORS: Record<string, number[]> = {
  alpha: unit(1, 0), // khoảng cách 0
  bravo: unit(0.9, Math.sqrt(1 - 0.81)), // ≈ 0,1
  charlie: unit(0.5, Math.sqrt(1 - 0.25)), // ≈ 0,5
  delta: unit(0.99, Math.sqrt(1 - 0.9801)), // ≈ 0,01 (nhưng hết hàng)
}

vi.mock("../core/embeddings", async (importOriginal) => {
  const original = await importOriginal<typeof import("../core/embeddings")>()
  return {
    ...original,
    embedTexts: vi.fn(async (texts: string[]) =>
      texts.map((t) => Object.entries(VECTORS).find(([key]) => t.includes(key))?.[1] ?? QUERY_VECTOR),
    ),
  }
})

import { embedTexts } from "../core/embeddings"
import { searchProducts } from "./search.service"
import { syncOneProduct } from "./sync-embeddings"

const embed = vi.mocked(embedTexts)
const config = { embeddingModel: "bge-m3", embeddingDimensions: 1024, timeoutMs: 1000 } as AiConfig

const TOKEN = `zk${Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("")}`
let categoryId = ""
const ids: Record<string, string> = {}

const SPECS = [
  { key: "alpha", gender: "WOMEN", price: 100_000, stock: 5 },
  { key: "bravo", gender: "MEN", price: 300_000, stock: 5 },
  { key: "charlie", gender: "UNISEX", price: 150_000, stock: 5 },
  { key: "delta", gender: "WOMEN", price: 120_000, stock: 0 },
] as const

beforeAll(async () => {
  categoryId = (await db.category.create({ data: { name: `Test ${TOKEN}`, slug: `cat-${TOKEN}` } })).id
  for (const s of SPECS) {
    const p = await db.product.create({
      data: {
        name: `${TOKEN} ${s.key}`,
        slug: `${TOKEN}-${s.key}`,
        description: "test",
        brand: "Test",
        material: "Cotton",
        style: "casual",
        gender: s.gender,
        basePrice: s.price,
        categoryId,
        variants: { create: { sku: `${TOKEN}-${s.key}`, size: "M", color: "Đen", colorHex: "#111111", price: s.price, stock: s.stock } },
      },
    })
    ids[s.key] = p.id
    await syncOneProduct(p.id, config)
  }
})

afterAll(async () => {
  await db.product.deleteMany({ where: { categoryId } }) // embedding tự xoá theo
  await db.category.delete({ where: { id: categoryId } })
  await db.$disconnect()
})

beforeEach(() => {
  embed.mockClear()
  clearEmbeddingCache()
})

const search = (q: string, config_: AiConfig | null = config) => searchProducts(q, { config: config_, pageSize: 48 })
const keysOf = (r: Awaited<ReturnType<typeof search>>) =>
  r.result.items.filter((i) => i.name.startsWith(TOKEN)).map((i) => i.name.replace(`${TOKEN} `, ""))

describe("searchProducts: xếp hạng bằng vector", () => {
  it("xếp theo khoảng cách vector, bỏ sản phẩm hết hàng dù rất gần", async () => {
    const r = await search("dưới 500k")
    expect(r.mode).toBe("semantic")
    expect(keysOf(r)).toEqual(["alpha", "bravo", "charlie"])
    expect(r.result.items.slice(0, 3).map((i) => i.id)).toEqual([ids.alpha, ids.bravo, ids.charlie])
    expect(embed).toHaveBeenCalledTimes(1)
  })

  it("giá khách nêu là điều kiện cứng: 'dưới 200k' loại bravo (300k)", async () => {
    const r = await search("dưới 200k")
    expect(keysOf(r)).toEqual(["alpha", "charlie"])
  })

  it("không nới giá dù ít kết quả: 'dưới 50k' không trả sản phẩm nào của bộ thử", async () => {
    const r = await search("dưới 50k")
    expect(keysOf(r)).toEqual([])
    expect(r.relaxed).toEqual([])
  })

  it("giới tính: 'bạn gái' loại sản phẩm nam nhưng giữ unisex", async () => {
    const r = await search("bạn gái")
    expect(r.intent.hard.genders).toEqual(["WOMEN", "UNISEX"])
    expect(keysOf(r)).toEqual(["alpha", "charlie"])
  })

  it("size không có: nới điều kiện size và báo lại", async () => {
    const r = await search("size 99 dưới 500k")
    expect(r.relaxed.join(" ")).toContain("size 99")
    expect(keysOf(r)).toEqual(["alpha", "bravo", "charlie"])
  })

  it("trả đúng kiểu ProductListResult để giao diện lọc dùng lại", async () => {
    const r = await search("dưới 500k")
    expect(r.result).toMatchObject({ page: 1, pageSize: 48 })
    expect(r.result.total).toBeGreaterThanOrEqual(3)
    expect(r.result.facets.price).not.toBeNull()
  })
})

describe("searchProducts: đường lui bằng từ khoá", () => {
  it("embedding lỗi: vẫn trả kết quả bằng từ khoá kèm thông báo", async () => {
    embed.mockRejectedValueOnce(new Error("Ollama tắt"))
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await search(`${TOKEN} dưới 500k`)
    errors.mockRestore()
    expect(r.mode).toBe("keyword")
    expect(r.notice).toContain("tìm kiếm thường")
    expect(keysOf(r).sort()).toEqual(["alpha", "bravo", "charlie"])
  })

  it("không có cấu hình AI: tìm từ khoá, không gọi embedding", async () => {
    const r = await search(`${TOKEN} dưới 200k`, null)
    expect(r.mode).toBe("keyword")
    expect(r.notice).toBeUndefined() // không có cấu hình AI không phải sự cố
    expect(keysOf(r).sort()).toEqual(["alpha", "charlie"])
    expect(embed).not.toHaveBeenCalled()
  })

  it("từ khoá khớp nguyên từ, không khớp một phần", async () => {
    const r = await search(`${TOKEN.slice(0, 5)}`, null)
    expect(keysOf(r)).toEqual([])
  })
})

describe("searchProducts: đầu vào đặc biệt", () => {
  it("câu rỗng trả danh sách còn hàng, không gọi embedding", async () => {
    const r = await search("   ")
    expect(r.result.items.length).toBeGreaterThan(0)
    expect(embed).not.toHaveBeenCalled()
  })

  it("câu chứa ký tự SQL và regex không gây lỗi", async () => {
    const r = await search(`'; DROP TABLE "Product"; -- \\m(.*) ${TOKEN}`, null)
    expect(keysOf(r).length).toBeGreaterThan(0)
    expect(await db.product.count()).toBeGreaterThan(0)
  })

  it("phân trang: trang 2 không lặp sản phẩm của trang 1", async () => {
    const p1 = await searchProducts("dưới 500k", { config, page: 1, pageSize: 2 })
    const p2 = await searchProducts("dưới 500k", { config, page: 2, pageSize: 2 })
    const a = p1.result.items.map((i) => i.id)
    const b = p2.result.items.map((i) => i.id)
    expect(a).toEqual([ids.alpha, ids.bravo])
    expect(b.some((id) => a.includes(id))).toBe(false)
    expect(b[0]).toBe(ids.charlie)
  })
})
