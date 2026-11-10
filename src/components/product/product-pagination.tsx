import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"
import { serializeProductFilters, type ProductFilters } from "@/lib/validators/product-filter"

// Server component: mỗi trang là một <Link> thật (crawl được, mở tab mới được).
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

export function ProductPagination({
  filters,
  pageCount,
  basePath,
  lockedCategory,
}: {
  filters: ProductFilters
  pageCount: number
  basePath: string
  lockedCategory?: boolean
}) {
  if (pageCount <= 1) return null
  const href = (page: number) => {
    const qs = serializeProductFilters({ ...filters, page }, { omitCategory: lockedCategory }).toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const base = "grid size-10 place-items-center rounded-full text-sm font-bold transition-colors"

  return (
    <nav aria-label="Phân trang" className="mt-10 flex items-center justify-center gap-1.5">
      {filters.page > 1 ? (
        <Link href={href(filters.page - 1)} scroll aria-label="Trang trước" className={cn(base, "hover:bg-secondary")}>
          <ChevronLeftIcon className="size-4" />
        </Link>
      ) : null}
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
            className={cn(base, p === filters.page ? "bg-ink text-white" : "hover:bg-secondary")}
          >
            {p}
          </Link>
        )
      )}
      {filters.page < pageCount ? (
        <Link href={href(filters.page + 1)} aria-label="Trang sau" className={cn(base, "hover:bg-secondary")}>
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : null}
    </nav>
  )
}
