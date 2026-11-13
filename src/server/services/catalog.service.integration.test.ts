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

describe("onlyIds (kết quả tìm kiếm đã xếp hạng)", () => {
  const idOf = async (key: string) => (await db.product.findFirstOrThrow({ where: { slug: `${RUN}-${key}` } })).id
  const run = async (keys: string[], input: Parameters<typeof listProducts>[0] = {}, opts: Parameters<typeof listProducts>[1] = {}) => {
    const ids = await Promise.all(keys.map(idOf))
    return listProducts({ category: slug, pageSize: 48, ...input }, { ...opts, onlyIds: ids })
  }
  const keysOf = (r: Awaited<ReturnType<typeof listProducts>>) => r.items.map((i) => i.name.replace(`${RUN}-`, ""))

  it("giữ đúng thứ tự danh sách, không theo sort mặc định", async () => {
    const r = await run(["women-all", "men-winter", "unisex-summer"])
    expect(keysOf(r)).toEqual(["women-all", "men-winter", "unisex-summer"])
    expect(r.total).toBe(3)
  })

  it("bỏ qua sort: price_asc không đổi thứ tự", async () => {
    const r = await run(["unisex-autumn", "men-summer"], { sort: "price_asc" })
    expect(keysOf(r)).toEqual(["unisex-autumn", "men-summer"])
  })

  it("vẫn áp các bộ lọc khác và giữ thứ tự của phần còn lại", async () => {
    const r = await run(["women-all", "men-winter", "unisex-summer", "men-summer"], { gender: "men", season: ["hè"] }, { includeUnisex: true })
    expect(keysOf(r)).toEqual(["unisex-summer", "men-summer"])
    expect(r.total).toBe(2)
  })

  it("phân trang theo thứ tự danh sách; total và pageCount tính trên phần lọc được", async () => {
    const keys = ["men-winter", "women-all", "unisex-autumn"]
    const p1 = await run(keys, { pageSize: 2, page: 1 })
    const p2 = await run(keys, { pageSize: 2, page: 2 })
    expect(keysOf(p1)).toEqual(["men-winter", "women-all"])
    expect(keysOf(p2)).toEqual(["unisex-autumn"])
    expect(p1.total).toBe(3)
    expect(p1.pageCount).toBe(2)
  })

  it("id trùng chỉ tính một lần, id không tồn tại bị bỏ", async () => {
    const a = await idOf("men-summer")
    const b = await idOf("women-all")
    const r = await listProducts({ category: slug }, { onlyIds: [a, a, "khong-ton-tai", b] })
    expect(keysOf(r)).toEqual(["men-summer", "women-all"])
    expect(r.total).toBe(2)
  })

  it("danh sách rỗng: không có kết quả", async () => {
    const r = await listProducts({ category: slug }, { onlyIds: [] })
    expect(r.items).toEqual([])
    expect(r.total).toBe(0)
    expect(r.pageCount).toBe(1)
  })

  it("facet chỉ tính trên các sản phẩm trong danh sách", async () => {
    const r = await run(["men-summer", "men-winter"])
    expect(r.facets.genders).toEqual([{ value: "men", count: 2 }])
  })
})
