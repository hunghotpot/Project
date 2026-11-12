import { InfoIcon } from "lucide-react"
import type { SizeRecommendationView } from "@/types/assistant"

const FALLBACK: Partial<Record<SizeRecommendationView["status"], string>> = {
  out_of_range: "Số đo của bạn nằm ngoài bảng size hiện có nên mình chưa thể gợi ý size chính xác.",
  no_chart: "Sản phẩm này không có bảng size. Bạn xem thêm mô tả sản phẩm nhé.",
}

// Thẻ báo ngắn cho "out_of_range" và "no_chart": nói rõ lý do, không đưa size.
export function NoticeCard({ data }: { data: SizeRecommendationView }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-2xl border border-border bg-secondary p-4 text-label">
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p>{data.message ?? FALLBACK[data.status] ?? "Mình chưa có đủ thông tin để tư vấn."}</p>
    </div>
  )
}
