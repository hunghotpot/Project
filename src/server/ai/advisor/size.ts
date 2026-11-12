import { sizeRank } from "@/lib/product-variants"
import type { MeasureField, SizeRecommendationView } from "@/types/assistant"
import type { SizeChartRow } from "@/types/catalog"

/*
 * Tư vấn size: hàm thuần, deterministic, KHÔNG dùng LLM và không đụng DB (đầu vào là bảng size đã đọc bằng
 * catalog.service.getSizeChart). Thiết kế: docs/ai/03-rag-advisor.md mục 2. Các ngưỡng bên dưới là heuristic đề xuất,
 * chưa hiệu chỉnh với số liệu may đo thật; chỉnh ở một chỗ (THRESHOLDS) khi có dữ liệu.
 */

export const THRESHOLDS = {
  /** Mỗi 1cm chiều cao ngoài khoảng của size bị phạt 1/HEIGHT_CM điểm. */
  HEIGHT_CM: 5,
  /** Mỗi 1kg cân nặng ngoài khoảng bị phạt 1/WEIGHT_KG điểm. */
  WEIGHT_KG: 4,
  /** Độ lệch trung bình (cm) của các số đo cơ thể; mỗi BODY_CM cm lệch bị phạt 1 điểm. */
  BODY_CM: 3,
  /** Điểm tốt nhất vượt ngưỡng này: số đo nằm ngoài bảng. */
  OUT_OF_RANGE: 1.5,
  /** Hai size đầu chênh điểm dưới ngưỡng này: coi là nằm giữa hai size. */
  BETWEEN_GAP: 0.5,
  /** Điểm không vượt ngưỡng này: độ tin cậy trung bình (0 = cao). */
  MEDIUM_CONFIDENCE: 1,
} as const

export type SizeKind = "top" | "bottom" | "dress" | "other"
export type FitPreference = "tight" | "regular" | "loose"

export interface SizeAdviceInput {
  /** Bảng size đã chọn đúng theo category/brand (có thể rỗng). */
  chart: SizeChartRow[]
  kind: SizeKind
  heightCm?: number
  weightKg?: number
  chestCm?: number
  waistCm?: number
  hipCm?: number
  fit?: FitPreference
  /** Chất liệu co giãn (tên chứa "co giãn", "spandex", "thun"...): nghiêng size nhỏ khi nằm giữa. */
  stretch?: boolean
  productName?: string | null
  /** Ghi chú về bảng (ví dụ bảng riêng của thương hiệu form rộng); được thêm vào lý do. */
  chartNote?: string | null
  /** size -> các màu còn hàng. Bỏ trống = không kiểm tồn kho. */
  stockBySize?: Record<string, string[]>
}

const REQUIRED_BODY: Record<SizeKind, MeasureField[]> = {
  top: ["chestCm"],
  bottom: ["waistCm"],
  dress: ["chestCm", "waistCm", "hipCm"],
  other: [],
}

const BODY_FIELDS = ["chestCm", "waistCm", "hipCm"] as const
const CHART_KEY = { chestCm: "chest", waistCm: "waist", hipCm: "hip" } as const
const BODY_LABEL = { chestCm: "Vòng ngực", waistCm: "Vòng eo", hipCm: "Vòng mông" } as const

const empty = (over: Partial<SizeRecommendationView>): SizeRecommendationView => ({
  status: "need_info",
  productName: null,
  recommendedSize: null,
  alternativeSize: null,
  confidence: "low",
  reasons: [],
  missingFields: [],
  stock: null,
  message: null,
  ...over,
})

function rangeDeviation(value: number, min: number, max: number): number {
  return value < min ? min - value : value > max ? value - max : 0
}

interface Scored {
  row: SizeChartRow
  score: number
}

function scoreRow(row: SizeChartRow, input: SizeAdviceInput): number {
  let score = 0
  if (input.heightCm !== undefined) score += rangeDeviation(input.heightCm, row.heightMin, row.heightMax) / THRESHOLDS.HEIGHT_CM
  if (input.weightKg !== undefined) score += rangeDeviation(input.weightKg, row.weightMin, row.weightMax) / THRESHOLDS.WEIGHT_KG

  const diffs: number[] = []
  for (const f of BODY_FIELDS) {
    const given = input[f]
    const ref = row[CHART_KEY[f]]
    if (given !== undefined && ref !== null) diffs.push(Math.abs(given - ref))
  }
  if (diffs.length > 0) score += diffs.reduce((a, b) => a + b, 0) / diffs.length / THRESHOLDS.BODY_CM
  return score
}

function reasonsFor(row: SizeChartRow, input: SizeAdviceInput, chart: SizeChartRow[]): string[] {
  const out: string[] = []
  const { size } = row
  if (input.heightCm !== undefined) {
    const dev = rangeDeviation(input.heightCm, row.heightMin, row.heightMax)
    if (dev === 0) out.push(`${input.heightCm}cm nằm trong khoảng ${row.heightMin}–${row.heightMax}cm của size ${size}`)
    else out.push(`${input.heightCm}cm lệch ${dev}cm so với khoảng ${row.heightMin}–${row.heightMax}cm của size ${size}`)
    const minChart = Math.min(...chart.map((r) => r.heightMin))
    if (input.heightCm < minChart) out.push(`Chiều cao thấp hơn mốc nhỏ nhất của bảng (${minChart}cm)`)
  }
  if (input.weightKg !== undefined) {
    const dev = rangeDeviation(input.weightKg, row.weightMin, row.weightMax)
    if (dev === 0) out.push(`${input.weightKg}kg nằm trong khoảng ${row.weightMin}–${row.weightMax}kg của size ${size}`)
    else out.push(`${input.weightKg}kg lệch ${dev}kg so với khoảng ${row.weightMin}–${row.weightMax}kg của size ${size}`)
    const minChart = Math.min(...chart.map((r) => r.weightMin))
    if (input.weightKg < minChart) out.push(`Cân nặng thấp hơn mốc nhỏ nhất của bảng (${minChart}kg)`)
  }
  for (const f of BODY_FIELDS) {
    const given = input[f]
    const ref = row[CHART_KEY[f]]
    if (given !== undefined && ref !== null) out.push(`${BODY_LABEL[f]} ${given}cm, mốc của size ${size} là ${ref}cm`)
  }
  return out
}

