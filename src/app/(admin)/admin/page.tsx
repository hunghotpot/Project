import type { Metadata } from "next"
import { LowStockCard } from "@/components/admin/dashboard/low-stock-card"
import { PendingOrdersCard } from "@/components/admin/dashboard/pending-orders-card"
import { RevenueChart } from "@/components/admin/dashboard/revenue-chart"
import { formatDelta, StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { formatVnd } from "@/lib/format"
import { requireAdmin } from "@/server/auth/session"
import { getDashboardStats } from "@/server/services/admin-dashboard.service"

export const metadata: Metadata = { title: "Tổng quan" }

export default async function AdminDashboardPage() {
  await requireAdmin("/admin")
  const stats = await getDashboardStats()

  const revenueDelta = formatDelta(stats.revenue.monthChangePct)
  const ordersDelta = formatDelta(stats.orders.todayChangePct)

  return (
    <>
      <StatGrid>
        <StatCard
          label="Tổng doanh thu"
          value={formatVnd(stats.revenue.total)}
          chip={revenueDelta ? revenueDelta.text : "Tháng này"}
          chipTitle={revenueDelta ? "So với tháng trước" : `Doanh thu tháng này: ${formatVnd(stats.revenue.thisMonth)}`}
          chipTone={revenueDelta?.tone ?? "info"}
          accent
        />
        <StatCard
          label="Đơn hàng mới"
          value={String(stats.orders.today)}
          unit="đơn hôm nay"
          chip={ordersDelta ? ordersDelta.text : `${stats.orders.pending} chờ`}
          chipTitle={ordersDelta ? "So với hôm qua" : `${stats.orders.pending} đơn đang chờ xác nhận`}
          chipTone={ordersDelta?.tone ?? "warning"}
        />
        <StatCard
          label="Tài khoản khách hàng"
          value={stats.customers.total.toLocaleString("vi-VN")}
          unit="tài khoản"
          chip={`+${stats.customers.newThisMonth} mới`}
          chipTone="success"
        />
        <StatCard
          label="Cảnh báo tồn kho"
          value={String(stats.stock.lowCount)}
          unit="biến thể sắp hết"
          chip={stats.stock.lowCount > 0 || stats.stock.outOfStockCount > 0 ? "Chú ý" : "Ổn định"}
          chipTone={stats.stock.lowCount > 0 || stats.stock.outOfStockCount > 0 ? "brand" : "info"}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <RevenueChart data={stats.weeklyRevenue} />
        <LowStockCard items={stats.stock.lowItems} />
      </div>

      <PendingOrdersCard orders={stats.pendingOrders} />
    </>
  )
}
