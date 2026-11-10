import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatVnd } from "@/lib/format"
import type { OrderStatusValue, OrderSummary } from "@/types/order"

const STATUS: Record<OrderStatusValue, { label: string; variant: "warning" | "info" | "success" | "brand" }> = {
  PENDING: { label: "Chờ xác nhận", variant: "warning" },
  CONFIRMED: { label: "Đã xác nhận", variant: "info" },
  SHIPPING: { label: "Đang giao hàng", variant: "info" },
  DELIVERED: { label: "Hoàn thành", variant: "success" },
  CANCELLED: { label: "Đã hủy", variant: "brand" },
}

const TH = "px-6 py-4 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase"

// Figma "Đơn hàng gần đây": hàng tiêu đề nền surface, mỗi đơn là một hàng bo viền.
export function RecentOrders({ orders }: { orders: OrderSummary[] }) {
  return (
    <section aria-labelledby="recent-orders" className="rounded-3xl border border-border bg-card p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="recent-orders" className="text-xl font-bold">
          Đơn hàng gần đây
        </h2>
        <Link href="/account/orders" className="text-xs font-bold text-primary hover:underline">
          Xem tất cả đơn hàng →
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center text-label text-muted-foreground">
          Bạn chưa có đơn hàng nào.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-3">
            <thead>
              <tr className="bg-surface">
                <th className={`${TH} rounded-l-xl`}>Mã đơn</th>
                <th className={TH}>Ngày đặt</th>
                <th className={TH}>Sản phẩm</th>
                <th className={TH}>Tổng tiền</th>
                <th className={TH}>Trạng thái</th>
                <th className={`${TH} rounded-r-xl`}>
                  <span className="sr-only">Chi tiết</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = STATUS[o.status]
                const cell = "border-y border-border bg-white px-6 py-5 text-label"
                return (
                  <tr key={o.id}>
                    <td className={`${cell} rounded-l-xl border-l font-bold whitespace-nowrap`}>#{o.code}</td>
                    <td className={`${cell} whitespace-nowrap text-muted-foreground`}>{formatDate(o.createdAt)}</td>
                    <td className={cell}>
                      <p className="font-bold">
                        {o.firstProductName}
                        {o.otherLines > 0 && ` (+${o.otherLines})`}
                      </p>
                      <p className="mt-1 text-xs text-subtle-foreground">{o.quantity} sản phẩm</p>
                    </td>
                    <td className={`${cell} font-bold whitespace-nowrap ${o.status === "SHIPPING" ? "text-primary" : ""}`}>{formatVnd(o.total)}</td>
                    <td className={cell}>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td className={`${cell} rounded-r-xl border-r`}>
                      <Link href={`/account/orders/${o.id}`} className="text-xs font-bold whitespace-nowrap hover:text-primary">
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}



