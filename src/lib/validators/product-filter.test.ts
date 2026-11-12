import { describe, expect, it } from "vitest"
import {
  DEFAULT_PAGE_SIZE,
  parseProductFilters,
  productFilterSchema,
  serializeProductFilters,
} from "./product-filter"

describe("parseProductFilters", () => {
  it("trả về mặc định khi không có tham số", () => {
    const f = parseProductFilters(new URLSearchParams())
    expect(f).toMatchObject({ size: [], color: [], sort: "newest", page: 1, pageSize: DEFAULT_PAGE_SIZE })
    expect(f.q).toBeUndefined()
  })

  it("nhận mảng dạng lặp key lẫn phân tách dấu phẩy, bỏ trùng", () => {
    const f = parseProductFilters(new URLSearchParams("size=M&size=L,M&color=Đen"))
    expect(f.size).toEqual(["M", "L"])
    expect(f.color).toEqual(["Đen"])
  })

  it("nhận Record của Next searchParams", () => {
    const f = parseProductFilters({ size: ["S", "M"], maxPrice: "500000", gender: "WOMEN", inStock: "1" })
    expect(f).toMatchObject({ size: ["S", "M"], maxPrice: 500000, gender: "women", inStock: true })
  })

  it("giá trị sai rơi về mặc định thay vì ném lỗi", () => {
    const f = parseProductFilters({ page: "abc", sort: "hack", minPrice: "-5", gender: "alien", pageSize: "9999" })
    expect(f).toMatchObject({ page: 1, sort: "newest", pageSize: DEFAULT_PAGE_SIZE })
    expect(f.minPrice).toBeUndefined()
    expect(f.gender).toBeUndefined()
  })

  it("đảo minPrice/maxPrice khi nhập ngược", () => {
    const f = parseProductFilters({ minPrice: "900000", maxPrice: "100000" })
    expect([f.minPrice, f.maxPrice]).toEqual([100000, 900000])
  })
})

describe("serializeProductFilters", () => {
  it("bỏ giá trị mặc định và round-trip về đúng filter", () => {
    const f = parseProductFilters({ q: "áo thun", size: ["M", "L"], minPrice: "100000", sort: "price_asc", page: "3", inStock: "1" })
    const sp = serializeProductFilters(f)
    expect(sp.toString()).not.toContain("pageSize")
    expect(parseProductFilters(sp)).toEqual(f)
  })

  it("URL rỗng khi là filter mặc định; omitCategory bỏ category", () => {
    expect(serializeProductFilters(parseProductFilters({})).toString()).toBe("")
    const f = parseProductFilters({ category: "ao-thun" })
    expect(serializeProductFilters(f, { omitCategory: true }).has("category")).toBe(false)
  })
})

describe("season", () => {
  it("mặc định rỗng; nhận lặp key lẫn phân tách dấu phẩy, bỏ trùng", () => {
    expect(parseProductFilters({}).season).toEqual([])
    expect(parseProductFilters(new URLSearchParams("season=hè&season=thu,hè")).season).toEqual(["hè", "thu"])
  })

  it("đi vào URL và round-trip về đúng filter", () => {
    const f = parseProductFilters({ season: ["hè", "xuân"], gender: "men" })
    const sp = serializeProductFilters(f)
    expect(sp.getAll("season")).toEqual(["hè", "xuân"])
    expect(parseProductFilters(sp)).toEqual(f)
  })
})

describe("productFilterSchema", () => {
  it("idempotent: parse lại output cho đúng output (service có thể parse input từ AI)", () => {
    const once = productFilterSchema.parse({ size: "M,L", inStock: true, gender: "men", page: 2 })
    expect(productFilterSchema.parse(once)).toEqual(once)
  })
})
