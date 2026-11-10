"use client"

import Image from "next/image"
import Link from "next/link"
import { ShoppingBagIcon, Trash2Icon } from "lucide-react"
import { CartStepper } from "@/components/cart/cart-stepper"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCart, useRemoveItem } from "@/hooks/use-cart"
import { EMPTY_CART } from "@/lib/cart"
import { formatVnd } from "@/lib/format"
import { useCartUi } from "@/stores/cart-ui"

// Drawer bên phải: mở khi bấm icon giỏ và sau khi thêm sản phẩm.
export function CartDrawer() {
  const { open, setOpen } = useCartUi()
  const { data } = useCart()
  const cart = data ?? EMPTY_CART
  const { mutate: remove } = useRemoveItem()
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Giỏ hàng <span className="font-normal text-muted-foreground">({cart.itemCount} sản phẩm)</span>
          </SheetTitle>
          <SheetDescription className="sr-only">Các sản phẩm bạn đã thêm vào giỏ hàng</SheetDescription>
        </SheetHeader>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBagIcon className="size-10 text-subtle-foreground" />
            <p className="text-label text-muted-foreground">Giỏ hàng của bạn đang trống.</p>
            <Link href="/products" onClick={close} className={buttonVariants({ variant: "dark", size: "md" })}>
              Tiếp tục mua sắm
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
              {cart.items.map((line) => (
                <li key={line.variantId} className="flex gap-3 rounded-2xl border border-border bg-white p-3">
                  <Link
                    href={`/products/${line.slug}`}
                    onClick={close}
                    className="relative block h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary"
                  >
                    {line.image && <Image src={line.image.url} alt={line.image.alt} fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/products/${line.slug}`} onClick={close} className="line-clamp-2 text-label font-bold hover:text-primary">
                      {line.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Size: <b className="text-foreground">{line.size}</b> | Màu: <b className="text-foreground">{line.color}</b>
                    </p>
                    {line.warnings.map((w) => (
                      <p key={w.code} className="text-xs font-bold text-warning">
                        {w.message}
                      </p>
                    ))}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                      <CartStepper line={line} />
                      <span className="text-label font-bold whitespace-nowrap text-primary">{formatVnd(line.lineTotal)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Xóa ${line.name} khỏi giỏ`}
                    onClick={() => remove({ variantId: line.variantId })}
                    className="text-muted-foreground"
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="space-y-4 border-t border-border p-6">
              <div className="flex items-center justify-between">
                <span className="text-label text-muted-foreground">Tạm tính</span>
                <span className="text-lg font-bold text-primary">{formatVnd(cart.subtotal)}</span>
              </div>
              <Link href="/cart" onClick={close} className={`${buttonVariants({ variant: "dark", size: "lg" })} w-full`}>
                Xem giỏ hàng
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
