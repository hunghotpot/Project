"use client"

import { useState } from "react"
import { cancelOrderAction, markBankTransferPaidAction } from "@/app/actions/admin-orders"
import { AdvanceOrderButton } from "@/components/admin/orders/advance-order-button"
import { ConfirmDialog } from "@/components/admin/modal/confirm-dialog"
import { FormField } from "@/components/admin/modal/form-field"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/** Khối hành động trang chi tiết. Điều kiện hiện nút chỉ để tiện; service kiểm lại mọi thao tác. */
export function OrderDetailActions({
  orderId,
  code,
  status,
  paymentMethod,
  paymentStatus,
}: {
  orderId: string
  code: string
  status: string
  paymentMethod: string
  paymentStatus: string
}) {
  const cancel = useAdminAction()
  const paid = useAdminAction()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [paidOpen, setPaidOpen] = useState(false)
  const [reason, setReason] = useState("")

  const canCancel = status === "PENDING" || status === "CONFIRMED"
  const canConfirmPaid = paymentMethod === "BANK_TRANSFER" && paymentStatus === "PENDING" && status !== "CANCELLED"
  const hasNext = status === "PENDING" || status === "CONFIRMED" || status === "SHIPPING"

  if (!canCancel && !canConfirmPaid && !hasNext) {
    return <p className="text-label text-muted-foreground">Đơn đã ở trạng thái cuối, không còn thao tác nào.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <AdvanceOrderButton orderId={orderId} code={code} status={status} size="md" />
        {canConfirmPaid && (
          <Button type="button" variant="outline" size="md" disabled={paid.pending} onClick={() => setPaidOpen(true)}>
            Xác nhận đã nhận chuyển khoản
          </Button>
        )}
        {canCancel && (
          <Button type="button" variant="destructive" size="md" disabled={cancel.pending} onClick={() => setCancelOpen(true)}>
            Hủy đơn
          </Button>
        )}
      </div>

      {canCancel && (
        <FormField label="Lý do hủy (tùy chọn)" hint="Lưu vào lịch sử đơn. Tối đa 200 ký tự." htmlFor="cancel-reason">
          <Textarea
            id="cancel-reason"
            value={reason}
            maxLength={200}
            placeholder="Ví dụ: khách yêu cầu hủy"
            onChange={(e) => setReason(e.target.value)}
          />
        </FormField>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Hủy đơn #${code}?`}
        description="Tồn kho sẽ được hoàn lại; đơn đã thanh toán sẽ chuyển sang trạng thái hoàn tiền. Thao tác này không thể hoàn tác."
        confirmLabel="Hủy đơn"
        pending={cancel.pending}
        onConfirm={() => cancel.run(() => cancelOrderAction(orderId, reason), { onSuccess: () => setCancelOpen(false) })}
      />
      <ConfirmDialog
        open={paidOpen}
        onOpenChange={setPaidOpen}
        title="Xác nhận đã nhận tiền?"
        description={`Xác nhận bạn đã nhận đủ tiền chuyển khoản cho đơn #${code}. Đơn sẽ được đánh dấu đã thanh toán.`}
        confirmLabel="Đã nhận tiền"
        pending={paid.pending}
        onConfirm={() => paid.run(() => markBankTransferPaidAction(orderId), { onSuccess: () => setPaidOpen(false) })}
      />
    </div>
  )
}
