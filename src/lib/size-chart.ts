import { sizeRank } from "@/lib/product-variants"
import type { SizeChartRow } from "@/types/catalog"

type ChartRecord = SizeChartRow & { brand: string | null }

/**
 * Chọn bảng size áp dụng cho một sản phẩm từ các dòng của category (đã gồm dòng của brand và dòng chung):
 * có dòng riêng của brand thì dùng bảng riêng, không thì dùng bảng chung (brand = null). Sắp theo thứ tự size.
 * Hàm thuần để cả trang sản phẩm lẫn tư vấn size dùng chung một quy tắc.
 */
export function pickSizeChartRows(charts: ChartRecord[]): SizeChartRow[] {
  const rows = charts.some((c) => c.brand !== null) ? charts.filter((c) => c.brand !== null) : charts
  return rows
    .map((c) => ({
      size: c.size,
      chest: c.chest,
      waist: c.waist,
      hip: c.hip,
      heightMin: c.heightMin,
      heightMax: c.heightMax,
      weightMin: c.weightMin,
      weightMax: c.weightMax,
    }))
    .sort((a, b) => sizeRank(a.size) - sizeRank(b.size))
}
