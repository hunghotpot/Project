import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import QRCode from "qrcode"
import { DownloadIcon } from "lucide-react"
import { cn } from "cn"
import { CopyButton } from "@/components/checkout/copy-button"
import { buttonVariants } from "@/components/ui/button"
import { formatVnd } from "@/lib/format"
import { PAYMENT_WINDOW_MINUTES, transferContent } from "@/lib/order"
import { requireUser } from "@/server/auth/session"
import { bankConfig, formatAccountNo } from "@/server/payment/bank-config"
import { VNPAY_RESPONSE_MESSAGE } from "@/server/payment/vnpay"
import { buildVietQrPayload } from "@/server/payment/vietqr"
import { getOrder } from "@/server/services/order.service"
import { expireUnpaidVnpayOrders } from "@/server/services/payment.service"

export const metadata: Metadata = { title: "Thanh toán đơn hàng", robots: { index: false } }

export default async function OrderPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ result?: string; code?: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/orders/${id}/payment`)
  if ((await getOrder(user.id, id))?.paymentMethod === "VNPAY") await expireUnpaidVnpayOrders() // dọn đơn quá hạn trước khi hiển thị
  const order = await getOrder(user.id, id)
  if (!order) notFound()

  if (order.paymentMethod === "VNPAY") {
    // Đã thanh toán xong → trang thành công. Còn lại: báo kết quả / cho thanh toán lại.
    if (order.paymentStatus === "PAID") redirect(`/orders/${id}/success`)
    return <VnpayStatus order={order} search={await searchParams} />
  }
  // Chỉ đơn chuyển khoản đang chờ tiền mới cần mã QR.
  if (order.paymentMethod !== "BANK_TRANSFER" || order.paymentStatus !== "PENDING" || order.status === "CANCELLED") {
    redirect(`/orders/${id}/success`)
  }

  const content = transferContent(order.code)
  const qr = await QRCode.toDataURL(
    buildVietQrPayload({ bankBin: bankConfig.bin, accountNo: bankConfig.accountNo, amount: order.total, content }),
    { margin: 1, width: 360, errorCorrectionLevel: "M" }
  )

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
        <span className="font-bold text-foreground">Quét mã thanh toán VietQR</span>
      </nav>

      <div className="mx-auto mt-8 max-w-[900px] rounded-3xl border border-border bg-card px-6 py-10 sm:px-10">
        <h1 className="text-center text-2xl font-bold">THANH TOÁN ĐƠN HÀNG QUA MÃ QR</h1>
        <p className="mx-auto mt-3 max-w-md text-center text-label text-muted-foreground">
          Sử dụng App Ngân hàng bất kỳ hoặc Ví điện tử (MoMo, ZaloPay) để quét mã
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section aria-label="Mã QR" className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-white p-6">
            <span className="self-start rounded-md bg-ink px-4 py-2 text-xs font-bold text-white">VietQR</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL sinh tại server, không qua tối ưu ảnh */}
            <img src={qr} alt={`Mã VietQR thanh toán đơn ${order.code}`} width={260} height={260} className="rounded-xl border border-border" />
            <a
              href={qr}
              download={`vietqr-${order.code}.png`}
              className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full bg-secondary")}
            >
              <DownloadIcon /> Tải Mã QR Về Máy
            </a>
            <p className="text-center text-xs text-subtle-foreground">Quét được trên mọi ứng dụng Mobile Banking</p>
          </section>

          <section aria-label="Thông tin chuyển khoản" className="rounded-2xl border border-border bg-white p-6">
            <h2 className="text-base font-bold">Thông tin chuyển khoản</h2>
            <p className="mt-1 text-xs text-muted-foreground">Cửa hàng sẽ xác nhận đơn sau khi nhận được tiền</p>

            <dl className="mt-5 space-y-4 border-t border-border pt-5 text-label">
              <Row label="Ngân hàng:" value={bankConfig.name} />
              <Row label="Chủ tài khoản:" value={bankConfig.accountName} />
              <div className="flex items-center justify-between gap-3">
                <dt className="font-bold text-muted-foreground">Số tài khoản:</dt>
                <dd className="flex items-center gap-2 font-bold">
                  {formatAccountNo(bankConfig.accountNo)}
                  <CopyButton value={bankConfig.accountNo} label="Sao" variant="secondary" size="xs" />
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-brand-soft p-4">
              <div>
                <p className="text-xs font-bold text-primary">SỐ TIỀN CỐ ĐỊNH:</p>
                <p className="mt-1 text-[22px] font-bold text-primary">{formatVnd(order.total)}</p>
              </div>
              <CopyButton value={String(order.total)} variant="default" />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-secondary p-4">
              <div>
                <p className="text-xs font-bold text-muted-foreground">NỘI DUNG CHUYỂN KHOẢN CỐ ĐỊNH:</p>
                <p className="mt-1 text-nav font-bold">{content}</p>
              </div>
              <CopyButton value={content} />
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs font-bold text-sidebar-foreground">
              <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-warning" />
              Vui lòng giữ nguyên số tiền và nội dung để đơn được đối soát nhanh.
            </p>

            <Link href={`/orders/${order.id}/success`} className={`${buttonVariants({ variant: "dark", size: "lg" })} mt-6 w-full`}>
              Tôi đã chuyển khoản xong
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-bold text-muted-foreground">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  )
}

const RESULT_TITLE: Record<string, string> = {
  failed: "Thanh toán không thành công",
  invalid: "Không xác thực được kết quả thanh toán",
  expired: "Đơn hàng đã hết hạn thanh toán",
  unconfigured: "Thanh toán VNPay hiện chưa khả dụng",
}

// Đơn VNPAY chưa thanh toán xong: hiện kết quả lần thử vừa rồi và cho thanh toán lại trong cửa sổ 15 phút.
function VnpayStatus({
  order,
  search,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getOrder>>>
  search: { result?: string; code?: string }
}) {
  const cancelled = order.status === "CANCELLED"
  const title = cancelled ? RESULT_TITLE.expired : (RESULT_TITLE[search.result ?? ""] ?? "Đơn hàng đang chờ thanh toán VNPay")
  const detail = cancelled
    ? "Đơn hàng đã bị huỷ và sản phẩm đã được trả lại kho vì chưa thanh toán trong thời hạn. Bạn có thể đặt lại đơn mới."
    : search.result === "failed"
      ? (VNPAY_RESPONSE_MESSAGE[search.code ?? ""] ?? "Giao dịch không thành công.")
      : null
  const deadline = new Date(order.createdAt.getTime() + PAYMENT_WINDOW_MINUTES * 60_000)

  return (
    <div className="pb-16">
      <div className="mx-auto mt-8 max-w-[560px] rounded-3xl border border-border bg-card px-6 py-12 text-center sm:px-10">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-label text-muted-foreground">
          Đơn <b className="text-foreground">#{order.code}</b> • {formatVnd(order.total)}
        </p>
        {detail && <p role="alert" className="mt-4 text-label font-bold text-destructive">{detail}</p>}
        {!cancelled && (
          <>
            <p className="mt-4 text-label text-muted-foreground">
              Đơn sẽ tự huỷ nếu chưa thanh toán trước{" "}
              <b className="text-foreground">
                {deadline.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}
              </b>{" "}
              ({PAYMENT_WINDOW_MINUTES} phút kể từ lúc đặt).
            </p>
            {search.result !== "unconfigured" && (
              <a href={`/api/payment/vnpay/pay?orderId=${order.id}`} className={`${buttonVariants({ size: "lg" })} mt-8 w-full`}>
                Thanh toán lại với VNPay
              </a>
            )}
          </>
        )}
        <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 w-full bg-white")}>
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}


