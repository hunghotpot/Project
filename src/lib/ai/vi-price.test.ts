import { describe, expect, it } from "vitest"
import { parsePriceRange } from "./vi-price"

describe("parsePriceRange: giá tối đa", () => {
  it.each([
    ["dưới 500k", 499_999],
    ["quần jeans nam dưới 500k", 499_999],
    ["đồ công sở nữ thanh lịch dưới 600k", 599_999],
    ["DƯỚI 500K", 499_999],
    ["dưới 500 k", 499_999],
    ["dưới 300 nghìn", 299_999],
    ["dưới 300 ngàn", 299_999],
    ["dưới 1 triệu", 999_999],
    ["dưới 1tr", 999_999],
    ["dưới 1tr2", 1_199_999],
    ["dưới 1tr25", 1_249_999],
    ["dưới 1tr250", 1_249_999],
    ["dưới 1,5 triệu", 1_499_999],
    ["dưới 1.5tr", 1_499_999],
    ["rẻ hơn 400k", 399_999],
    ["<500k", 499_999],
  ])("%s → maxPrice %i", (q, max) => {
    expect(parsePriceRange(q)).toEqual({ maxPrice: max })
  })

  it.each([
    ["không quá 800.000đ", 800_000],
    ["tối đa 1,5tr", 1_500_000],
    ["tối đa 500.000", 500_000],
    ["≤ 600k", 600_000],
    ["ngân sách 300k", 300_000],
    ["500k trở xuống", 500_000],
  ])("%s → maxPrice %i (bao gồm mốc)", (q, max) => {
    expect(parsePriceRange(q)).toEqual({ maxPrice: max })
  })
})

describe("parsePriceRange: giá tối thiểu và khoảng", () => {
  it.each([
    ["trên 1tr2", { minPrice: 1_200_001 }],
    ["trên 500k", { minPrice: 500_001 }],
    ["từ 500k trở lên", { minPrice: 500_000 }],
    ["tối thiểu 300k", { minPrice: 300_000 }],
    ["từ 300k đến 500k", { minPrice: 300_000, maxPrice: 500_000 }],
    ["300k-500k", { minPrice: 300_000, maxPrice: 500_000 }],
    ["từ 300 đến 500k", { minPrice: 300_000, maxPrice: 500_000 }],
    ["từ 1 đến 2 triệu", { minPrice: 1_000_000, maxPrice: 2_000_000 }],
    ["từ 500k đến 300k", { minPrice: 300_000, maxPrice: 500_000 }],
    ["trên 200k dưới 500k", { minPrice: 200_001, maxPrice: 499_999 }],
  ])("%s", (q, expected) => {
    expect(parsePriceRange(q)).toEqual(expected)
  })
})

describe("parsePriceRange: số tiền không nêu hướng hiểu là khoảng ±20%", () => {
  it.each([
    ["tầm 500k", { minPrice: 400_000, maxPrice: 600_000 }],
    ["khoảng 1tr", { minPrice: 800_000, maxPrice: 1_200_000 }],
    ["áo thun 200k", { minPrice: 160_000, maxPrice: 240_000 }],
    ["500.000", { minPrice: 400_000, maxPrice: 600_000 }],
    ["500000đ", { minPrice: 400_000, maxPrice: 600_000 }],
    ["1tr25", { minPrice: 1_000_000, maxPrice: 1_500_000 }],
  ])("%s", (q, expected) => {
    expect(parsePriceRange(q)).toEqual(expected)
  })
})

describe("parsePriceRange: tiếng lóng và cách viết khác", () => {
  it.each([
    ["dưới 2 củ", { maxPrice: 1_999_999 }],
    ["dưới 2 củ rưỡi", { maxPrice: 2_499_999 }],
    ["dưới 2tr rưỡi", { maxPrice: 2_499_999 }],
    ["dưới nửa triệu", { maxPrice: 499_999 }],
    ["dưới 3 chai", { maxPrice: 299_999 }],
    ["dưới 3 lít", { maxPrice: 299_999 }],
    ["không dấu: duoi 500k", { maxPrice: 499_999 }],
    ["quà tặng bạn gái dưới 300k", { maxPrice: 299_999 }],
  ])("%s", (q, expected) => {
    expect(parsePriceRange(q)).toEqual(expected)
  })
})

describe("parsePriceRange: không nhầm số khác với giá", () => {
  it.each(["áo thun nam", "size 32", "quần size 30", "mua 2 cái áo", "năm 2024", "áo 100% cotton", "mặc gì đi hẹn hò tối nay", ""])(
    "%j không có giá",
    (q) => {
      expect(parsePriceRange(q)).toEqual({})
    },
  )

  it("bỏ qua số quá lớn không phải giá quần áo", () => {
    expect(parsePriceRange("dưới 500 triệu")).toEqual({})
  })

  it("điều kiện mâu thuẫn thì bỏ cả hai", () => {
    expect(parsePriceRange("dưới 100k trên 200k")).toEqual({})
  })

  it("đơn vị đứng sát chữ khác không bị đọc nhầm (trắng, đen, trang)", () => {
    expect(parsePriceRange("áo 2 trắng")).toEqual({})
    expect(parsePriceRange("váy 3 đen dưới 500k")).toEqual({ maxPrice: 499_999 })
  })
})
