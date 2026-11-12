import { create } from "zustand"
import type { ChatMessage, MeasureField } from "@/types/assistant"
import type { SizeChartRow } from "@/types/catalog"

// Trạng thái khung chat trợ lý: đóng/mở, sản phẩm đang xem (nếu mở từ trang sản phẩm), tin nhắn và số đo đã nhập.
// Tư vấn size chạy thật (server tính bằng code); các câu hỏi khác chưa có backend AI nên nhận lại "chưa kết nối".

export interface AssistantProduct {
  slug: string
  name: string
}

export type FitChoice = "tight" | "regular" | "loose"

let seq = 0
export const nextMessageId = () => `m${++seq}`

export function buildWelcome(product: AssistantProduct | null): ChatMessage[] {
  if (product) {
    return [
      {
        id: "welcome",
        role: "assistant",
        parts: [
          { type: "text", text: `Xin chào! Bạn đang xem "${product.name}". Cho mình biết số đo để tư vấn size nhé.` },
          {
            type: "size",
            data: {
              status: "need_info",
              productName: product.name,
              recommendedSize: null,
              alternativeSize: null,
              confidence: "low",
              reasons: [],
              missingFields: ["heightCm", "weightKg"],
              stock: null,
              message: null,
            },
          },
        ],
      },
    ]
  }
  return [
    {
      id: "welcome",
      role: "assistant",
      parts: [
        { type: "text", text: "Xin chào! Mình là trợ lý mua sắm. Mình có thể giúp bạn tư vấn size, phối đồ và cách chăm sóc quần áo." },
        {
          type: "quickReplies",
          options: [
            { label: "Tư vấn size", value: "size" },
            { label: "Phối đồ đi làm", value: "outfit-office" },
            { label: "Cách giặt áo linen", value: "care-linen" },
          ],
        },
      ],
    },
  ]
}

interface AssistantUiState {
  open: boolean
  product: AssistantProduct | null
  messages: ChatMessage[]
  /** Số đo khách đã nhập cho sản phẩm đang xem (giữ lại để tính lại khi đổi sở thích ôm/rộng). */
  measurements: Partial<Record<MeasureField, number>>
  fit: FitChoice
  /** Khách đã chọn sở thích ôm/vừa/rộng chưa (chưa chọn thì hỏi khi nằm giữa hai size). */
  fitChosen: boolean
  /** Bảng size của sản phẩm đang tư vấn, để hiện lại khi bấm "Xem bảng size". */
  chart: { rows: SizeChartRow[]; categoryName: string } | null
  /** Yêu cầu chọn size trên trang sản phẩm (ProductDetailMain lắng nghe); id đổi mỗi lần để yêu cầu lặp lại vẫn kích hoạt. */
  sizeRequest: { size: string; id: number } | null
  setOpen: (open: boolean) => void
  /** Mở khung chat; nếu mở từ một sản phẩm khác với lần trước thì bắt đầu lại hội thoại. */
  openChat: (product?: AssistantProduct) => void
  push: (message: ChatMessage) => void
  setMeasurements: (m: Partial<Record<MeasureField, number>>) => void
  setFit: (fit: FitChoice) => void
  setChart: (chart: { rows: SizeChartRow[]; categoryName: string } | null) => void
  requestSize: (size: string) => void
}

export const useAssistantUi = create<AssistantUiState>((set, get) => ({
  open: false,
  product: null,
  messages: buildWelcome(null),
  measurements: {},
  fit: "regular",
  fitChosen: false,
  chart: null,
  sizeRequest: null,
  setOpen: (open) => set({ open }),
  openChat: (product) => {
    const next = product ?? null
    const changed = next !== null && next.slug !== get().product?.slug
    set(
      changed
        ? { open: true, product: next, messages: buildWelcome(next), measurements: {}, fit: "regular", fitChosen: false, chart: null }
        : { open: true }
    )
  },
  push: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setMeasurements: (m) => set((s) => ({ measurements: { ...s.measurements, ...m } })),
  setFit: (fit) => set({ fit, fitChosen: true }),
  setChart: (chart) => set({ chart }),
  requestSize: (size) => set((s) => ({ sizeRequest: { size, id: (s.sizeRequest?.id ?? 0) + 1 } })),
}))
