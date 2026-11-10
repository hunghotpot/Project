import { Logo } from "@/components/layout/logo"

// Giữ nguyên trạng thái tuỳ theo cookie nên luôn render theo request.
export const dynamic = "force-dynamic"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <div className="w-full max-w-md rounded-4xl border border-border bg-card p-6 sm:p-10">{children}</div>
    </div>
  )
}
