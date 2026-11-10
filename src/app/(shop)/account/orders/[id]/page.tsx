import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CancelOrderButton } from "@/components/orders/cancel-order-button"
import { OrderStatusPill } from "@/components/orders/order-status-pill"
import { OrderTimeline } from "@/components/orders/order-timeline"
import { ReorderButton } from "@/components/orders/reorder-button"
import { formatDateTime, formatVnd } from "@/lib/format"
import { PAYMENT_METHOD_LABEL } from "@/lib/order"
import { buildTimeline, canCancelStatus } from "@/lib/order-timeline"
import { requireUser } from "@/server/auth/session"
import { getOrderDetail } from "@/server/services/order.service"

export const metadata: Metadata = { title: "Chi tiết đơn hàng", robots: { index: false } }

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thanh toán thất bại",
  REFUNDED: "Đã hoàn tiền",
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/account/orders/${id}`)
  // Quyền nằm ở service: đơn của người khác trả về null → 404 (không lộ sự tồn tại của đơn).
  const order = await getOrderDetail(user.id, id)
  if (!order) notFound()

  const steps = buildTimeline(order.status, order.history)
  const a = order.shippingAddress
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0)
  const addable = order.items.filter((i) => i.inStock).length
  const cancelled = order.status === "CANCELLED"

  return (
    <div className="space-y-6 pb-16">
      <div>
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Trang chủ
          </Link>
          {" / "}
          <Link href="/account/profile" className="hover:text-foreground">
            Tài khoản
          </Link>
          {" / "}
          <span className="font-bold text-foreground">Lịch sử &amp; Theo dõi đơn hàng</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Lịch Sử &amp; Theo Dõi Đơn Hàng</h1>
          <p className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-2 text-xs font-bold text-sidebar-foreground">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            Chủ đơn: <span className="text-foreground">{user.name}</span>
          </p>
        </div>
      </div>

      <article className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface px-6 py-4">
          <h2 className="text-nav font-bold">MÃ ĐƠN HÀNG: #{order.code}</h2>
          <p className="text-label text-muted-foreground">Ngày đặt: {formatDateTime(order.createdAt)}</p>
          <OrderStatusPill status={order.status} uppercase className="ml-auto" />
        </header>

        <div className="space-y-8 p-6 sm:p-8">
          <OrderTimeline steps={steps} />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section aria-labelledby="products-heading" className="space-y-4">
              <h3 id="products-heading" className="text-nav font-bold">
                DANH SÁCH SẢN PHẨM ({quantity} MÓN)
              </h3>
              <ul className="space-y-3">
                {order.items.map((i, idx) => (
                  <li key={`${i.variantId ?? "x"}-${idx}`} className="flex gap-4 rounded-xl border border-border bg-surface p-4">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                      {i.image && <Image src={i.image.url} alt={i.image.alt} fill sizes="64px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {i.slug ? (
                        <Link href={`/products/${i.slug}`} className="text-sm font-bold hover:text-primary">
                          {i.productName}
                        </Link>
                      ) : (
                        <p className="text-sm font-bold">{i.productName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Phân loại: <b className="text-foreground">Size {i.size} • Màu {i.color}</b>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Số lượng: <b className="text-foreground">{i.quantity}</b>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-bold">{formatVnd(i.unitPrice * i.quantity)}</p>
                      <span
                        className={
                          i.inStock
                            ? "rounded-md bg-success-soft px-2 py-1 text-2xs font-bold text-success"
                            : "rounded-md bg-secondary px-2 py-1 text-2xs font-bold text-muted-foreground"
                        }
                      >
                        {i.inStock ? "Còn hàng trong kho" : "Hết hàng"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="space-y-6">
              <section aria-labelledby="address-heading" className="space-y-4">
                <h3 id="address-heading" className="text-nav font-bold">
                  ĐỊA CHỈ NHẬN HÀNG
                </h3>
                <div className="space-y-1.5 rounded-xl border border-border bg-surface p-4 text-label">
                  <p className="font-bold">
                    {a.fullName} <span className="font-normal text-muted-foreground">({a.phone})</span>
                  </p>
                  <p className="text-sidebar-foreground">{[a.street, a.ward, a.district, a.province].join(", ")}</p>
                  {order.note && <p className="text-xs text-subtle-foreground">Ghi chú: {order.note}</p>}
                </div>
              </section>

              <section aria-labelledby="payment-heading" className="space-y-4">
                <h3 id="payment-heading" className="text-nav font-bold">
                  CHI TIẾT THANH TOÁN
                </h3>
                <dl className="space-y-3 rounded-xl border border-border bg-surface p-4 text-label">
                  <Row label="Phương thức:" value={PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod} />
                  <Row label="Trạng thái:" value={PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus} />
                  <Row label={`Tạm tính (${quantity} sản phẩm):`} value={formatVnd(order.subtotal)} />
                  <Row
                    label="Phí vận chuyển:"
                    value={order.shippingFee === 0 ? "Miễn phí" : formatVnd(order.shippingFee)}
                    valueClass={order.shippingFee === 0 ? "text-success" : ""}
                  />
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                    <dt className="text-nav font-bold">Tổng thanh toán:</dt>
                    <dd className="text-lg font-bold text-primary">{formatVnd(order.total)}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-4 border-t border-border px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div className="space-y-2">
            {canCancelStatus(order.status) && (
              <CancelOrderButton orderId={order.id} code={order.code} className="h-[52px] w-full px-10 sm:w-auto">
                HỦY ĐƠN HÀNG
              </CancelOrderButton>
            )}
            {order.status === "SHIPPING" && (
              <p className="text-xs text-subtle-foreground">* Đơn đã bàn giao đơn vị vận chuyển, không thể hủy trực tiếp</p>
            )}
          </div>
          <div className="space-y-2 sm:text-right">
            <ReorderButton
              orderId={order.id}
              size="lg"
              disabled={addable === 0}
              withIcon
              className="w-full sm:w-auto sm:min-w-[320px]"
            >
              {addable > 0 ? `MUA LẠI (THÊM ${addable} SẢN PHẨM VÀO GIỎ)` : "MUA LẠI"}
            </ReorderButton>
            <p className={addable === order.items.length ? "text-xs text-success" : "text-xs text-warning"}>
              {addable === order.items.length
                ? "✓ Tất cả phân loại Size/Màu đều còn hàng trong kho"
                : addable === 0
                  ? "Tất cả sản phẩm trong đơn đã hết hàng hoặc ngừng bán"
                  : "Sản phẩm hết hàng sẽ không được thêm vào giỏ"}
            </p>
          </div>
        </footer>
      </article>

      <p>
        <Link href="/account/orders" className="text-sm font-bold hover:text-primary">
          ← Quay lại danh sách đơn hàng
        </Link>
        {cancelled && <span className="sr-only"> (đơn đã hủy)</span>}
      </p>
    </div>
  )
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-bold ${valueClass}`}>{value}</dd>
    </div>
  )
}
