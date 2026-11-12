"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Hộp xác nhận cho thao tác khó hoàn tác (huỷ đơn, khoá tài khoản, xoá). Nút xác nhận màu brand; luôn nói rõ hậu quả trong `description`. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className="sm:max-w-md sm:p-8" showCloseButton={false}>
        <DialogHeader className="pr-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-label">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t-0 pt-0">
          <Button type="button" variant="secondary" size="md" className="px-8" disabled={pending} onClick={() => onOpenChange(false)}>
            Hủy bỏ
          </Button>
          <Button type="button" size="md" className="px-8" disabled={pending} onClick={onConfirm}>
            {pending ? "Đang xử lý..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
