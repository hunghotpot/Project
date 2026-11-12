import type { Metadata } from "next"
import Link from "next/link"
import { ADMIN_ORDER_STATUS_LABEL, ADMIN_ORDER_STATUS_TONE } from "@/components/admin/admin-nav"
import { StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { AdminPagination } from "@/components/admin/list/admin-pagination"
import { AdminEmpty, AdminTable, AdminTr, ListCard, ListSection } from "@/components/admin/list/admin-table"
import { ListToolbar } from "@/components/admin/list/list-toolbar"
import { AdvanceOrderButton } from "@/components/admin/orders/advance-order-button"
import { ORDER_PAYMENT_STATUS_LABEL, ORDER_PAYMENT_STATUS_TONE } from "@/components/admin/orders/order-labels"
import { StatusPill } from "@/components/admin/status-pill"
import { buttonVariants } from "@/components/ui/button"
import type { RawSearchParams } from "@/lib/admin-list"
import { formatDayMonthTime, formatVnd } from "@/lib/format"
import { PAYMENT_METHOD_SHORT } from "@/lib/order"
import { getOrderStatusCounts, listAllOrders } from "@/server/services/admin-order.service"

export const metadata: Metadata = { title: "Đơn hàng" }

const COLUMNS = [
  { label: "Mã đơn & ngày đặt" },
  { label: "Khách hàng" },
  { label: "Sản phẩm & chi tiết" },
  { label: "Thanh toán" },
  { label: "Tổng tiền" },
  { label: "Trạng thái" },
  { label: "Xử lý", className: "text-right" },
]

const FILTERS = [
  { value: "PENDING", label: "Chờ xác nhận" },
  { value: "CONFIRMED", label: "Đang đóng gói" },
  { value: "SHIPPING", label: "Đang giao" },
  { value: "DELIVERED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
]

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams
  const [counts, list] = await Promise.all([getOrderStatusCounts(), listAllOrders(sp)])

  return (
    <>
      <StatGrid>
        <StatCard label="Chờ xác nhận" value={String(counts.PENDING)} unit="đơn mới" chip="Cần duyệt" chipTone="warning" />
        <StatCard label="Đang vận chuyển" value={String(counts.SHIPPING)} unit="đơn" chip="Đang giao" chipTone="info" />
        <StatCard label="Đã hoàn thành trong tháng" value={String(counts.deliveredThisMonth)} unit="đơn" chip="Tháng này" chipTone="success" />
        <StatCard label="Đã hủy" value={String(counts.CANCELLED)} unit="đơn" chip="Tổng cộng" chipTone="brand" />
      </StatGrid>

      <ListSection title="Danh Sách Đơn Hàng">
        <ListToolbar placeholder="Tìm mã đơn, tên khách, SĐT..." filters={FILTERS} />
        <ListCard>
          {list.items.length === 0 ? (
            <AdminEmpty title="Không có đơn hàng nào." hint="Thử đổi từ khóa hoặc bộ lọc trạng thái." />
          ) : (
            <AdminTable columns={COLUMNS} minWidth={900}>
              {list.items.map((o) => (
                <AdminTr key={o.id}>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline">
                      #{o.code}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{formatDayMonthTime(o.createdAt)}</span>
                  </td>
                  <td>
                    <span className="block font-bold">{o.customerName}</span>
                    {o.customerPhone && <span className="block text-xs text-muted-foreground">{o.customerPhone}</span>}
                  </td>
                  <td>
                    <span className="block font-bold">{o.firstProductName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {o.otherLines > 0 ? `+ ${o.otherLines} món khác` : `Số lượng: ${o.quantity}`}
                    </span>
                  </td>
                  <td>
                    <span className="block text-xs font-bold">{PAYMENT_METHOD_SHORT[o.paymentMethod] ?? o.paymentMethod}</span>
                    <span className="mt-1 block">
                      <StatusPill tone={ORDER_PAYMENT_STATUS_TONE[o.paymentStatus] ?? "neutral"}>
                        {ORDER_PAYMENT_STATUS_LABEL[o.paymentStatus] ?? o.paymentStatus}
                      </StatusPill>
                    </span>
                  </td>
                  <td className="font-bold whitespace-nowrap text-brand">{formatVnd(o.total)}</td>
                  <td>
                    <StatusPill tone={ADMIN_ORDER_STATUS_TONE[o.status]}>{ADMIN_ORDER_STATUS_LABEL[o.status]}</StatusPill>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <AdvanceOrderButton orderId={o.id} code={o.code} status={o.status} />
                      <Link
                        href={`/admin/orders/${o.id}`}
                        aria-label={`Chi tiết đơn ${o.code}`}
                        className={buttonVariants({ variant: "ghost", size: "sm" })}
                      >
                        Chi tiết
                      </Link>
                    </div>
                  </td>
                </AdminTr>
              ))}
            </AdminTable>
          )}
          <AdminPagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            noun="đơn hàng"
            basePath="/admin/orders"
            searchParams={sp}
          />
        </ListCard>
      </ListSection>
    </>
  )
}
