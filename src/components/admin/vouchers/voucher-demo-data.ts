/*
 * DỮ LIỆU MINH HOẠ cho màn Voucher (chưa có model Voucher, checkout chưa áp mã).
 * Lấy cấu trúc từ Figma 05, đổi nội dung sang thời trang. Không phải dữ liệu thật.
 */

export type VoucherStatus = "ACTIVE" | "UPCOMING" | "EXPIRED" | "EXHAUSTED"

export interface DemoVoucher {
  code: string
  name: string
  /** Mức giảm đã định dạng sẵn. */
  benefit: string
  benefitTone: "brand" | "success" | "neutral"
  minOrder: string
  scope: string
  used: number
  limit: number
  expiry: string
  status: VoucherStatus
}

export const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  ACTIVE: "Hoạt động",
  UPCOMING: "Sắp diễn ra",
  EXPIRED: "Đã hết hạn",
  EXHAUSTED: "Hết lượt",
}

export const VOUCHER_STATUS_TONE = {
  ACTIVE: "success",
  UPCOMING: "info",
  EXPIRED: "neutral",
  EXHAUSTED: "warning",
} as const

/** Bộ lọc trên thanh công cụ: giá trị ?status=. "expired" gồm cả hết hạn lẫn hết lượt. */
export const VOUCHER_FILTERS = [
  { value: "active", label: "Đang kích hoạt" },
  { value: "upcoming", label: "Sắp diễn ra" },
  { value: "expired", label: "Đã hết hạn" },
]

const FILTER_STATUSES: Record<string, VoucherStatus[]> = {
  active: ["ACTIVE"],
  upcoming: ["UPCOMING"],
  expired: ["EXPIRED", "EXHAUSTED"],
}

export const DEMO_VOUCHERS: DemoVoucher[] = [
  { code: "THUDONG2026", name: "Ưu Đãi BST Thu Đông 2026", benefit: "Giảm 300.000 ₫ thẳng vào đơn", benefitTone: "brand", minOrder: "Đơn từ 2.000.000 ₫", scope: "Áp dụng toàn bộ sản phẩm", used: 342, limit: 500, expiry: "31/12/2026", status: "ACTIVE" },
  { code: "NEWBIE50", name: "Khách Hàng Mới Đăng Ký", benefit: "Giảm 50.000 ₫ cho đơn đầu tiên", benefitTone: "brand", minOrder: "Đơn từ 500.000 ₫", scope: "Chỉ khách hàng mới", used: 518, limit: 1000, expiry: "Vô thời hạn", status: "ACTIVE" },
  { code: "AOTHUN20", name: "Tuần Lễ Áo Thun Nam", benefit: "Giảm 20% (tối đa 500.000 ₫)", benefitTone: "brand", minOrder: "Đơn từ 1.500.000 ₫", scope: "Danh mục: Áo thun nam", used: 200, limit: 200, expiry: "15/11/2026", status: "EXHAUSTED" },
  { code: "FREESHIP", name: "Miễn Phí Vận Chuyển Toàn Quốc", benefit: "Freeship tối đa 40.000 ₫", benefitTone: "success", minOrder: "Đơn từ 499.000 ₫", scope: "Toàn quốc", used: 180, limit: 300, expiry: "30/11/2026", status: "ACTIVE" },
  { code: "SALE1212", name: "Siêu Sale Ngày 12.12", benefit: "Giảm 120.000 ₫ toàn sàn", benefitTone: "neutral", minOrder: "Đơn từ 800.000 ₫", scope: "Áp dụng từ 12/12", used: 0, limit: 1212, expiry: "12/12/2026", status: "UPCOMING" },
  { code: "HE2025", name: "Chào Hè 2025", benefit: "Giảm 10% (tối đa 200.000 ₫)", benefitTone: "neutral", minOrder: "Đơn từ 600.000 ₫", scope: "Danh mục: Váy đầm", used: 96, limit: 400, expiry: "31/08/2025", status: "EXPIRED" },
]

/** Lọc phía server trên dữ liệu minh hoạ theo ?q= (mã/tên) và ?status=. */
export function filterDemoVouchers(q: string, status: string): DemoVoucher[] {
  const needle = q.trim().toLowerCase()
  const allowed = FILTER_STATUSES[status]
  return DEMO_VOUCHERS.filter(
    (v) => (!allowed || allowed.includes(v.status)) && (!needle || v.code.toLowerCase().includes(needle) || v.name.toLowerCase().includes(needle))
  )
}

/** Danh mục chọn trong modal (tên thật trong seed). */
export const DEMO_CATEGORY_ITEMS = [
  { value: "all", label: "Toàn bộ sản phẩm" },
  { value: "ao-thun-nam", label: "Áo thun nam" },
  { value: "ao-khoac-nu", label: "Áo khoác nữ" },
  { value: "vay-dam", label: "Váy đầm" },
]
