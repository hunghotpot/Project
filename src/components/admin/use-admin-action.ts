"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { AdminActionResult } from "@/lib/admin-action"

/**
 * Chạy một Server Action Admin: hiện toast theo `message`, thành công thì làm mới dữ liệu trang (router.refresh) và gọi onSuccess.
 *   const { pending, run } = useAdminAction()
 *   run(() => lockCustomerAction(id), { onSuccess: () => setOpen(false) })
 * Action phải trả AdminActionResult (đã kiểm quyền ở server); hook không tự kiểm quyền.
 */
export function useAdminAction() {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(action: () => Promise<AdminActionResult>, options?: { onSuccess?: () => void }) {
    startTransition(async () => {
      const res = await action()
      if (res.ok) {
        toast.success(res.message)
        options?.onSuccess?.()
        router.refresh()
      } else {
        toast.error(res.message)
      }
    })
  }

  return { pending, run }
}
