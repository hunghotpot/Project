import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, CheckIcon, ShoppingBagIcon } from "lucide-react"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"
import { formatVnd } from "@/lib/format"
import { PAYMENT_METHOD_LABEL } from "@/lib/order"
import { requireUser } from "@/server/auth/session"
import { getOrder } from "@/server/services/order.service"

export const metadata: Metadata = { title: "Đặt hàng thành công", robots: { index: false } }

export default async function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser(`/orders/${id}/success`)
  const order = await getOrder(user.id, id)
  if (!order) notFound()

  const a = order.shippingAddress
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0)
  const first = order.items[0]
  const productsText = first
    ? `${first.productName} (Size ${first.size})${order.items.length > 1 ? ` + ${order.items.length - 1} sản phẩm khác` : ""}`
    : "—"
  const awaitingVnpay = order.paymentMethod === "VNPAY" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED"
  const awaitingTransfer = order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" && order.status !== "CANCELLED"

  return (
    <div className="pb-16">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Trang chủ
        </Link>
        {" / "}
        <Link href="/cart" className="hover:text-foreground">
          Giỏ hàng
        </Link>
        {" / Thanh toán / "}
        <span className="font-bold text-foreground">Đặt hàng thành công</span>
      </nav>

      <div className="mx-auto mt-8 max-w-[740px] rounded-3xl border border-border bg-card px-6 py-12 sm:px-10">
        <div className="mx-auto grid size-[72px] place-items-center rounded-full bg-success text-white ring-8 ring-success-soft">
          <CheckIcon className="size-9" strokeWidth={2.5} />
        </div>
        <h1 className="mt-8 text-center text-3xl font-bold">ĐẶT HÀNG THÀNH CÔNG</h1>
        <p className="mx-auto mt-4 max-w-md text-center text-label text-muted-foreground">
          Cảm ơn bạn đã đặt hàng! Đơn hàng của bạn đã được tiếp nhận và đang xử lý.
        </p>
        {awaitingVnpay && (
          <p className="mt-4 text-center text-label font-bold text-warning">
            Đang chờ VNPay xác nhận thanh toán, trạng thái đơn sẽ cập nhật trong giây lát.
          </p>
        )}
        {awaitingTransfer && (
          <p className="mt-4 text-center text-label font-bold text-warning">
            Đơn sẽ được xác nhận sau khi cửa hàng nhận được chuyển khoản.{" "}
            <Link href={`/orders/${order.id}/payment`} className="underline">
              Xem lại mã QR
            </Link>
          </p>
        )}

        <dl className="mt-10 space-y-4 rounded-2xl border border-border bg-white p-7 text-label">
          <Row label="Mã đơn hàng:" value={`#${order.code}`} strong />
          <Row label="Phương thức thanh toán:" value={PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod} />
          <Row label="Người nhận & SĐT:" value={`${a.fullName} • ${a.phone}`} />
          <Row label="Địa chỉ giao hàng:" value={[a.street, a.ward, a.district, a.province].join(", ")} />
          <div className="border-t border-border pt-4">
            <Row label={`Sản phẩm đặt mua (${quantity} món):`} value={productsText} />
          </div>
          <div className="flex items-center justify-between gap-4 pt-1">
            <dt className="text-nav font-bold">Tổng thanh toán:</dt>
            <dd className="text-xl font-bold text-primary">{formatVnd(order.total)}</dd>
          </div>
        </dl>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-white")}>
            <ArrowLeftIcon /> Trở về trang chủ
          </Link>
          <Link href="/account/orders" className={buttonVariants({ size: "lg" })}>
            <ShoppingBagIcon /> Đơn mua
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <dt className="shrink-0 font-bold text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-nav font-bold" : "text-right font-bold"}>{value}</dd>
    </div>
  )
}



