"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cancelOrderAction } from "@/app/actions/orders"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

// "Hủy đơn hàng": hỏi xác nhận + lý do (tuỳ chọn). Hoàn kho và ghi lịch sử do server xử lý trong một transaction.
export function CancelOrderButton({
  orderId,
  code,
  className,
  children = "Hủy Đơn Hàng",
}: {
  orderId: string
  code: string
  className?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function confirm() {
    startTransition(async () => {
      const res = await cancelOrderAction({ orderId, reason })
      if (!res.ok) return void toast.error(res.message)
      toast.success(res.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} className={className}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hủy đơn hàng #{code}?</DialogTitle>
            <DialogDescription>Sản phẩm sẽ được hoàn lại kho. Hành động này không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          <label htmlFor={`cancel-reason-${orderId}`} className="text-label font-bold">
            Lý do hủy (tuỳ chọn)
          </label>
          <Textarea
            id={`cancel-reason-${orderId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ví dụ: Đổi ý size sản phẩm"
          />
          <DialogFooter className="gap-3 sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Giữ đơn hàng
            </Button>
            <Button variant="default" onClick={confirm} disabled={pending}>
              {pending ? "Đang hủy..." : "Xác nhận hủy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
