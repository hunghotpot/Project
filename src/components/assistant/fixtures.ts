import type { ConfirmView, OutfitView, SizeRecommendationView } from "@/types/assistant"

/*
 * Dữ liệu mẫu CHỈ dùng cho trang xem thử /dev/assistant. Sản phẩm, giá và bảng size lấy từ seed; các ca size
 * là ca A–I trong docs/ai/03-rag-advisor.md (mục 2.4). Không import vào component chạy thật.
 */

const base: SizeRecommendationView = {
  status: "recommended",
  productName: "Áo sơ mi poplin công sở",
  recommendedSize: null,
  alternativeSize: null,
  confidence: "high",
  reasons: [],
  missingFields: [],
  stock: null,
  message: null,
}

/** Ca A: 168cm, 60kg. */
export const SIZE_RECOMMENDED: SizeRecommendationView = {
  ...base,
  recommendedSize: "M",
  reasons: ["168cm nằm trong khoảng 165–172cm của size M", "60kg nằm trong khoảng 58–66kg của size M"],
  stock: { size: "M", available: true, colors: ["Trắng"] },
}

/** Ca B: 170cm, 66kg. */
export const SIZE_BETWEEN: SizeRecommendationView = {
  ...base,
  status: "between_two",
  recommendedSize: "L",
  alternativeSize: "M",
  confidence: "medium",
  reasons: [
    "170cm nằm trong khoảng 170–177cm của size L",
    "66kg nằm trong khoảng 66–74kg của size L",
    "Cả hai số đo cũng nằm trong khoảng của size M",
  ],
  stock: { size: "L", available: true, colors: ["Trắng"] },
}

export const SIZE_OUT_OF_STOCK: SizeRecommendationView = {
  ...SIZE_RECOMMENDED,
  recommendedSize: "L",
  reasons: ["170cm nằm trong khoảng 170–177cm của size L"],
  stock: { size: "L", available: false, colors: [] },
}

/** Ca G: chỉ có chiều cao. */
export const SIZE_NEED_INFO: SizeRecommendationView = {
  ...base,
  status: "need_info",
  confidence: "low",
  missingFields: ["heightCm", "weightKg"],
}

/** Ca D: 185cm, 95kg. */
export const SIZE_OUT_OF_RANGE: SizeRecommendationView = {
  ...base,
  status: "out_of_range",
  confidence: "low",
  message: "Số đo của bạn nằm ngoài bảng size hiện có (lớn nhất là XL: 175–182cm, 74–82kg) nên mình chưa thể gợi ý size.",
}

/** Ca H: phụ kiện. */
export const SIZE_NO_CHART: SizeRecommendationView = {
  ...base,
  status: "no_chart",
  productName: "Thắt lưng da bò khóa kim",
  confidence: "low",
  message: "Sản phẩm này không có bảng size. Bạn xem thêm mô tả sản phẩm nhé.",
}

export const OUTFIT_OFFICE: OutfitView = {
  title: "Bộ công sở tối giản",
  occasion: "đi họp",
  seasons: ["xuân", "hè", "thu"],
  items: [
    {
      slot: "top",
      slug: "ao-so-mi-poplin-cong-so",
      name: "Áo sơ mi poplin công sở",
      image: { url: "https://placehold.co/800x1000/dbeafe/1e3a8a.png?text=%C3%81o%20s%C6%A1%20mi%0Apoplin%20c%C3%B4ng%20s%E1%BB%9F&font=source-sans-pro", alt: "Áo sơ mi poplin công sở" },
      variantLabel: "Trắng · size L",
      price: 429000,
      reason: "Áo sơ mi trắng form công sở, dễ phối với quần tối màu.",
    },
    {
      slot: "bottom",
      slug: "quan-tay-au-slim-den-cong-so",
      name: "Quần tây âu slim đen công sở",
      image: { url: "https://placehold.co/800x1000/e8dcc4/57534e.png?text=Qu%E1%BA%A7n%20t%C3%A2y%20%C3%A2u%0Aslim%20%C4%91en&font=source-sans-pro", alt: "Quần tây âu slim đen công sở" },
      variantLabel: "Đen · size 32",
      price: 489000,
      reason: "Quần tây đen cùng tông lịch sự, giữ tổng thể gọn gàng.",
    },
    {
      slot: "accessory",
      slug: "that-lung-da-bo-khoa-kim",
      name: "Thắt lưng da bò khóa kim",
      image: { url: "https://placehold.co/800x1000/fef3c7/78350f.png?text=Th%E1%BA%AFt%20l%C6%B0ng%20da%20b%C3%B2&font=source-sans-pro", alt: "Thắt lưng da bò khóa kim" },
      variantLabel: "Đen · chọn size",
      price: 449000,
      reason: "Thắt lưng da đen đồng bộ với quần, hoàn thiện bộ đồ công sở.",
    },
  ],
  totalPrice: 1367000,
  knowledgeSources: ["quy tắc phối đồ công sở"],
  missingSlots: [],
  note: "Tông đen – trắng dễ phối, phù hợp đi họp và gặp đối tác.",
}

export const OUTFIT_MISSING_SLOT: OutfitView = {
  ...OUTFIT_OFFICE,
  title: "Bộ công sở có thiếu món",
  items: OUTFIT_OFFICE.items.slice(0, 2),
  totalPrice: 918000,
  missingSlots: ["áo khoác"],
  note: null,
}

export const CONFIRM_OUTFIT: ConfirmView = {
  id: "demo-confirm-1",
  title: "Thêm 3 sản phẩm vào giỏ?",
  lines: [
    "Áo sơ mi poplin công sở · Trắng · L × 1",
    "Quần tây âu slim đen công sở · Đen · 32 × 1",
    "Thắt lưng da bò khóa kim · Đen · 95 × 1",
  ],
  total: 1367000,
  expiresInMinutes: 5,
}
