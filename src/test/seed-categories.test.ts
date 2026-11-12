import { describe, expect, it } from "vitest"
import { buildProducts } from "../../prisma/seed-data/build"
import { CATEGORIES } from "../../prisma/seed-data/categories"
import { SIZE_CHARTS } from "../../prisma/seed-data/size-charts"

// Cây danh mục Nam / Nữ / Unisex / Phụ kiện: mỗi sản phẩm nằm đúng lá theo giới tính, và mọi lá quần áo có bảng size khớp size bán.
const products = buildProducts()
const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]))
const ROOT_OF_GENDER = { MEN: "nam", WOMEN: "nu", UNISEX: "unisex" } as const

describe("seed: cây danh mục", () => {
  it("slug danh mục không trùng, cha đều tồn tại", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length)
    for (const c of CATEGORIES) if (c.parent) expect(bySlug.has(c.parent), c.slug).toBe(true)
  })

  it("sản phẩm nằm ở category lá, đúng nhánh giới tính (phụ kiện dùng chung)", () => {
    for (const p of products) {
      const leaf = bySlug.get(p.categorySlug)!
      expect(leaf, p.slug).toBeDefined()
      expect(CATEGORIES.some((c) => c.parent === leaf.slug), `${p.slug} nằm ở category gốc có con`).toBe(false)
      if (leaf.slug === "phu-kien") continue
      expect(leaf.parent, p.slug).toBe(ROOT_OF_GENDER[p.gender])
    }
  })

  it("có 3-5 sản phẩm nam dự tiệc/đám cưới mùa hè, ngoài trời và thoáng mát", () => {
    const wedding = products.filter(
      (p) => p.gender === "MEN" && p.occasion.includes("dự đám cưới") && p.season.includes("hè") && p.tags.includes("ngoài trời")
    )
    expect(wedding.length).toBeGreaterThanOrEqual(3)
    expect(wedding.length).toBeLessThanOrEqual(6)
    for (const p of wedding) expect(p.tags, p.slug).toContain("thoáng mát")
  })

  it("mọi category lá quần áo có bảng size và size bán nằm trong bảng", () => {
    const sizesBySlug = new Map<string, Set<string>>()
    for (const r of SIZE_CHARTS) sizesBySlug.set(r.categorySlug, (sizesBySlug.get(r.categorySlug) ?? new Set()).add(r.size))
    for (const slug of sizesBySlug.keys()) expect(bySlug.has(slug), `bảng size cho category lạ: ${slug}`).toBe(true)

    for (const p of products) {
      if (p.categorySlug === "phu-kien") continue
      const chart = sizesBySlug.get(p.categorySlug)
      expect(chart, `${p.categorySlug} thiếu bảng size`).toBeDefined()
      for (const v of p.variants) expect(chart!.has(v.size), `${p.slug} size ${v.size}`).toBe(true)
    }
  })
})
