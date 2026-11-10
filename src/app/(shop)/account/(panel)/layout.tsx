import Link from "next/link"
import { AccountSidebar } from "@/components/account/account-sidebar"
import { requireUser } from "@/server/auth/session"
import { countOrders } from "@/server/services/order.service"

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account/profile")
  const orderCount = await countOrders(user.id)

  return (
    <div className="pb-16">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Trang chủ
        </Link>
        {" / "}
        <span className="font-bold text-foreground">Tài khoản khách hàng</span>
      </nav>
      <h1 className="mt-6 mb-10 text-3xl font-bold">Thông Tin Khách Hàng</h1>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:gap-10">
        <AccountSidebar user={user} orderCount={orderCount} />
        <div className="min-w-0 space-y-8">{children}</div>
      </div>
    </div>
  )
}
