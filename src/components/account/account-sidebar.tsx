import { LogOutIcon, UserIcon } from "lucide-react"
import { logoutAction } from "@/app/actions/auth"
import { AccountNav } from "@/components/account/account-nav"
import { Badge } from "@/components/ui/badge"
import type { PublicUser } from "@/server/services/auth.service"

const ROLE_LABEL = { CUSTOMER: "THÀNH VIÊN", ADMIN: "QUẢN TRỊ VIÊN" } as const

// Figma: card bo lớn — avatar tròn ink, tên, email, nhãn, menu, nút Đăng xuất nền hồng nhạt.
export function AccountSidebar({ user, orderCount }: { user: PublicUser; orderCount: number }) {
  return (
    <aside className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-8 lg:self-start">
      <div className="flex flex-col items-center gap-3 border-b border-border pb-6 text-center">
        <div className="grid size-28 place-items-center rounded-full bg-ink text-white">
          <UserIcon className="size-14" aria-hidden />
        </div>
        <p className="mt-2 text-lg font-bold">{user.name}</p>
        <p className="text-xs break-all text-muted-foreground">{user.email}</p>
        <Badge variant="dark" className="h-8 px-5">
          {ROLE_LABEL[user.role]}
        </Badge>
      </div>

      <AccountNav orderCount={orderCount} />

      <form action={logoutAction} className="border-t border-border pt-6">
        <button
          type="submit"
          className="flex h-[52px] w-full items-center gap-4 rounded-xl bg-brand-soft px-5 text-sm font-bold text-destructive transition-colors outline-none hover:bg-destructive/15 focus-visible:ring-3 focus-visible:ring-destructive/20"
        >
          <LogOutIcon className="size-5" /> Đăng xuất
        </button>
      </form>
    </aside>
  )
}
