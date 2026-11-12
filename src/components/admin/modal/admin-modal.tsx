"use client"

import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Bề rộng theo Figma (÷1.49): khách hàng ~600, voucher ~680, sản phẩm ~760.
const SIZE = { md: "sm:max-w-xl", lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" } as const

/*
 * Modal Admin (Figma): tiêu đề + mô tả, đường kẻ, thân form, chân có "Hủy bỏ" và nút chính.
 * Thân modal thường là <form id="..."> và `footer` là <ModalActions formId="..."/> để nút Lưu nằm ngoài vùng cuộn mà vẫn submit đúng form.
 */
export function AdminModal({
  open,
  onOpenChange,
  title,
  description,
  size = "lg",
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  size?: keyof typeof SIZE
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className={cn(SIZE[size], "sm:p-8")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

/** Hai nút ở chân modal: "Hủy bỏ" (xám) và nút chính (brand). `formId` nối nút với <form id> đặt trong thân modal. */
export function ModalActions({
  submitLabel,
  cancelLabel = "Hủy bỏ",
  pending = false,
  formId,
  onCancel,
}: {
  submitLabel: string
  cancelLabel?: string
  pending?: boolean
  formId?: string
  onCancel: () => void
}) {
  return (
    <>
      <Button type="button" variant="secondary" size="md" className="px-8" disabled={pending} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" form={formId} size="md" className="px-8" disabled={pending}>
        {pending ? "Đang lưu..." : submitLabel}
      </Button>
    </>
  )
}
