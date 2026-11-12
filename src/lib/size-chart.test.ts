import { describe, expect, it } from "vitest"
import { pickSizeChartRows } from "@/lib/size-chart"

const row = (size: string, brand: string | null, chest: number | null = 90) => ({
  brand,
  size,
  chest,
  waist: 70,
  hip: 94,
  heightMin: 160,
  heightMax: 170,
  weightMin: 50,
  weightMax: 60,
})

describe("pickSizeChartRows", () => {
  it("chỉ có bảng chung: dùng bảng chung, sắp theo thứ tự size", () => {
    const rows = pickSizeChartRows([row("L", null), row("S", null), row("XL", null), row("M", null)])
    expect(rows.map((r) => r.size)).toEqual(["S", "M", "L", "XL"])
  })

  it("có bảng riêng của brand: bảng riêng thắng, bỏ hoàn toàn dòng chung", () => {
    const rows = pickSizeChartRows([row("S", null, 88), row("M", null, 92), row("S", "Urban Ghost", 104), row("M", "Urban Ghost", 108)])
    expect(rows.map((r) => r.chest)).toEqual([104, 108])
  })

  it("không có dữ liệu thì trả mảng rỗng", () => {
    expect(pickSizeChartRows([])).toEqual([])
  })

  it("không rò trường brand ra kết quả; chest null (quần) được giữ nguyên", () => {
    const [first] = pickSizeChartRows([row("30", null, null)])
    expect(first).not.toHaveProperty("brand")
    expect(first.chest).toBeNull()
  })

  it("size số của quần xếp theo giá trị số", () => {
    const rows = pickSizeChartRows([row("32", null, null), row("28", null, null), row("30", null, null)])
    expect(rows.map((r) => r.size)).toEqual(["28", "30", "32"])
  })
})
