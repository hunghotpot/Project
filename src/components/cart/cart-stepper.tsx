"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"
import { useUpdateQuantity } from "@/hooks/use-cart"
import { MAX_LINE_QUANTITY, type CartLine } from "@/lib/cart"

// Số lượng của một dòng giỏ. Giảm về 1 là dừng (xoá dòng dùng nút "Xóa"); tăng bị chặn bởi tồn kho.
export function CartStepper({ line, className }: { line: CartLine; className?: string }) {
  const { mutate } = useUpdateQuantity()
  const max = Math.min(line.stock, MAX_LINE_QUANTITY)
  const set = (quantity: number) => mutate({ variantId: line.variantId, quantity })

  return (
    <div className={cn("inline-flex h-10 items-center rounded-xl bg-secondary", className)}>
      <button
        type="button"
        aria-label={`Giảm số lượng ${line.name}`}
        disabled={line.quantity <= 1}
        onClick={() => set(line.quantity - 1)}
        className="grid h-full w-9 place-items-center text-muted-foreground disabled:opacity-40"
      >
        <MinusIcon className="size-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-bold" aria-live="polite">
        {line.quantity}
      </span>
      <button
        type="button"
        aria-label={`Tăng số lượng ${line.name}`}
        disabled={line.quantity >= max}
        onClick={() => set(line.quantity + 1)}
        className="grid h-full w-9 place-items-center text-muted-foreground disabled:opacity-40"
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}
