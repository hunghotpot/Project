import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { ADMIN_ORDER_STATUS_LABEL, ADMIN_ORDER_STATUS_TONE } from "@/components/admin/admin-nav"
import { AdminTable, AdminTr } from "@/components/admin/list/admin-table"
import { OrderDetailActions } from "@/components/admin/orders/order-detail-actions"
import {
  ORDER_ACTOR_LABEL,
  ORDER_PAYMENT_STATUS_LABEL,
  ORDER_PAYMENT_STATUS_TONE,
} from "@/components/admin/orders/order-labels"
import { StatusPill } from "@/components/admin/status-pill"
import { formatDateTime, formatVnd } from "@/lib/format"
import { PAYMENT_METHOD_LABEL } from "@/lib/order"
import { getAdminOrderDetail } from "@/server/services/admin-order.service"

export const metadata: Metadata = { title: "Chi tiết đơn hàng" }

const ITEM_COLUMNS = [
  { label: "Sản phẩm" },
  { label: "SKU" },
  { label: "Size" },
  { label: "Màu" },
  { label: "SL", className: "text-right" },
  { label: "Đơn giá", className: "text-right" },
  { label: "Thành tiền", className: "text-right" },
]

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-label">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  )
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getAdminOrderDetail(id)
  if (!order) notFound()

  const a = order.shippingAddress
  const address = [a.street, a.ward, a.district, a.province].filter(Boolean).join(", ")

  return (
    <>
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-label font-bold hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden /> Quay lại danh sách đơn
      </Link>

      <section aria-label="Tổng quan đơn" className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Đơn #{order.code}</h2>
            <p className="mt-1 text-label text-muted-foreground">Đặt lúc {formatDateTime(order.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={ADMIN_ORDER_STATUS_TONE[order.status]}>{ADMIN_ORDER_STATUS_LABEL[order.status]}</StatusPill>
            <StatusPill tone={ORDER_PAYMENT_STATUS_TONE[order.paymentStatus] ?? "neutral"}>
              {ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
            </StatusPill>
          </div>
        </div>
        <div className="mt-6">
          <OrderDetailActions
            orderId={order.id}
            code={order.code}
            status={order.status}
            paymentMethod={order.paymentMethod}
            paymentStatus={order.paymentStatus}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Khách hàng">
          <dl>
            <Row label="Họ tên">{order.customer.name}</Row>
            <Row label="Email">{order.customer.email}</Row>
            <Row label="SĐT tài khoản">{order.customer.phone ?? "—"}</Row>
          </dl>
        </Card>
        <Card title="Giao hàng">
          <dl>
            <Row label="Người nhận">{a.fullName}</Row>
            <Row label="SĐT nhận hàng">{a.phone}</Row>
            <Row label="Địa chỉ">{address}</Row>
            {order.note && <Row label="Ghi chú của khách">{order.note}</Row>}
          </dl>
        </Card>
      </div>

      <Card title="Sản phẩm trong đơn">
        <AdminTable columns={ITEM_COLUMNS} minWidth={760}>
          {order.items.map((i, idx) => (
            <AdminTr key={`${i.sku}-${idx}`}>
              <td className="font-bold">{i.productName}</td>
              <td className="text-muted-foreground">{i.sku}</td>
              <td>{i.size}</td>
              <td>{i.color}</td>
              <td className="text-right">{i.quantity}</td>
              <td className="text-right whitespace-nowrap">{formatVnd(i.unitPrice)}</td>
              <td className="text-right font-bold whitespace-nowrap">{formatVnd(i.lineTotal)}</td>
            </AdminTr>
          ))}
        </AdminTable>
        <dl className="mt-4 ml-auto max-w-xs">
          <Row label="Tạm tính">{formatVnd(order.subtotal)}</Row>
          <Row label="Phí vận chuyển">{formatVnd(order.shippingFee)}</Row>
          <Row label="Tổng tiền">
            <span className="text-base text-brand">{formatVnd(order.total)}</span>
          </Row>
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Thanh toán">
          <dl>
            <Row label="Phương thức">{PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}</Row>
            <Row label="Trạng thái">{ORDER_PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}</Row>
          </dl>
        </Card>
        <Card title="Lịch sử trạng thái">
          <ol className="space-y-3">
            {order.history.map((h, idx) => {
              const same = h.fromStatus === h.toStatus
              const title = same
                ? (h.note ?? ADMIN_ORDER_STATUS_LABEL[h.toStatus])
                : `${h.fromStatus ? `${ADMIN_ORDER_STATUS_LABEL[h.fromStatus]} → ` : ""}${ADMIN_ORDER_STATUS_LABEL[h.toStatus]}`
              return (
                <li key={idx} className="text-label">
                  <p className="font-bold">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.createdAt)} · {h.actorName ?? ORDER_ACTOR_LABEL[h.actorType] ?? h.actorType}
                    {!same && h.note ? ` · ${h.note}` : ""}
                  </p>
                </li>
              )
            })}
          </ol>
        </Card>
      </div>
    </>
  )
}
