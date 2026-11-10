"use client"

import Image from "next/image"
import Link from "next/link"
import { ShoppingBagIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"
import { CartStepper } from "@/components/cart/cart-stepper"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCart, useRemoveItem } from "@/hooks/use-cart"
import { EMPTY_CART } from "@/lib/cart"
import { formatVnd } from "@/lib/format"
import { calculateShippingFee } from "@/lib/shipping"

// Figma "Giỏ Hàng": cột trái = bảng sản phẩm, cột phải = card "Tóm tắt đơn hàng".
const ROW = "md:grid md:grid-cols-[minmax(0,1fr)_100px_110px_110px_36px] md:items-center md:gap-3"

export function CartPageView() {
  const { data } = useCart()
  const cart = data ?? EMPTY_CART
  const { mutate: remove } = useRemoveItem()
  const hasWarnings = cart.items.some((l) => l.warnings.length > 0)
  const shippingFee = calculateShippingFee(cart.subtotal)

  return (
    <div className="pb-16">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Trang chủ
        </Link>
        {" / "}
        <span className="font-bold text-foreground">Giỏ hàng của bạn</span>
      </nav>
      <h1 className="mt-6 mb-10 text-3xl font-bold">
        Giỏ Hàng <span className="text-lg text-muted-foreground">({cart.itemCount} sản phẩm)</span>
      </h1>

      {cart.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border-strong px-6 py-20 text-center">
          <ShoppingBagIcon className="size-12 text-subtle-foreground" />
          <p className="text-lg font-bold">Giỏ hàng của bạn đang trống</p>
          <p className="text-label text-muted-foreground">Hãy chọn vài sản phẩm bạn yêu thích nhé.</p>
          <Link href="/products" className={buttonVariants({ variant: "dark", size: "md" })}>
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_470px] xl:gap-12">
          <div className="min-w-0 space-y-4">
            {hasWarnings && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-label text-warning">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                Một số sản phẩm đã thay đổi giá hoặc tồn kho. Vui lòng kiểm tra lại trước khi thanh toán.
              </p>
            )}

            <div className={`${ROW} hidden rounded-xl bg-surface px-6 py-4 text-label font-bold text-muted-foreground`}>
              <span>SẢN PHẨM</span>
              <span className="text-center">ĐƠN GIÁ</span>
              <span className="text-center">SỐ LƯỢNG</span>
              <span className="text-center">THÀNH TIỀN</span>
              <span />
            </div>

            <ul className="space-y-4">
              {cart.items.map((line) => (
                <li key={line.variantId} className={`${ROW} rounded-2xl border border-border bg-white p-5`}>
                  <div className="flex min-w-0 gap-5">
                    <Link
                      href={`/products/${line.slug}`}
                      className="relative block h-[98px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-secondary"
                    >
                      {line.image ? (
                        <Image src={line.image.url} alt={line.image.alt} fill sizes="88px" className="object-cover" />
                      ) : (
                        <span className="grid h-full place-items-center text-2xs text-subtle-foreground">[Ảnh SP]</span>
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                      <Link href={`/products/${line.slug}`} className="text-nav font-bold hover:text-primary">
                        {line.name}
                      </Link>
                      <p className="text-label text-muted-foreground">
                        Size: <b className="text-foreground">{line.size}</b> | Màu: <b className="text-foreground">{line.color}</b>
                      </p>
                      {line.warnings.map((w) => (
                        <p key={w.code} className="text-xs font-bold text-warning">
                          {w.message}
                        </p>
                      ))}
                      <button
                        type="button"
                        onClick={() => remove({ variantId: line.variantId })}
                        className="mt-1 text-xs font-bold text-primary hover:underline"
                      >
                        Xóa khỏi giỏ
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 md:mt-0 md:contents">
                    <span className="text-nav font-bold md:text-center">{formatVnd(line.unitPrice)}</span>
                    <div className="md:flex md:justify-center">
                      <CartStepper line={line} />
                    </div>
                    <span className="text-nav font-bold text-primary md:text-center">{formatVnd(line.lineTotal)}</span>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Xóa ${line.name} khỏi giỏ`}
                      onClick={() => remove({ variantId: line.variantId })}
                      className="text-subtle-foreground"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Link href="/products" className="inline-block pt-2 text-sm font-bold hover:text-primary">
              ← Tiếp tục mua sắm
            </Link>
          </div>

          <aside aria-labelledby="order-summary" className="h-fit rounded-3xl border border-border bg-card p-8">
            <h2 id="order-summary" className="mb-8 text-xl font-bold">
              Tóm tắt đơn hàng
            </h2>

            {/* Chưa có voucher ở backend: giữ đúng bố cục Figma nhưng chưa dùng được. */}
            <div className="space-y-3 border-b border-border pb-8" title="Sắp ra mắt">
              <label htmlFor="voucher" className="text-label font-bold">
                Mã giảm giá / Voucher
              </label>
              <div className="flex gap-3">
                <Input id="voucher" variant="white" size="sm" placeholder="Nhập mã ưu đãi..." disabled className="h-12" />
                <Button variant="dark" shape="rounded" size="md" disabled className="h-12">
                  Áp dụng
                </Button>
              </div>
            </div>

            <dl className="space-y-4 border-b border-border py-8 text-sm">
              <Row label="Tổng số lượng" value={`${cart.itemCount} sản phẩm`} />
              <Row label="Tạm tính" value={formatVnd(cart.subtotal)} />
              <Row
                label="Phí vận chuyển"
                value={shippingFee === 0 ? "Miễn phí" : formatVnd(shippingFee)}
                valueClass={shippingFee === 0 ? "text-success" : ""}
              />
            </dl>

            <div className="pt-8">
              <div className="flex items-end justify-between gap-4">
                <span className="text-base font-bold">Tổng cộng</span>
                <span className="text-[22px] leading-none font-bold text-primary">{formatVnd(cart.subtotal + shippingFee)}</span>
              </div>
              <p className="mt-2 text-right text-xs text-subtle-foreground">(Đã bao gồm VAT nếu có)</p>
              <Link href="/checkout" className={`${buttonVariants({ size: "xl" })} mt-8 w-full`}>
                TIẾN HÀNH THANH TOÁN
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-bold ${valueClass}`}>{value}</dd>
    </div>
  )
}


