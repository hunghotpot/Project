import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import { listProducts } from "./catalog.service"

/*
 * Test tích hợp trên PostgreSQL thật (cần `npm run db:up`): lọc `season` và nghĩa của `gender` (có/không gồm UNISEX).
 * Dữ liệu nằm trong một category riêng (có slug riêng) nên không lẫn với dữ liệu seed; tự dọn khi xong.
 */

const RUN = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const slug = `cat-${RUN}`
let categoryId = ""

const SPECS = [
  { key: "men-summer", gender: "MEN", season: ["xuân", "hè"] },
  { key: "men-winter", gender: "MEN", season: ["đông"] },
  { key: "women-all", gender: "WOMEN", season: ["xuân", "hè", "thu", "đông"] },
  { key: "unisex-summer", gender: "UNISEX", season: ["hè"] },
  { key: "unisex-autumn", gender: "UNISEX", season: ["thu"] },
] as const

const names = async (input: Parameters<typeof listProducts>[0], opts?: Parameters<typeof listProducts>[1]) =>
  (await listProducts({ category: slug, pageSize: 48, ...input }, opts)).items.map((i) => i.name.replace(`${RUN}-`, "")).sort()

beforeAll(async () => {
  const c = await db.category.create({ data: { name: `Test ${RUN}`, slug } })
  categoryId = c.id
  for (const s of SPECS) {
    await db.product.create({
      data: {
        name: `${RUN}-${s.key}`,
        slug: `${RUN}-${s.key}`,
        description: "test",
        brand: "Test",
        material: "Cotton",
        style: "casual",
        gender: s.gender,
        season: [...s.season],
        basePrice: 100_000,
        categoryId,
      },
    })
  }
})

afterAll(async () => {
  await db.product.deleteMany({ where: { categoryId } })
  await db.category.delete({ where: { id: categoryId } })
  await db.$disconnect()
})

describe("lọc season", () => {
  it("không lọc: trả đủ 5 sản phẩm", async () => {
    expect(await names({})).toHaveLength(5)
  })

  it("season=hè: chỉ sản phẩm có mùa hè", async () => {
    expect(await names({ season: ["hè"] })).toEqual(["men-summer", "unisex-summer", "women-all"])
  })

  it("nhiều mùa: khớp khi trùng ít nhất một mùa (hasSome)", async () => {
    expect(await names({ season: ["đông", "thu"] })).toEqual(["men-winter", "unisex-autumn", "women-all"])
  })

  it("mùa không tồn tại: không có kết quả", async () => {
    expect(await names({ season: ["mùa-lạ"] })).toEqual([])
  })

  it("kết hợp season và gender", async () => {
    expect(await names({ season: ["hè"], gender: "men" })).toEqual(["men-summer"])
  })
})

describe("nghĩa của gender", () => {
  it("mặc định (giao diện web): men chỉ khớp MEN, không gồm UNISEX", async () => {
    expect(await names({ gender: "men" })).toEqual(["men-summer", "men-winter"])
    expect(await names({ gender: "women" })).toEqual(["women-all"])
  })

  it("includeUnisex: nam/nữ gồm cả UNISEX", async () => {
    expect(await names({ gender: "men" }, { includeUnisex: true })).toEqual(["men-summer", "men-winter", "unisex-autumn", "unisex-summer"])
    expect(await names({ gender: "women" }, { includeUnisex: true })).toEqual(["unisex-autumn", "unisex-summer", "women-all"])
  })

  it("gender=unisex luôn chỉ khớp UNISEX, dù có includeUnisex", async () => {
    expect(await names({ gender: "unisex" })).toEqual(["unisex-autumn", "unisex-summer"])
    expect(await names({ gender: "unisex" }, { includeUnisex: true })).toEqual(["unisex-autumn", "unisex-summer"])
  })

  it("không đặt gender thì includeUnisex không ảnh hưởng", async () => {
    expect(await names({}, { includeUnisex: true })).toHaveLength(5)
  })

  it("includeUnisex kết hợp season", async () => {
    expect(await names({ gender: "men", season: ["hè"] }, { includeUnisex: true })).toEqual(["men-summer", "unisex-summer"])
  })

  it("total và facet nhất quán với kết quả (cùng điều kiện)", async () => {
    const r = await listProducts({ category: slug, gender: "men" }, { includeUnisex: true })
    expect(r.total).toBe(4)
    expect(r.items).toHaveLength(4)
  })
})
