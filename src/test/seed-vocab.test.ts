import { describe, expect, it } from "vitest"
import { buildProducts } from "../../prisma/seed-data/build"
import { OCCASIONS } from "../../prisma/seed-data/vocab"

// Dữ liệu seed là nguồn của từ vựng mà bộ lọc `occasion` (so khớp chính xác) và tìm kiếm AI dựa vào.
const products = buildProducts()

describe("seed: từ vựng occasion", () => {
  it("mọi occasion nằm trong danh sách chuẩn (OCCASIONS)", () => {
    const allowed = new Set<string>(OCCASIONS)
    const outside = products.flatMap((p) => p.occasion.filter((o) => !allowed.has(o)).map((o) => `${p.slug}: ${o}`))
    expect(outside).toEqual([])
  })

  it("mỗi sản phẩm có ít nhất một occasion và không trùng giá trị", () => {
    for (const p of products) {
      expect(p.occasion.length, p.slug).toBeGreaterThan(0)
      expect(new Set(p.occasion).size, p.slug).toBe(p.occasion.length)
    }
  })

  it("danh sách chuẩn không có giá trị thừa (mọi giá trị đều được dùng)", () => {
    const used = new Set(products.flatMap((p) => p.occasion))
    expect(OCCASIONS.filter((o) => !used.has(o))).toEqual([])
  })

  it("hoạt động chi tiết đã gộp vẫn còn tìm được qua tags", () => {
    const tagsOf = (slug: string) => products.find((p) => p.slug === slug)?.tags ?? []
    expect(tagsOf("ao-tap-yoga-nu-crop-om")).toContain("tập yoga")
    expect(tagsOf("vay-tennis-xep-ly")).toContain("chơi tennis")
    expect(tagsOf("ao-polo-ca-sau-basic")).toContain("chơi golf")
  })
})

describe("seed: dữ liệu dùng cho embedding", () => {
  it("mô tả > 200 ký tự và đủ style/season/tags", () => {
    for (const p of products) {
      expect(p.description.length, p.slug).toBeGreaterThan(200)
      expect(p.style, p.slug).not.toBe("")
      expect(p.season.length, p.slug).toBeGreaterThan(0)
      expect(p.tags.length, p.slug).toBeGreaterThan(0)
    }
  })
})
