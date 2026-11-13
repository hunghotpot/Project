import { describe, expect, it } from "vitest"
import { COLORS, OCCASIONS } from "../../../prisma/seed-data/vocab"
import { PRODUCT_GROUPS } from "../../../prisma/seed-data/categories"
import { STYLE_LABEL } from "@/lib/format"
import { findSynonymHints, VI_SYNONYMS } from "./vi-synonyms"

const colorNames = new Set<string>(Object.values(COLORS).map((c) => c.name))
const categoryKeys = new Set(Object.keys(PRODUCT_GROUPS))
const styleKeys = new Set(Object.keys(STYLE_LABEL))
const occasions = new Set<string>(OCCASIONS)

describe("vi-synonyms: dữ liệu từ điển", () => {
  it("có 50–150 mục và mỗi mục có ít nhất một từ", () => {
    expect(VI_SYNONYMS.length).toBeGreaterThanOrEqual(50)
    expect(VI_SYNONYMS.length).toBeLessThanOrEqual(150)
    for (const e of VI_SYNONYMS) expect(e.terms.length, e.terms.join()).toBeGreaterThan(0)
  })

  it("giá trị gợi ý thuộc từ vựng thật của kho", () => {
    for (const { terms, hint } of VI_SYNONYMS) {
      const id = terms[0]
      if (hint.category) expect(categoryKeys.has(hint.category), `${id}: category ${hint.category}`).toBe(true)
      for (const o of hint.occasion ?? []) expect(occasions.has(o), `${id}: occasion ${o}`).toBe(true)
      for (const s of hint.style ?? []) expect(styleKeys.has(s), `${id}: style ${s}`).toBe(true)
      for (const c of hint.color ?? []) expect(colorNames.has(c), `${id}: color ${c}`).toBe(true)
    }
  })

  it("không có từ nào xuất hiện ở hai mục khác nhau", () => {
    const seen = new Map<string, string>()
    for (const { terms } of VI_SYNONYMS) {
      for (const t of terms) {
        const key = t.toLowerCase()
        expect(seen.has(key), `"${t}" trùng với mục "${seen.get(key)}"`).toBe(false)
        seen.set(key, terms[0])
      }
    }
  })

  it("mọi giá trị occasion chuẩn đều có ít nhất một từ gợi ý", () => {
    const covered = new Set(VI_SYNONYMS.flatMap((e) => e.hint.occasion ?? []))
    expect(OCCASIONS.filter((o) => !covered.has(o))).toEqual([])
  })
})

describe("findSynonymHints", () => {
  it("đọc dịp, giới tính và mùa từ câu có dấu", () => {
    const h = findSynonymHints("Đồ đi biển cho nữ mùa hè")
    expect(h.occasion).toContain("đi biển")
    expect(h.gender).toBe("women")
    expect(h.season).toContain("hè")
  })

  it("hiểu câu không dấu", () => {
    const h = findSynonymHints("ao khoac am di du lich")
    expect(h.category).toBe("ao-khoac")
    expect(h.occasion).toContain("du lịch")
  })

  it("hiểu từ lóng và viết tắt", () => {
    expect(findSynonymHints("quần bò ống rộng").category).toBe("quan-jeans")
    expect(findSynonymHints("áo phông basic").style).toContain("minimalist")
    expect(findSynonymHints("mặc gì đi ăn cưới").occasion).toContain("dự đám cưới")
    expect(findSynonymHints("đồ đi chơi tối").occasion).toEqual(expect.arrayContaining(["hẹn hò", "dự tiệc"]))
  })

  it("'lạnh' không lẫn với 'lanh' (vải lanh)", () => {
    expect(findSynonymHints("áo vải lanh").material).toEqual(["linen"])
    expect(findSynonymHints("áo vải lanh").season).toBeUndefined()
    expect(findSynonymHints("trời lạnh").season).toEqual(["đông"])
  })

  it("không khớp một nửa từ", () => {
    expect(findSynonymHints("settings").outfit).toBeUndefined()
    expect(findSynonymHints("t-shirt").category).toBe("ao-thun")
  })

  it("nhận ý định đặc biệt: bộ đồ, còn hàng, ngoài phạm vi", () => {
    expect(findSynonymHints("set đồ nam lịch sự đi đám cưới").outfit).toBe(true)
    expect(findSynonymHints("áo sơ mi trắng còn hàng").inStock).toBe(true)
    expect(findSynonymHints("quần áo trẻ em").outOfScope).toBeDefined()
  })

  it("ví dụ docs: 'mát' gợi mùa hè và chất liệu thoáng; 'sang chảnh' gợi style", () => {
    const h = findSynonymHints("áo sơ mi mát")
    expect(h.category).toBe("ao-so-mi")
    expect(h.season).toContain("hè")
    expect(findSynonymHints("lên đồ sang chảnh").style).toEqual(expect.arrayContaining(["elegant", "formal"]))
  })

  it("câu không có từ nào trong từ điển trả về gợi ý rỗng", () => {
    expect(findSynonymHints("xin chào")).toEqual({})
  })
})
