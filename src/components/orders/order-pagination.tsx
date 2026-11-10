import Link from "next/link"
import { cn } from "cn"
import { serializeOrderListFilters, type OrderListFilters } from "@/lib/validators/order-list"

function pageItems(page: number, count: number): (number | "…")[] {
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | "…")[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…")
    out.push(p)
  })
  return out
}

// Figma "Pagination": dòng "Hiển thị a - b trên tổng số N đơn" bên trái, ô số trang vuông bo nhẹ + mũi tên → bên phải.
export function OrderPagination({
  filters,
  total,
  pageCount,
}: {
  filters: OrderListFilters
  total: number
  pageCount: number
}) {
  if (total === 0) return null
  const from = (filters.page - 1) * filters.pageSize + 1
  const to = Math.min(filters.page * filters.pageSize, total)
  const href = (page: number) => {
    const qs = serializeOrderListFilters({ ...filters, page }).toString()
    return qs ? `/account/orders?${qs}` : "/account/orders"
  }
  const box = "grid size-9 place-items-center rounded-md border text-label font-bold transition-colors"

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
      <p className="text-label text-muted-foreground">
        Hiển thị {from} - {to} trên tổng số {total} đơn mua của bạn
      </p>
      {pageCount > 1 && (
        <nav aria-label="Phân trang" className="flex items-center gap-2">
          {filters.page > 1 && (
            <Link href={href(filters.page - 1)} aria-label="Trang trước" className={cn(box, "border-border bg-white text-muted-foreground hover:border-ink")}>
              ←
            </Link>
          )}
          {pageItems(filters.page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={href(p)}
                aria-current={p === filters.page ? "page" : undefined}
                className={cn(box, p === filters.page ? "border-ink bg-ink text-white" : "border-border bg-white text-muted-foreground hover:border-ink")}
              >
                {p}
              </Link>
            )
          )}
          {filters.page < pageCount && (
            <Link href={href(filters.page + 1)} aria-label="Trang sau" className={cn(box, "border-border bg-white text-muted-foreground hover:border-ink")}>
              →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
