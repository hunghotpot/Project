/*
 * Quy tắc tồn kho dùng chung cho Admin (Tồn kho & Sản phẩm, Tổng quan). Hàm thuần, không chạm DB.
 * Ngưỡng là hằng số mặc định; màn Cài đặt hệ thống trong Figma có ô "mức tồn tối thiểu" nhưng CHƯA có bảng cấu hình.
 */

/** Tồn kho ≤ ngưỡng (và > 0) coi là "Sắp hết". */
export const LOW_STOCK_THRESHOLD = 10

export type StockStatus = "IN_STOCK" | "LOW" | "OUT"

export function stockStatus(stock: number, threshold = LOW_STOCK_THRESHOLD): StockStatus {
  if (stock <= 0) return "OUT"
  return stock <= threshold ? "LOW" : "IN_STOCK"
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "Còn hàng",
  LOW: "Sắp hết",
  OUT: "Hết hàng",
}
