import { describe, expect, it } from "vitest"
import {
  findVariant,
  imagesForColor,
  initialSelection,
  listSizes,
  optionState,
  priceRange,
  select,
  type VariantLike,
} from "./product-variants"

const v = (color: string, size: string, stock: number, price = 100): VariantLike => ({
  id: `${color}-${size}`,
  color,
  size,
  colorHex: "#000",
  price,
  stock,
})

// Đen: S,M còn · L hết | Trắng: chỉ có M (còn), không có S/L | Xám: hết sạch
const variants = [
  v("Đen", "S", 5),
  v("Đen", "M", 3, 120),
  v("Đen", "L", 0),
  v("Trắng", "M", 2),
  v("Xám", "S", 0),
  v("Xám", "M", 0),
]

describe("optionState", () => {
  it("phân biệt còn hàng / hết hàng / tổ hợp không tồn tại", () => {
    expect(optionState(variants, { color: "Đen" }, "size", "S")).toBe("available")
    expect(optionState(variants, { color: "Đen" }, "size", "L")).toBe("soldout")
    expect(optionState(variants, { color: "Trắng" }, "size", "S")).toBe("unavailable")
    expect(optionState(variants, {}, "color", "Xám")).toBe("soldout")
  })

  it("chưa chọn trục còn lại thì xét mọi biến thể của giá trị đó", () => {
    expect(optionState(variants, {}, "size", "L")).toBe("soldout")
    expect(optionState(variants, {}, "size", "S")).toBe("available")
  })
})

describe("select", () => {
  it("không cho chọn giá trị hết hàng hoặc không tồn tại", () => {
    expect(select(variants, { color: "Đen" }, "size", "L")).toEqual({ color: "Đen" })
    expect(select(variants, { color: "Trắng" }, "size", "S")).toEqual({ color: "Trắng" })
  })

  it("đã chọn size thì chỉ đổi được sang màu có đúng size đó còn hàng", () => {
    expect(select(variants, { color: "Đen", size: "S" }, "color", "Trắng")).toEqual({ color: "Đen", size: "S" })
    expect(select(variants, { color: "Đen", size: "M" }, "color", "Trắng")).toEqual({ color: "Trắng", size: "M" })
  })

  it("chọn đủ màu + size thì tìm ra đúng biến thể", () => {
    const sel = select(variants, select(variants, {}, "color", "Đen"), "size", "M")
    expect(findVariant(variants, sel)?.id).toBe("Đen-M")
  })
})

describe("giá, size, chọn sẵn", () => {
  it("giá theo biến thể đang chọn, khoảng giá khi chưa chọn", () => {
    expect(priceRange(variants, { color: "Đen", size: "M" })).toEqual({ min: 120, max: 120 })
    expect(priceRange(variants, {})).toEqual({ min: 100, max: 120 })
  })

  it("sắp size S<M<L, số tăng dần, Free size cuối", () => {
    expect(listSizes([v("a", "L", 1), v("a", "Free size", 1), v("a", "30", 1), v("a", "S", 1), v("a", "29", 1)])).toEqual([
      "S",
      "L",
      "29",
      "30",
      "Free size",
    ])
  })

  it("chọn sẵn khi chỉ có 1 màu / 1 size", () => {
    expect(initialSelection([v("Đen", "Free size", 3)])).toEqual({ color: "Đen", size: "Free size" })
    expect(initialSelection(variants)).toEqual({})
  })
})

describe("imagesForColor", () => {
  const imgs = [
    { url: "a", color: "Đen" },
    { url: "b", color: "Trắng" },
    { url: "c", color: null },
  ]
  it("ảnh của màu đang chọn lên đầu, kèm ảnh chung", () => {
    expect(imagesForColor(imgs, "Trắng").map((i) => i.url)).toEqual(["b", "c"])
  })
  it("màu không có ảnh riêng hoặc chưa chọn thì giữ nguyên", () => {
    expect(imagesForColor(imgs, "Xám")).toBe(imgs)
    expect(imagesForColor(imgs)).toBe(imgs)
  })
})

