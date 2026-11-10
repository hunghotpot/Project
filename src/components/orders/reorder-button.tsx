"use client"

import { useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ShoppingCartIcon } from "lucide-react"
import { toast } from "sonner"
import { reorderAction } from "@/app/actions/orders"
import { Button } from "@/components/ui/button"
import { CART_KEY } from "@/hooks/use-cart"
import type { ReorderResult } from "@/types/order"
import { useCartUi } from "@/stores/cart-ui"

const SKIP_REASON: Record<ReorderResult["skipped"][number]["reason"], string> = {
  OUT_OF_STOCK: "hết hàng",
  UNAVAILABLE: "không còn bán",
  IN_CART_MAX: "giỏ đã có đủ số lượng còn lại",
}

// "Mua lại": thêm các biến thể còn hàng của đơn cũ vào giỏ, báo rõ dòng nào bị bỏ qua, rồi mở drawer giỏ hàng.
export function ReorderButton({
  orderId,
  variant = "default",
  size = "default",
  disabled,
  className,
  children = "Mua Lại",
  withIcon = false,
}: {
  orderId: string
  variant?: "default" | "dark"
  size?: "default" | "lg"
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  withIcon?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const setCartOpen = useCartUi((s) => s.setOpen)

  function onClick() {
    startTransition(async () => {
      const res = await reorderAction(orderId)
      if (!res.ok) return void toast.error(res.message)
      toast.success(res.message)
      for (const s of res.skipped ?? []) {
        toast.warning(`${s.productName} (${s.size}, ${s.color}): ${SKIP_REASON[s.reason]}`)
      }
      await queryClient.invalidateQueries({ queryKey: CART_KEY })
      setCartOpen(true)
    })
  }

  return (
    <Button variant={variant} size={size} disabled={disabled || pending} onClick={onClick} className={className}>
      {withIcon && <ShoppingCartIcon />}
      {pending ? "Đang thêm..." : children}
    </Button>
  )
}
