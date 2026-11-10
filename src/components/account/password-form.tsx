"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { changePasswordAction } from "@/app/actions/account"
import { FormField, FormMessage } from "@/components/auth/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validators/auth"

export function PasswordForm() {
  const [message, setMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof changePasswordSchema>, unknown, ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onSubmit(values: ChangePasswordInput) {
    setMessage(undefined)
    const res = await changePasswordAction(values)
    if (res.ok) {
      reset()
      return void toast.success(res.message)
    }
    setMessage(res.message)
    for (const [field, msg] of Object.entries(res.fieldErrors ?? {})) {
      setError(field as keyof ChangePasswordInput, { message: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-xl flex-col gap-5">
      <FormMessage>{message}</FormMessage>
      <FormField id="current-password" label="Mật khẩu hiện tại" required error={errors.currentPassword?.message}>
        {(a11y) => <Input {...a11y} type="password" autoComplete="current-password" {...register("currentPassword")} />}
      </FormField>
      <FormField
        id="new-password"
        label="Mật khẩu mới"
        required
        error={errors.newPassword?.message}
        hint="Tối thiểu 8 ký tự, gồm chữ và số"
      >
        {(a11y) => <Input {...a11y} type="password" autoComplete="new-password" {...register("newPassword")} />}
      </FormField>
      <FormField id="confirm-new-password" label="Nhập lại mật khẩu mới" required error={errors.confirmPassword?.message}>
        {(a11y) => <Input {...a11y} type="password" autoComplete="new-password" {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" variant="dark" size="md" disabled={isSubmitting} className="self-start">
        {isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
      </Button>
    </form>
  )
}
