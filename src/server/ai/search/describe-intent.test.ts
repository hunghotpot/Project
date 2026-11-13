import { describe, expect, it } from "vitest"
import { describeIntent } from "./describe-intent"
import { buildSearchIntent } from "./intent"

const chips = (q: string) => describeIntent(buildSearchIntent(q, { colors: ["Trắng", "Đen"] })).map((c) => c.label)

describe("describeIntent", () => {
  it("điều kiện cứng: giới tính, loại, giá, size, màu", () => {
    expect(chips("áo sơ mi trắng size M nam dưới 500k")).toEqual([
      "Nam (gồm unisex)",
      "Áo sơ mi",
      "Dưới 500.000 đ",
      "Size M",
      "Màu Trắng",
    ])
  })

  it("điều kiện mềm hiện sau, đánh dấu soft", () => {
    const result = describeIntent(buildSearchIntent("đồ đi biển cho nữ", { colors: [] }))
    expect(result.map((c) => c.label)).toEqual(["Nữ (gồm unisex)", "Dịp: đi biển", "Mùa: hè"])
    expect(result.map((c) => c.soft)).toEqual([false, true, true])
  })

  it("hiển thị phong cách bằng nhãn tiếng Việt", () => {
    expect(chips("lên đồ sang chảnh")).toEqual(["Phong cách: Thanh lịch, Lịch sự"])
  })

  it("khoảng giá và giá tối thiểu", () => {
    expect(chips("từ 200k đến 500k")).toEqual(["200.000 đ – 500.000 đ"])
    expect(chips("trên 1tr2")).toEqual(["Trên 1.200.000 đ"])
    expect(chips("tối đa 1,5tr")).toEqual(["Tối đa 1.500.000 đ"])
  })

  it("unisex và câu không có điều kiện nào", () => {
    expect(chips("áo thun nam nữ")).toEqual(["Unisex", "Áo thun"])
    expect(chips("xin chào")).toEqual([])
  })
})
