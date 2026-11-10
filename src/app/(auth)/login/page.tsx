import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { safeNextPath } from "@/lib/validators/auth"
import { getCurrentUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Đăng nhập" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const next = safeNextPath((await searchParams).next)
  if (await getCurrentUser()) redirect(next)

  return (
    <>
      <h1 className="text-3xl font-bold">Đăng nhập</h1>
      <p className="mt-2 mb-8 text-label text-muted-foreground">Chào mừng bạn quay lại.</p>
      <LoginForm next={next === "/" ? undefined : next} />
    </>
  )
}
