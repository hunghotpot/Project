"use client"

import { advanceOrderAction } from "@/app/actions/admin-orders"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { NEXT_STEP } from "@/components/admin/orders/order-labels"
import { Button } from "@/components/ui/button"

/** Nút đẩy đơn sang bước kế tiếp theo trạng thái hiện tại; trạng thái cuối thì không hiện gì. */
export function AdvanceOrderButton({ orderId, code, status, size = "sm" }: { orderId: string; code: string; status: string; size?: "sm" | "md" }) {
  const { pending, run } = useAdminAction()
  const step = NEXT_STEP[status]
  if (!step) return null

  return (
    <Button
      size={size}
      variant={step.to === "CONFIRMED" ? "dark" : "secondary"}
      disabled={pending}
      aria-label={`${step.label} đơn ${code}`}
      className="px-5"
      onClick={() => run(() => advanceOrderAction(orderId, step.to))}
    >
      {pending ? "Đang xử lý..." : step.label}
    </Button>
  )
}
