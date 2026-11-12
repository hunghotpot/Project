import { describe, expect, it } from "vitest"
import { getSizeRecommendation } from "@/server/ai/advisor/size"
import type { SizeChartRow } from "@/types/catalog"

// Bảng size lấy từ seed (prisma/seed-data/size-charts.ts), cùng số liệu với DB.
const row = (size: string, chest: number | null, waist: number, hip: number, h: [number, number], w: [number, number]): SizeChartRow => ({
  size,
  chest,
  waist,
  hip,
  heightMin: h[0],
  heightMax: h[1],
  weightMin: w[0],
  weightMax: w[1],
})

const SHIRT = [
  row("S", 88, 74, 90, [160, 167], [50, 58]),
  row("M", 92, 78, 94, [165, 172], [58, 66]),
  row("L", 96, 82, 98, [170, 177], [66, 74]),
  row("XL", 100, 86, 102, [175, 182], [74, 82]),
]

const JEANS = [
  row("28", null, 71, 90, [160, 166], [50, 56]),
  row("29", null, 74, 92, [162, 168], [53, 59]),
  row("30", null, 76, 94, [164, 170], [56, 62]),
  row("31", null, 79, 96, [166, 172], [59, 65]),
  row("32", null, 81, 98, [168, 174], [62, 68]),
  row("33", null, 84, 100, [170, 176], [65, 71]),
  row("34", null, 86, 102, [172, 178], [68, 74]),
]

const DRESS = [
  row("S", 82, 64, 90, [155, 160], [44, 48]),
  row("M", 86, 68, 94, [158, 163], [48, 53]),
  row("L", 90, 72, 98, [161, 166], [53, 58]),
  row("XL", 94, 76, 102, [164, 169], [58, 64]),
]

const URBAN_GHOST = [
  row("S", 104, 90, 104, [158, 168], [48, 60]),
  row("M", 108, 94, 108, [163, 173], [56, 68]),
  row("L", 112, 98, 112, [168, 178], [64, 76]),
  row("XL", 116, 102, 116, [173, 183], [72, 86]),
]

describe("getSizeRecommendation: 9 ca trong docs/ai/03-rag-advisor.md", () => {
  it("A: 168cm, 60kg → M, tin cậy cao", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 168, weightKg: 60 })
    expect(r.status).toBe("recommended")
    expect(r.recommendedSize).toBe("M")
    expect(r.confidence).toBe("high")
    expect(r.alternativeSize).toBeNull()
  })

  it("B: 170cm, 66kg → giữa M và L, mặc định khuyên L", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 170, weightKg: 66 })
    expect(r.status).toBe("between_two")
    expect(r.recommendedSize).toBe("L")
    expect(r.alternativeSize).toBe("M")
  })

  it("B': cùng số đo nhưng thích mặc ôm → khuyên M", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 170, weightKg: 66, fit: "tight" })
    expect(r.recommendedSize).toBe("M")
    expect(r.alternativeSize).toBe("L")
  })

  it("C: 158cm, 48kg → S, tin cậy trung bình, ghi chú dưới mốc nhỏ nhất", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 158, weightKg: 48 })
    expect(r.status).toBe("recommended")
    expect(r.recommendedSize).toBe("S")
    expect(r.confidence).toBe("medium")
    expect(r.reasons.join(" ")).toContain("thấp hơn mốc nhỏ nhất")
  })

  it("D: 185cm, 95kg → ngoài bảng, không đưa size", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 185, weightKg: 95 })
    expect(r.status).toBe("out_of_range")
    expect(r.recommendedSize).toBeNull()
    expect(r.message).toContain("XL")
  })

  it("E: quần jeans, eo 80cm → giữa 31 và 32; chất liệu co giãn nghiêng 31", () => {
    const normal = getSizeRecommendation({ chart: JEANS, kind: "bottom", waistCm: 80 })
    expect(normal.status).toBe("between_two")
    expect(normal.recommendedSize).toBe("32")
    expect(normal.alternativeSize).toBe("31")

    const stretch = getSizeRecommendation({ chart: JEANS, kind: "bottom", waistCm: 80, stretch: true })
    expect(stretch.recommendedSize).toBe("31")
    expect(stretch.alternativeSize).toBe("32")
  })

  it("E': quần, hông lớn hơn mốc size nhỏ → chọn size lớn dù co giãn", () => {
    const r = getSizeRecommendation({ chart: JEANS, kind: "bottom", waistCm: 80, hipCm: 97, stretch: true })
    expect(r.recommendedSize).toBe("32")
  })

  it("F: váy, ngực 88/eo 70/hông 95 → giữa M và L, chọn L", () => {
    const r = getSizeRecommendation({ chart: DRESS, kind: "dress", chestCm: 88, waistCm: 70, hipCm: 95 })
    expect(r.status).toBe("between_two")
    expect(r.recommendedSize).toBe("L")
    expect(r.alternativeSize).toBe("M")
  })

  it("G: chỉ có chiều cao → cần thêm cân nặng", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 170 })
    expect(r.status).toBe("need_info")
    expect(r.missingFields).toEqual(["weightKg"])
    expect(r.recommendedSize).toBeNull()
  })

  it("G': không có số đo nào → hỏi cả chiều cao và cân nặng", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top" })
    expect(r.status).toBe("need_info")
    expect(r.missingFields).toEqual(["heightCm", "weightKg"])
  })

  it("H: sản phẩm không có bảng size (phụ kiện) → no_chart, không đoán", () => {
    const r = getSizeRecommendation({ chart: [], kind: "other", heightCm: 170, weightKg: 60 })
    expect(r.status).toBe("no_chart")
    expect(r.recommendedSize).toBeNull()
  })

  it("I: bảng Urban Ghost, 165cm/58kg → giữa S và M, kèm ghi chú form rộng", () => {
    const r = getSizeRecommendation({
      chart: URBAN_GHOST,
      kind: "top",
      heightCm: 165,
      weightKg: 58,
      chartNote: "Bảng Urban Ghost form rộng hơn bảng chung",
    })
    expect(r.status).toBe("between_two")
    expect(r.recommendedSize).toBe("M")
    expect(r.alternativeSize).toBe("S")
    expect(r.reasons.join(" ")).toContain("form rộng")
  })
})