/** Chọn size lớn hay nhỏ khi nằm giữa hai size, kèm lý do. */
function chooseSide(smaller: SizeChartRow, input: SizeAdviceInput): { larger: boolean; why: string } {
  const fit = input.fit ?? "regular"
  if (input.kind === "dress") return { larger: true, why: "Váy đầm khó nới ở ngực và hông nên mình chọn size lớn hơn" }
  if (input.kind === "bottom" && input.hipCm !== undefined && input.hipCm > smaller.hip) {
    return { larger: true, why: `Vòng mông ${input.hipCm}cm lớn hơn mốc ${smaller.hip}cm của size ${smaller.size} nên chọn size lớn hơn` }
  }
  if (fit === "loose") return { larger: true, why: "Bạn thích mặc rộng nên mình chọn size lớn hơn" }
  if (fit === "tight") return { larger: false, why: "Bạn thích mặc ôm nên mình chọn size nhỏ hơn" }
  if (input.stretch) return { larger: false, why: "Chất liệu co giãn nên size nhỏ hơn vẫn thoải mái" }
  return { larger: true, why: "Nằm giữa hai size, mình chọn size lớn hơn cho thoải mái" }
}

function stockView(size: string, input: SizeAdviceInput): SizeRecommendationView["stock"] {
  if (!input.stockBySize) return null
  const colors = input.stockBySize[size] ?? []
  return { size, available: colors.length > 0, colors }
}

export function getSizeRecommendation(input: SizeAdviceInput): SizeRecommendationView {
  const base = { productName: input.productName ?? null }
  const chart = [...input.chart].sort((a, b) => sizeRank(a.size) - sizeRank(b.size))

  if (chart.length === 0) {
    return empty({ ...base, status: "no_chart", message: "Sản phẩm này không có bảng size. Bạn xem thêm mô tả sản phẩm nhé." })
  }

  // Đủ thông tin tối thiểu: chiều cao + cân nặng, hoặc số đo cơ thể phù hợp loại sản phẩm.
  const hasHW = input.heightCm !== undefined && input.weightKg !== undefined
  const required = REQUIRED_BODY[input.kind]
  const hasBody = required.length > 0 ? required.every((f) => input[f] !== undefined) : BODY_FIELDS.some((f) => input[f] !== undefined)
  if (!hasHW && !hasBody) {
    const missing: MeasureField[] = []
    if (input.heightCm === undefined) missing.push("heightCm")
    if (input.weightKg === undefined) missing.push("weightKg")
    return empty({ ...base, missingFields: missing })
  }

  const scored: Scored[] = chart.map((row) => ({ row, score: scoreRow(row, input) }))
  const ranked = [...scored].sort((a, b) => a.score - b.score || sizeRank(a.row.size) - sizeRank(b.row.size))
  const best = ranked[0]

  if (best.score > THRESHOLDS.OUT_OF_RANGE) {
    const last = chart[chart.length - 1]
    return empty({
      ...base,
      status: "out_of_range",
      message: `Số đo của bạn nằm ngoài bảng size hiện có (size lớn nhất là ${last.size}: ${last.heightMin}–${last.heightMax}cm, ${last.weightMin}–${last.weightMax}kg) nên mình chưa thể gợi ý size.`,
    })
  }

  const second = ranked[1]
  const adjacent = second && Math.abs(chart.indexOf(best.row) - chart.indexOf(second.row)) === 1
  const between = !!second && adjacent && second.score - best.score < THRESHOLDS.BETWEEN_GAP

  if (!between) {
    const reasons = reasonsFor(best.row, input, chart)
    if (input.chartNote) reasons.push(input.chartNote)
    const size = best.row.size
    const stock = stockView(size, input)
    if (stock && !stock.available && input.stockBySize) {
      const i = chart.indexOf(best.row)
      const near = [chart[i + 1], chart[i - 1]].find((r) => r && (input.stockBySize![r.size]?.length ?? 0) > 0)
      reasons.push(near ? `Size ${size} đang hết hàng; size liền kề còn hàng: ${near.size}` : `Size ${size} đang hết hàng`)
    }
    return {
      ...empty(base),
      status: "recommended",
      recommendedSize: size,
      confidence: best.score === 0 ? "high" : best.score <= THRESHOLDS.MEDIUM_CONFIDENCE ? "medium" : "low",
      reasons: reasons.slice(0, 4),
      stock,
    }
  }

  const [smaller, larger] = chart.indexOf(best.row) < chart.indexOf(second.row) ? [best.row, second.row] : [second.row, best.row]
  const side = chooseSide(smaller, input)
  const pick = side.larger ? larger : smaller
  const other = side.larger ? smaller : larger
  const reasons = [...reasonsFor(pick, input, chart).slice(0, 2), `Số đo của bạn cũng gần với size ${other.size}`, side.why]
  if (input.chartNote) reasons.push(input.chartNote)

  return {
    ...empty(base),
    status: "between_two",
    recommendedSize: pick.size,
    alternativeSize: other.size,
    confidence: best.score <= THRESHOLDS.MEDIUM_CONFIDENCE ? "medium" : "low",
    reasons: reasons.slice(0, 5),
    stock: stockView(pick.size, input),
  }
}
