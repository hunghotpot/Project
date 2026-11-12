import { cn } from "cn"
import { vnDateKey } from "@/lib/admin-dates"
import { formatVnd } from "@/lib/format"
import type { DashboardStats } from "@/server/services/admin-dashboard.service"

// Figma: cột bo tròn, cột cao nhất màu brand, cột hôm nay màu ink, các cột còn lại xám nhạt. Chỉ CSS, không thêm thư viện biểu đồ.
export function RevenueChart({ data }: { data: DashboardStats["weeklyRevenue"] }) {
  const max = Math.max(...data.map((d) => d.revenue), 0)
  const today = vnDateKey(new Date())
  const peak = max > 0 ? data.findIndex((d) => d.revenue === max) : -1

  return (
    <section aria-labelledby="revenue-chart-title" className="flex flex-col rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="revenue-chart-title" className="text-base font-bold">
          Biểu đồ doanh thu tuần này
        </h2>
        <p className="text-xs text-muted-foreground">Cập nhật: Hôm nay</p>
      </div>

      <ul className="mt-6 flex min-h-64 flex-1 items-end gap-2 sm:gap-6" aria-label="Doanh thu từng ngày trong tuần">
        {data.map((d, i) => {
          const pct = max > 0 ? Math.max(4, Math.round((d.revenue / max) * 100)) : 4
          const isToday = d.date === today
          return (
            <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3">
              <div
                role="img"
                aria-label={`${d.label}: ${formatVnd(d.revenue)}`}
                title={`${d.label}: ${formatVnd(d.revenue)}`}
                style={{ height: `${pct}%` }}
                className={cn("w-full max-w-14 rounded-xl", i === peak ? "bg-brand" : isToday ? "bg-ink" : "bg-secondary")}
              />
              <span className={cn("text-xs font-bold", i === peak ? "text-brand" : isToday ? "text-foreground" : "text-subtle-foreground")}>
                {d.label}
              </span>
            </li>
          )
        })}
      </ul>
      {max === 0 && <p className="mt-4 text-center text-xs text-muted-foreground">Chưa có doanh thu trong tuần này.</p>}
    </section>
  )
}
