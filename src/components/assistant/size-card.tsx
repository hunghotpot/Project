import { CircleCheckIcon, CircleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { SizeRecommendationView } from "@/types/assistant"

const CONFIDENCE_LABEL = { high: "cao", medium: "trung bình", low: "thấp" } as const

// Thẻ size cho trạng thái "recommended" và "between_two".
export function SizeCard({
  data,
  onSelectSize,
  onViewSizeChart,
}: {
  data: SizeRecommendationView
  onSelectSize?: (size: string) => void
  onViewSizeChart?: () => void
}) {
  if (!data.recommendedSize) return null
  const between = data.status === "between_two" && data.alternativeSize
  const stock = data.stock

  return (
    <article aria-label="Gợi ý size" className="space-y-3 rounded-2xl border border-border bg-white p-4">
      {data.productName && <p className="text-xs text-muted-foreground">{data.productName}</p>}

      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-nav font-bold text-primary-foreground">
          {data.recommendedSize}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
            Gợi ý: size {data.recommendedSize}
            {between && <Badge variant="warning">Giữa hai size</Badge>}
          </p>
          {between && <p className="text-xs text-muted-foreground">Cũng có thể cân nhắc size {data.alternativeSize}</p>}
        </div>
        {between && (
          <span aria-label={`Size thay thế ${data.alternativeSize}`} className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-nav font-bold text-muted-foreground">
            {data.alternativeSize}
          </span>
        )}
      </div>

      {data.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-label text-foreground">
          {data.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {stock && (
        <p
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-label ${
            stock.available ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
          }`}
        >
          {stock.available ? <CircleCheckIcon className="size-4" /> : <CircleAlertIcon className="size-4" />}
          {stock.available
            ? `Size ${stock.size} còn hàng${stock.colors.length > 0 ? ` màu ${stock.colors.join(", ")}` : ""}`
            : `Size ${stock.size} đang hết hàng`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {onSelectSize && (
          <Button type="button" size="sm" onClick={() => onSelectSize(data.recommendedSize!)}>
            Chọn size {data.recommendedSize}
          </Button>
        )}
        {onViewSizeChart && (
          <Button type="button" variant="outline" size="sm" onClick={onViewSizeChart}>
            Xem bảng size
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Độ tin cậy: {CONFIDENCE_LABEL[data.confidence]}</span>
      </div>
    </article>
  )
}
