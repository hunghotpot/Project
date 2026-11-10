import Image from "next/image"
import Link from "next/link"
import { cn } from "cn"
import { CancelOrderButton } from "@/components/orders/cancel-order-button"
import { OrderStatusPill } from "@/components/orders/order-status-pill"
import { ReorderButton } from "@/components/orders/reorder-button"
import { buttonVariants } from "@/components/ui/button"
import { formatDate, formatDateTime, formatVnd } from "@/lib/format"
import { canCancelStatus } from "@/lib/order-timeline"
import { PAYMENT_METHOD_SHORT } from "@/lib/order"
import type { OrderListItem, OrderStatusValue } from "@/types/order"

const FOOTER: Record<OrderStatusValue, { text: string; tone: string }> = {
  PENDING: { text: "⏳ Đơn hàng đang chờ cửa hàng xác nhận", tone: "text-warning" },
  CONFIRMED: { text: "⏳ Đơn hàng đã được xác nhận và đang được chuẩn bị giao cho đơn vị vận chuyển", tone: "text-warning" },
  SHIPPING: { text: "🚚 Đơn hàng đang được vận chuyển đến bạn", tone: "text-info" },
  DELIVERED: { text: "✓ Đã giao thành công đến bạn", tone: "text-success" },
  CANCELLED: { text: "Đơn hàng đã được hủy", tone: "text-subtle-foreground" },
}

// cn() gộp class xung đột: outline cần border-border thắng border-transparent của nền nút.
const outlineBtn = cn(buttonVariants({ variant: "outline", size: "md" }), "bg-white px-8")

// Figma "OrderCard": thanh tiêu đề (mã đơn • ngày đặt • thanh toán • trạng thái), thân (ảnh, sản phẩm, tổng tiền, nút), dòng thông báo.
export function OrderCard({ order }: { order: OrderListItem }) {
  const cancelled = order.status === "CANCELLED"
  const [first, second] = order.items
  const extraLines = order.lineCount - 2
  const footer = FOOTER[order.status]
  const detailHref = `/account/orders/${order.id}`

  const meta = [`Ngày đặt: ${formatDateTime(order.createdAt)}`, `Thanh toán: ${PAYMENT_METHOD_SHORT[order.paymentMethod] ?? order.paymentMethod}`]
  if (order.deliveredAt) meta.push(`Giao thành công: ${formatDate(order.deliveredAt)}`)
  if (cancelled && order.cancelReason) meta.push(`Lý do hủy: ${order.cancelReason}`)

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card" aria-label={`Đơn hàng ${order.code}`}>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-surface px-6 py-3.5">
        <Link href={detailHref} className={cn("text-sm font-bold hover:text-primary", cancelled && "text-muted-foreground")}>
          MÃ ĐƠN: #{order.code}
        </Link>
        <p className={cn("text-xs text-muted-foreground", cancelled && "text-subtle-foreground")}>{meta.join(" • ")}</p>
        <OrderStatusPill status={order.status} className="ml-auto" />
      </header>

      <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-4">
          <Link
            href={detailHref}
            className={cn("relative block h-[72px] w-[60px] shrink-0 overflow-hidden rounded-lg bg-secondary", cancelled && "opacity-60 grayscale")}
          >
            {first?.image ? (
              <Image src={first.image.url} alt={first.image.alt} fill sizes="60px" className="object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-2xs text-subtle-foreground">[Ảnh SP]</span>
            )}
          </Link>
          <div className={cn("min-w-0 space-y-1", cancelled && "text-muted-foreground")}>
            <p className="text-nav font-bold">{first?.productName ?? "—"}</p>
            {first && (
              <p className="text-xs text-muted-foreground">
                Phân loại:{" "}
                <b className={cancelled ? "text-muted-foreground" : "text-foreground"}>
                  Size {first.size} • {first.color}
                </b>{" "}
                | SL: {first.quantity}
              </p>
            )}
            {second && (
              <p className={cn("text-xs", cancelled ? "text-subtle-foreground" : "text-primary")}>
                + {second.quantity} {second.productName} (Size {second.size} • {second.color})
                {extraLines > 0 && ` và ${extraLines} sản phẩm khác`}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-8">
          <div className="md:text-right">
            <p className="text-label text-muted-foreground">
              Tổng số tiền{order.quantity > 1 ? ` (${order.quantity} món)` : ""}:
            </p>
            <p className={cn("text-xl font-bold", cancelled ? "text-muted-foreground" : order.status === "DELIVERED" ? "text-foreground" : "text-primary")}>
              {formatVnd(order.total)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {order.status === "SHIPPING" && (
              <Link href={detailHref} className={outlineBtn}>
                Theo Dõi Đơn
              </Link>
            )}
            {canCancelStatus(order.status) && <CancelOrderButton orderId={order.id} code={order.code} className="h-11 px-8" />}
            {(order.status === "PENDING" || order.status === "CONFIRMED") && (
              <Link href={detailHref} className={`${buttonVariants({ variant: "dark", size: "md" })} px-8`}>
                Xem Chi Tiết
              </Link>
            )}
            {(order.status === "DELIVERED" || cancelled) && (
              <Link href={detailHref} className={outlineBtn}>
                Xem Chi Tiết
              </Link>
            )}
            {(order.status === "SHIPPING" || order.status === "DELIVERED" || cancelled) && (
              <ReorderButton orderId={order.id} variant={cancelled ? "dark" : "default"} size="default" className="h-11 px-8">
                Mua Lại
              </ReorderButton>
            )}
          </div>
        </div>
      </div>

      <footer className={cn("px-6 pb-5 text-xs", footer.tone)}>{footer.text}</footer>
    </article>
  )
}

