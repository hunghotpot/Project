"use client"

import { useState } from "react"
import { lockCustomerAction, unlockCustomerAction } from "@/app/actions/admin-customers"
import { ConfirmDialog } from "@/components/admin/modal/confirm-dialog"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"

/** Khóa/Mở khóa một khách. `link`: chữ trong bảng (Figma); `button`: nút ở trang chi tiết. Server vẫn là chốt kiểm quyền. */
export function CustomerLockButton({
  customerId,
  name,
  locked,
  display = "link",
}: {
  customerId: string
  name: string
  locked: boolean
  display?: "link" | "button"
}) {
  const [open, setOpen] = useState(false)
  const { pending, run } = useAdminAction()

  const label = locked ? "Mở" : "Khóa"
  const full = locked ? "Mở khóa" : "Khóa tài khoản"

  function confirm() {
    run(() => (locked ? unlockCustomerAction(customerId) : lockCustomerAction(customerId)), {
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <>
      {display === "link" ? (
        <button
          type="button"
          aria-label={`${locked ? "Mở khóa" : "Khóa"} tài khoản ${name}`}
          onClick={() => setOpen(true)}
          className={`rounded text-label font-bold outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30 ${locked ? "text-success" : "text-brand"}`}
        >
          {label}
        </button>
      ) : (
        <Button type="button" size="md" variant={locked ? "dark" : "default"} onClick={() => setOpen(true)}>
          {full}
        </Button>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={locked ? "Mở khóa tài khoản?" : "Khóa tài khoản?"}
        description={
          locked
            ? `Khách hàng ${name} sẽ có thể đăng nhập trở lại (phải đăng nhập lại vì các phiên cũ đã bị thu hồi).`
            : `Khách hàng ${name} sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho đến khi bạn mở khóa.`
        }
        confirmLabel={locked ? "Mở khóa" : "Khóa tài khoản"}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  )
}