describe("getSizeRecommendation: số đo cơ thể, tồn kho và tính chất", () => {
  it("áo chỉ có vòng ngực vẫn tư vấn được (không cần chiều cao/cân nặng)", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", chestCm: 92 })
    expect(r.status).toBe("recommended")
    expect(r.recommendedSize).toBe("M")
  })

  it("váy chỉ có vòng ngực (thiếu eo, hông, chiều cao, cân nặng) → need_info", () => {
    const r = getSizeRecommendation({ chart: DRESS, kind: "dress", chestCm: 86 })
    expect(r.status).toBe("need_info")
  })

  it("size đề xuất còn hàng: trả stock với các màu còn", () => {
    const r = getSizeRecommendation({
      chart: SHIRT,
      kind: "top",
      heightCm: 168,
      weightKg: 60,
      stockBySize: { M: ["Trắng", "Xám"], L: [] },
    })
    expect(r.stock).toEqual({ size: "M", available: true, colors: ["Trắng", "Xám"] })
  })

  it("size đề xuất hết hàng: báo hết và nêu size liền kề còn hàng", () => {
    const r = getSizeRecommendation({
      chart: SHIRT,
      kind: "top",
      heightCm: 168,
      weightKg: 60,
      stockBySize: { S: [], M: [], L: ["Đen"] },
    })
    expect(r.recommendedSize).toBe("M")
    expect(r.stock?.available).toBe(false)
    expect(r.reasons.join(" ")).toContain("size liền kề còn hàng: L")
  })

  it("không truyền stockBySize thì không kiểm tồn kho", () => {
    const r = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 168, weightKg: 60 })
    expect(r.stock).toBeNull()
  })

  it("bảng truyền vào lộn xộn vẫn cho kết quả đúng (tự sắp theo thứ tự size)", () => {
    const shuffled = [SHIRT[2], SHIRT[0], SHIRT[3], SHIRT[1]]
    const r = getSizeRecommendation({ chart: shuffled, kind: "top", heightCm: 168, weightKg: 60 })
    expect(r.recommendedSize).toBe("M")
  })

  it("không đổi bảng đầu vào và là hàm thuần (gọi lại cho cùng kết quả)", () => {
    const copy = JSON.stringify(SHIRT)
    const a = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 170, weightKg: 66 })
    const b = getSizeRecommendation({ chart: SHIRT, kind: "top", heightCm: 170, weightKg: 66 })
    expect(a).toEqual(b)
    expect(JSON.stringify(SHIRT)).toBe(copy)
  })
})
