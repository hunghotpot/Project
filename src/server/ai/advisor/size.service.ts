import "server-only"
import type { z } from "zod"
import type { sizeAdviceInputSchema } from "@/lib/validators/ai"
import { getSizeRecommendation, type SizeKind } from "@/server/ai/advisor/size"
import { getProductBySlug, getSizeChartInfo } from "@/server/services/catalog.service"
import type { SizeRecommendationView } from "@/types/assistant"
import type { SizeChartRow } from "@/types/catalog"

/*
 * Tư vấn size cho một sản phẩm cụ thể: đọc dữ liệu qua catalog.service (công khai, chỉ đọc), rồi gọi hàm thuần
 * getSizeRecommendation. Không đọc cookie/request, không ghi dữ liệu, không dùng LLM.
 */

// Loại sản phẩm theo slug category lá (seed: ao-thun-nam, quan-jeans-nu, quan-unisex, vest-du-tiec-nam, vay-dam…).
// Category lạ (vd phụ kiện) → "other": cần chiều cao + cân nặng, hoặc một số đo cơ thể.
export function sizeKindOf(categorySlug: string): SizeKind {
  if (categorySlug === "vay-dam") return "dress"
  if (categorySlug.startsWith("quan-")) return "bottom"
  if (categorySlug.startsWith("ao-") || categorySlug.startsWith("vest-")) return "top"
  return "other"
}

const STRETCH = /co giãn|spandex|thun/i

export interface SizeAdviceResult {
  advice: SizeRecommendationView
  /** Bảng size đang áp dụng (rỗng nếu sản phẩm không có), để UI hiện lại khi khách bấm "Xem bảng size". */
  chart: SizeChartRow[]
  categoryName: string
}

/** null nếu sản phẩm không tồn tại hoặc đã ngừng bán. */
export async function adviseSizeForProduct(
  input: z.output<typeof sizeAdviceInputSchema>
): Promise<SizeAdviceResult | null> {
  const product = await getProductBySlug(input.productSlug)
  if (!product) return null

  const { rows, brandSpecific } = await getSizeChartInfo(product.categoryId, product.brand)

  // size -> các màu còn hàng (chỉ tính biến thể stock > 0).
  const stockBySize: Record<string, string[]> = {}
  for (const v of product.variants) {
    const colors = (stockBySize[v.size] ??= [])
    if (v.stock > 0 && !colors.includes(v.color)) colors.push(v.color)
  }

  const advice = getSizeRecommendation({
    chart: rows,
    kind: sizeKindOf(product.category.slug),
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    chestCm: input.chestCm,
    waistCm: input.waistCm,
    hipCm: input.hipCm,
    fit: input.fit,
    stretch: STRETCH.test(product.material),
    productName: product.name,
    chartNote: brandSpecific ? `Đang dùng bảng size riêng của thương hiệu ${product.brand}` : null,
    stockBySize,
  })

  return { advice, chart: rows, categoryName: product.category.name }
}
