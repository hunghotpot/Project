"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { updateProfileAction } from "@/app/actions/account"
import { FormField, FormMessage } from "@/components/auth/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validators/auth"

export function ProfileForm({
  defaultValues,
  email,
  onSaved,
  onCancel,
}: {
  defaultValues: { name: string; phone: string | null }
  email: string
  onSaved?: () => void
  onCancel?: () => void
}) {
  const [message, setMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof updateProfileSchema>, unknown, UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: defaultValues.name, phone: defaultValues.phone ?? "" },
  })

  async function onSubmit(values: UpdateProfileInput) {
    setMessage(undefined)
    const res = await updateProfileAction(values)
    if (res.ok) {
      toast.success(res.message)
      return onSaved?.()
    }
    setMessage(res.message)
    for (const [field, msg] of Object.entries(res.fieldErrors ?? {})) {
      setError(field as keyof UpdateProfileInput, { message: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 md:grid-cols-2">
      {message && (
        <div className="md:col-span-2">
          <FormMessage>{message}</FormMessage>
        </div>
      )}
      <FormField id="profile-name" label="Họ và tên" required error={errors.name?.message}>
        {(a11y) => <Input {...a11y} variant="white" autoComplete="name" {...register("name")} />}
      </FormField>
      <FormField id="profile-phone" label="Số điện thoại" error={errors.phone?.message}>
        {(a11y) => <Input {...a11y} variant="white" type="tel" autoComplete="tel" placeholder="0901234567" {...register("phone")} />}
      </FormField>
      <div className="md:col-span-2">
        <FormField id="profile-email" label="Địa chỉ Email" hint="Email không thể thay đổi">
          {(a11y) => <Input {...a11y} variant="white" value={email} readOnly />}
        </FormField>
      </div>
      <div className="flex gap-3 md:col-span-2">
        <Button type="submit" variant="dark" size="md" disabled={isSubmitting}>
          {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={isSubmitting}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  )
}
