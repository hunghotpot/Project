import type { Metadata } from "next"
import { AccountDetailsCard } from "@/components/account/account-details-card"
import { PasswordForm } from "@/components/account/password-form"
import { RecentOrders } from "@/components/account/recent-orders"
import { requireUser } from "@/server/auth/session"
import { listAddresses } from "@/server/services/address.service"
import { listRecentOrders } from "@/server/services/order.service"

export const metadata: Metadata = { title: "Thông tin tài khoản" }

export default async function ProfilePage() {
  const user = await requireUser("/account/profile")
  const [addresses, orders] = await Promise.all([listAddresses(user.id), listRecentOrders(user.id, 5)])
  // listAddresses xếp địa chỉ mặc định lên đầu.
  const def = addresses.find((a) => a.isDefault)

  return (
    <>
      <AccountDetailsCard
        key={`${user.name}|${user.phone}`}
        name={user.name}
        email={user.email}
        phone={user.phone}
        defaultAddress={def ? [def.street, def.ward, def.district, def.province].join(", ") : null}
      />
      <RecentOrders orders={orders} />
      <section aria-labelledby="change-password" className="rounded-3xl border border-border bg-card p-8">
        <h2 id="change-password" className="text-xl font-bold">
          Đổi mật khẩu
        </h2>
        <p className="mt-1 mb-6 text-label text-muted-foreground">Sau khi đổi, các thiết bị khác sẽ bị đăng xuất.</p>
        <PasswordForm />
      </section>
    </>
  )
}
