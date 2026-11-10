"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { registerAction } from "@/app/actions/auth"
import { FormField, FormMessage } from "@/components/auth/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { registerSchema, type RegisterInput } from "@/lib/validators/auth"

export function RegisterForm({ next }: { next?: string }) {
  const [message, setMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerSchema>, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
  })

  async function onSubmit(values: RegisterInput) {
    setMessage(undefined)
    const res = await registerAction(values, next)
    if (!res || res.ok) return
    setMessage(res.message)
    for (const [field, msg] of Object.entries(res.fieldErrors ?? {})) {
      setError(field as keyof RegisterInput, { message: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormMessage>{message}</FormMessage>
      <FormField id="name" label="Họ và tên" required error={errors.name?.message}>
        {(a11y) => <Input {...a11y} autoComplete="name" placeholder="Nguyễn Văn A" {...register("name")} />}
      </FormField>
      <FormField id="email" label="Email" required error={errors.email?.message}>
        {(a11y) => (
          <Input {...a11y} type="email" autoComplete="email" placeholder="email@example.com" {...register("email")} />
        )}
      </FormField>
      <FormField id="phone" label="Số điện thoại" error={errors.phone?.message}>
        {(a11y) => <Input {...a11y} type="tel" autoComplete="tel" placeholder="0901234567" {...register("phone")} />}
      </FormField>
      <FormField
        id="password"
        label="Mật khẩu"
        required
        error={errors.password?.message}
        hint="Tối thiểu 8 ký tự, gồm chữ và số"
      >
        {(a11y) => <Input {...a11y} type="password" autoComplete="new-password" {...register("password")} />}
      </FormField>
      <FormField id="confirmPassword" label="Nhập lại mật khẩu" required error={errors.confirmPassword?.message}>
        {(a11y) => <Input {...a11y} type="password" autoComplete="new-password" {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" variant="dark" size="xl" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký"}
      </Button>
      <p className="text-center text-label text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-bold text-primary hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  )
}
