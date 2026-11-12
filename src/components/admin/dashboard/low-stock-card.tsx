import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { STOCK_STATUS_LABEL } from "@/lib/inventory"
import type { DashboardStats } from "@/server/services/admin-dashboard.service"

export function LowStockCard({ items }: { items: DashboardStats["stock"]["lowItems"] }) {
  return (
    <section aria-labelledby="low-stock-title" className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="low-stock-title" className="text-base font-bold">
          Cảnh báo tồn kho thấp
        </h2>
        <Link href="/admin/products" className="text-xs font-bold text-brand hover:underline">
          Nhập kho ngay
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-label text-muted-foreground">Không có mặt hàng nào sắp hết.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.variantId} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-label font-bold">
                  {it.productName} ({it.color})
                </p>
                <p className="text-xs text-muted-foreground">
                  Size {it.size} • Còn: <span className="font-bold text-brand">{it.stock} cái</span>
                </p>
              </div>
              <Badge variant={it.status === "OUT" ? "dark" : "brand"} className="h-7 px-3.5">
                {STOCK_STATUS_LABEL[it.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
