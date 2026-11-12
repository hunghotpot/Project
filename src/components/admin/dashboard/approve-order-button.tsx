"use client"

import { approveOrderAction } from "@/app/actions/admin-orders"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"

export function ApproveOrderButton({ orderId, code }: { orderId: string; code: string }) {
  const { pending, run } = useAdminAction()

  return (
    <Button
      size="sm"
      variant="dark"
      disabled={pending}
      aria-label={`Duyệt đơn ${code}`}
      className="px-5"
      onClick={() => run(() => approveOrderAction(orderId))}
    >
      {pending ? "Đang duyệt..." : "Duyệt"}
    </Button>
  )
}
