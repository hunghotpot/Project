"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { loginAction } from "@/app/actions/auth"
import { FormField, FormMessage } from "@/components/auth/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginSchema, type LoginInput } from "@/lib/validators/auth"

export function LoginForm({ next }: { next?: string }) {
  const [message, setMessage] = useState<string>()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginInput) {
    setMessage(undefined)
    // Thành công thì action redirect; chỉ nhận lại kết quả khi có lỗi.
    const res = await loginAction(values, next)
    if (!res || res.ok) return
    setMessage(res.message)
    for (const [field, msg] of Object.entries(res.fieldErrors ?? {})) {
      setError(field as keyof LoginInput, { message: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormMessage>{message}</FormMessage>
      <FormField id="email" label="Email" required error={errors.email?.message}>
        {(a11y) => (
          <Input {...a11y} type="email" autoComplete="email" placeholder="email@example.com" {...register("email")} />
        )}
      </FormField>
      <FormField id="password" label="Mật khẩu" required error={errors.password?.message}>
        {(a11y) => (
          <Input {...a11y} type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
        )}
      </FormField>
      <Button type="submit" variant="dark" size="xl" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
      <p className="text-center text-label text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="font-bold text-primary hover:underline"
        >
          Đăng ký
        </Link>
      </p>
    </form>
  )
}
