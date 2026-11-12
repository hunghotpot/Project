"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { createCustomerAction } from "@/app/actions/admin-customers"
import { AdminModal, ModalActions } from "@/components/admin/modal/admin-modal"
import { FormField } from "@/components/admin/modal/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const FORM_ID = "add-customer-form"

/** Nút "+ Thêm khách hàng" và modal tạo tài khoản. Mật khẩu tạm chỉ nằm trong state của form, không đưa vào toast/log. */
export function AddCustomerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function onOpenChange(next: boolean) {
    if (pending) return
    setOpen(next)
    if (!next) setErrors({})
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const input = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      password: String(fd.get("password") ?? ""),
    }
    startTransition(async () => {
      const res = await createCustomerAction(input)
      if (res.ok) {
        toast.success(res.message)
        form.reset()
        setErrors({})
        setOpen(false)
        router.refresh()
      } else {
        setErrors(res.fieldErrors ?? {})
        if (!res.fieldErrors || Object.keys(res.fieldErrors).length === 0) toast.error(res.message)
      }
    })
  }

  const bad = (k: string) => (errors[k] ? true : undefined)

  return (
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden /> Thêm khách hàng
      </Button>

      <AdminModal
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        title="Thêm Khách Hàng Mới"
        description="Nhập thông tin hồ sơ và khởi tạo tài khoản cho khách hàng"
        footer={<ModalActions submitLabel="Xác Nhận Thêm" pending={pending} formId={FORM_ID} onCancel={() => onOpenChange(false)} />}
      >
        <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
          <FormField label="Tên khách hàng" htmlFor="customer-name" required error={errors.name}>
            <Input id="customer-name" name="name" autoComplete="off" placeholder="Nguyễn Văn A" aria-invalid={bad("name")} />
          </FormField>
          <FormField label="Email" htmlFor="customer-email" required error={errors.email}>
            <Input id="customer-email" name="email" type="email" autoComplete="off" placeholder="khachhang@example.com" aria-invalid={bad("email")} />
          </FormField>
          <FormField label="Số điện thoại" htmlFor="customer-phone" error={errors.phone}>
            <Input id="customer-phone" name="phone" type="tel" autoComplete="off" placeholder="0987654321" aria-invalid={bad("phone")} />
          </FormField>
          <FormField
            label="Mật khẩu tạm"
            htmlFor="customer-password"
            required
            hint="Ít nhất 8 ký tự, gồm chữ và số. Hãy gửi mật khẩu này cho khách qua kênh riêng."
            error={errors.password}
          >
            <Input id="customer-password" name="password" type="password" autoComplete="new-password" aria-invalid={bad("password")} />
          </FormField>

          <p className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-xs font-bold">
            <span className="size-3 shrink-0 rounded-full bg-success" aria-hidden />
            <span>
              Trạng thái mặc định: <span className="text-success">Hoạt động</span> (có thể đổi sang Khóa sau)
            </span>
          </p>
        </form>
      </AdminModal>
    </>
  )
}
