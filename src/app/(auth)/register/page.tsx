import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import { safeNextPath } from "@/lib/validators/auth"
import { getCurrentUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Đăng ký" }

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNextPath((await searchParams).next)
  if (await getCurrentUser()) redirect(next)

  return (
    <>
      <h1 className="text-3xl font-bold">Tạo tài khoản</h1>
      <p className="mt-2 mb-8 text-label text-muted-foreground">Đăng ký để mua sắm và theo dõi đơn hàng.</p>
      <RegisterForm next={next === "/" ? undefined : next} />
    </>
  )
}
