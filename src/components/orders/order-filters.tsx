import Link from "next/link"
import { SearchIcon } from "lucide-react"
import { cn } from "cn"
import { ORDER_STATUS_LABEL } from "@/lib/order-timeline"
import { ORDER_STATUSES, serializeOrderListFilters, type OrderListFilters } from "@/lib/validators/order-list"
import type { OrderListResult } from "@/types/order"

const BASE = "/account/orders"

// Figma "OrderFilters": các nút trạng thái kèm số đơn + ô tìm theo mã đơn / tên sản phẩm. Toàn bộ là <a>/<form> GET
// nên bộ lọc nằm trong URL (chia sẻ được, back/forward hoạt động) và chạy cả khi chưa có JS.
export function OrderFilters({ filters, counts }: { filters: OrderListFilters; counts: OrderListResult["counts"] }) {
  const href = (status?: (typeof ORDER_STATUSES)[number]) => {
    const qs = serializeOrderListFilters({ ...filters, status, page: 1 }).toString()
    return qs ? `${BASE}?${qs}` : BASE
  }
  const tabs = [{ value: undefined, label: "Tất cả", count: counts.ALL }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s], count: counts[s] }))]

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-3">
        {tabs.map((t) => {
          const active = filters.status === t.value
          return (
            <Link
              key={t.label}
              href={href(t.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-xl border px-5 text-label font-bold transition-colors",
                active ? "border-ink bg-ink text-white" : "border-border bg-secondary/50 text-muted-foreground hover:border-border-strong hover:text-foreground"
              )}
            >
              {t.label} ({t.count})
            </Link>
          )
        })}
      </nav>

      <form role="search" action={BASE} method="get" className="relative w-full lg:w-[360px]">
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          maxLength={100}
          placeholder="Tìm theo mã đơn #FS... hoặc tên sản phẩm"
          aria-label="Tìm đơn hàng"
          className="h-11 w-full rounded-xl border border-border bg-secondary/50 pr-4 pl-11 text-label outline-none placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
        />
      </form>
    </div>
  )
}
