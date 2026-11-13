/*
 * Kiểu dữ liệu cho UI trợ lý (khung chat). Chỉ mô tả hình dạng dữ liệu để vẽ thẻ; khớp với
 * sizeRecommendationSchema / outfitSchema trong docs/ai/03-rag-advisor.md (mục 5).
 * Khi có src/lib/validators/ai.ts thì thay bằng z.infer của các schema đó.
 */

import type { ProductCardLite } from "@/lib/validators/ai"

export type SizeStatus = "recommended" | "between_two" | "need_info" | "out_of_range" | "no_chart"

export type MeasureField = "heightCm" | "weightKg" | "chestCm" | "waistCm" | "hipCm"

export interface SizeRecommendationView {
  status: SizeStatus
  productName: string | null
  recommendedSize: string | null
  alternativeSize: string | null
  confidence: "high" | "medium" | "low"
  /** Dựa trên dữ liệu bảng size, mỗi dòng một ý. */
  reasons: string[]
  /** need_info: các số đo còn thiếu. */
  missingFields: MeasureField[]
  /** Tồn kho của size đề xuất (null nếu không áp dụng). */
  stock: { size: string; available: boolean; colors: string[] } | null
  /** out_of_range, no_chart: câu giải thích ngắn. */
  message: string | null
}

export type OutfitSlot = "top" | "bottom" | "dress" | "outer" | "accessory"

export interface OutfitItemView {
  slot: OutfitSlot
  slug: string
  name: string
  image: { url: string; alt: string } | null
  /** Ví dụ "Trắng · size L". */
  variantLabel: string
  /** VND */
  price: number
  reason: string | null
}

export interface OutfitView {
  title: string
  occasion: string | null
  seasons: string[]
  items: OutfitItemView[]
  /** VND, do server tính. */
  totalPrice: number
  knowledgeSources: string[]
  missingSlots: string[]
  note: string | null
}

export interface ConfirmView {
  id: string
  title: string
  /** Mỗi dòng một món, ví dụ "Áo sơ mi poplin công sở · Trắng · L × 1". */
  lines: string[]
  /** VND */
  total: number
  expiresInMinutes: number
}

export interface QuickReplyOption {
  label: string
  value: string
}

/**
 * Khách đã quyết định gì trên thẻ xác nhận. Lưu trong tin nhắn (store) chứ không trong state của thẻ: thẻ bị dựng lại khi đóng/mở
 * khung chat, state cục bộ sẽ mất và nút Xác nhận/Huỷ hiện lại dù đã dùng.
 * `confirming`: đã gửi, chờ server; `added`: đã thêm vào giỏ; `cancelled`: khách huỷ; `failed`: server từ chối (hết hạn, hết hàng…).
 */
export type ConfirmResolved = "confirming" | "added" | "cancelled" | "failed"

export type MessagePart =
  | { type: "text"; text: string }
  /** `noSelect`: thẻ do chat dựng (không gắn với trang sản phẩm đang mở) nên không có nút "Chọn size". */
  | { type: "size"; data: SizeRecommendationView; noSelect?: boolean }
  | { type: "products"; items: ProductCardLite[] }
  | { type: "outfit"; data: OutfitView }
  | { type: "confirm"; data: ConfirmView; resolved?: ConfirmResolved }
  | { type: "quickReplies"; options: QuickReplyOption[] }

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  parts: MessagePart[]
  /** Câu báo lỗi thay cho câu trả lời thật; không gửi lại cho model làm ngữ cảnh. */
  error?: boolean
}

/** Hành động người dùng thực hiện trên thẻ. Tầng gọi (sau này là hook nối AI SDK) quyết định xử lý thế nào. */
export interface AssistantActions {
  onQuickReply?: (value: string, label: string) => void
  onSelectSize?: (size: string) => void
  onViewSizeChart?: () => void
  onSubmitMeasurements?: (values: Partial<Record<MeasureField, number>>) => void
  /** "Thêm cả bộ" trên thẻ bộ đồ: mở bước xác nhận. */
  onAddOutfit?: () => void
  onConfirm?: (confirmationId: string) => void
  onCancelConfirm?: (confirmationId: string) => void
}
