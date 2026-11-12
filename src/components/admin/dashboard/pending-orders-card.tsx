import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { ADMIN_ORDER_STATUS_LABEL, ADMIN_ORDER_STATUS_TONE } from "@/components/admin/admin-nav"
import { ApproveOrderButton } from "@/components/admin/dashboard/approve-order-button"
import { AdminEmpty, AdminTable, AdminTr } from "@/components/admin/list/admin-table"
import { StatusPill } from "@/components/admin/status-pill"
import { formatDayMonthTime, formatVnd } from "@/lib/format"
import { PAYMENT_METHOD_SHORT } from "@/lib/order"
import type { DashboardStats } from "@/server/services/admin-dashboard.service"

const COLUMNS = [
  { label: "Mã đơn" },
  { label: "Khách hàng" },
  { label: "Sản phẩm" },
  { label: "Tổng tiền" },
  { label: "Trạng thái" },
  { label: "Xử lý", className: "text-right" },
]

export function PendingOrdersCard({ orders }: { orders: DashboardStats["pendingOrders"] }) {
  return (
    <section aria-labelledby="pending-orders-title" className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 id="pending-orders-title" className="text-base font-bold">
          Đơn hàng mới nhất cần xử lý
        </h2>
        <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-bold hover:underline">
          Xem tất cả đơn <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>

      {orders.length === 0 ? (
        <AdminEmpty title="Không có đơn nào đang chờ xác nhận." />
      ) : (
        <div className="mt-5">
          <AdminTable columns={COLUMNS} minWidth={640}>
            {orders.map((o) => (
              <AdminTr key={o.id}>
                <td className="font-bold whitespace-nowrap">
                  <Link href={`/admin/orders?q=${encodeURIComponent(o.code)}`} className="hover:underline">
                    #{o.code}
                  </Link>
                </td>
                <td className="font-bold">{o.customerName}</td>
                <td className="text-muted-foreground">
                  {o.itemCount} sản phẩm · {PAYMENT_METHOD_SHORT[o.paymentMethod] ?? o.paymentMethod}
                  <span className="block text-xs text-subtle-foreground">{formatDayMonthTime(o.createdAt)}</span>
                </td>
                <td className="font-bold whitespace-nowrap text-brand">{formatVnd(o.total)}</td>
                <td>
                  <StatusPill tone={ADMIN_ORDER_STATUS_TONE[o.status]}>{ADMIN_ORDER_STATUS_LABEL[o.status]}</StatusPill>
                </td>
                <td className="text-right">
                  <ApproveOrderButton orderId={o.id} code={o.code} />
                </td>
              </AdminTr>
            ))}
          </AdminTable>
        </div>
      )}
    </section>
  )
}
