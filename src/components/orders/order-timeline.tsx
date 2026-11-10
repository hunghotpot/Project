import { CheckIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { formatDayMonthTime } from "@/lib/format"
import type { TimelineStep } from "@/lib/order-timeline"

// Figma "StatusTimeline": các chấm nối bằng đường kẻ — bước đã qua tô màu brand, bước hiện tại có viền, bước chưa tới màu xám.
export function OrderTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol
      aria-label="Tiến trình đơn hàng"
      className="grid rounded-2xl bg-surface px-4 py-6 sm:px-8"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((s, i) => {
        const reached = s.state === "done" || s.state === "current" || s.state === "cancelled"
        return (
          <li key={s.status} aria-current={s.state === "current" ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3.5 left-1/2 h-0.5 w-full",
                  s.state === "done" ? "bg-primary" : "bg-border-strong"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full",
                s.state === "done" && "bg-primary text-white",
                s.state === "current" && "bg-white ring-2 ring-primary",
                s.state === "upcoming" && "border-2 border-border-strong bg-white",
                s.state === "cancelled" && "bg-muted-foreground text-white"
              )}
            >
              {s.state === "done" && <CheckIcon className="size-4" strokeWidth={3} />}
              {s.state === "current" && <span className="size-3 rounded-full bg-primary" />}
              {s.state === "cancelled" && <XIcon className="size-4" strokeWidth={3} />}
              <span className="sr-only">
                {s.state === "done" ? "Đã hoàn tất" : s.state === "current" ? "Đang ở bước này" : s.state === "cancelled" ? "Đã hủy" : "Chưa tới"}
              </span>
            </span>
            <p
              className={cn(
                "mt-2 text-label font-bold",
                s.state === "current" ? "text-primary" : reached ? "text-foreground" : "text-subtle-foreground"
              )}
            >
              {s.label}
            </p>
            {s.at && <p className="mt-1 text-xs text-muted-foreground">{formatDayMonthTime(s.at)}</p>}
            {s.actor && <p className="text-2xs text-subtle-foreground">{s.actor}</p>}
            {s.note && s.state === "cancelled" && <p className="mt-1 max-w-[16ch] text-2xs text-muted-foreground">Lý do: {s.note}</p>}
          </li>
        )
      })}
    </ol>
  )
}
