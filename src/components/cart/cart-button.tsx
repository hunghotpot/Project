"use client"

import Link from "next/link"
import { ShoppingCartIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useCart } from "@/hooks/use-cart"
import { useCartUi } from "@/stores/cart-ui"

// Icon giỏ ở header + badge. Đã đăng nhập: bấm mở drawer (Ctrl/Cmd+click hoặc khi chưa có JS vẫn đi tới /cart).
// Khách: dẫn sang trang đăng nhập rồi quay lại /cart.
export function CartButton({ authenticated }: { authenticated: boolean }) {
  const { data } = useCart()
  const setOpen = useCartUi((s) => s.setOpen)
  const count = data?.itemCount ?? 0
  const badge = count > 99 ? "99+" : String(count)

  return (
    <Link
      href={authenticated ? "/cart" : "/login?next=%2Fcart"}
      aria-label={count > 0 ? `Giỏ hàng, ${count} sản phẩm` : "Giỏ hàng"}
      onClick={(e) => {
        if (!authenticated) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        setOpen(true)
      }}
      className={`${buttonVariants({ variant: "secondary", size: "icon-sm" })} relative overflow-visible`}
    >
      <ShoppingCartIcon />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-2xs leading-none font-bold text-primary-foreground"
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

