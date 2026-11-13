import { z } from "zod"
import { confirmViewSchema, outfitViewSchema, productCardLiteSchema, sizeChartRowSchema, sizeRecommendationSchema } from "@/lib/validators/ai"
import { uiActionSchema } from "./ui-actions"

/*
 * Định dạng luồng trả lời của `/api/ai/chat`: mỗi dòng là một JSON (NDJSON). Server gửi chữ của model, hành động giao diện và các
 * thẻ do tool dựng (không phải chữ do model viết); client kiểm từng dòng bằng schema này và bỏ qua dòng lạ.
 * Dùng chung server và client (không import gì từ src/server).
 */
export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), delta: z.string() }),
  z.object({ type: z.literal("ui"), action: uiActionSchema }),
  z.object({ type: z.literal("products"), items: z.array(productCardLiteSchema).max(12) }),
  z.object({ type: z.literal("size"), advice: sizeRecommendationSchema, chart: z.array(sizeChartRowSchema).max(20), categoryName: z.string().max(100) }),
  /** Thẻ bộ đồ do tool getOutfitSuggestion dựng (món, giá, tổng tiền do code tính). */
  z.object({ type: z.literal("outfit"), data: outfitViewSchema }),
  /** Thẻ xác nhận cho tool ghi: chỉ khi khách bấm "Xác nhận" mới có việc ghi (POST /api/ai/confirm). */
  z.object({ type: z.literal("confirm"), data: confirmViewSchema }),
  /** Model lỗi sau khi đã trả về một phần; client giữ phần đã nhận. */
  z.object({ type: z.literal("error") }),
])

export type ChatEvent = z.output<typeof chatEventSchema>

export const CHAT_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8"

/** Một sự kiện thành một dòng (kết thúc bằng xuống dòng). */
export const encodeChatEvent = (event: ChatEvent): string => `${JSON.stringify(event)}\n`

/**
 * Đọc một dòng NDJSON; dòng hỏng hoặc không đúng schema trả null (client bỏ qua, không làm đứt cả câu trả lời).
 */
export function parseChatEventLine(line: string): ChatEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  const parsed = chatEventSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}
