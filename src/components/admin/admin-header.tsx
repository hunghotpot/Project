import Link from "next/link"
import { BellIcon, SearchIcon } from "lucide-react"
import { Logo } from "@/components/layout/logo"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "").slice(0, 2)
  return letters.toUpperCase() || "AD"
}

// Figma: logo ink + nhãn ADMIN (pill brand) bên trái; ô tìm kiếm pill, chuông có chấm đỏ, avatar tròn ink + tên bên phải.
// Ô tìm kiếm chuyển sang danh sách đơn (?q=); chuông trỏ tới các đơn chờ xác nhận và chỉ có chấm khi thật sự có đơn chờ.
export function AdminHeader({ user, pendingOrders }: { user: { name: string }; pendingOrders: number }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-4">
      <Logo href="/admin" />
      <span className="inline-flex h-8 items-center rounded-full bg-brand px-4 text-caption font-bold text-white uppercase">Admin</span>

      <div className="ml-auto flex items-center gap-3">
        <form action="/admin/orders" role="search" className="relative hidden md:block">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
          <input
            name="q"
            type="search"
            placeholder="Tìm kiếm đơn, khách hàng..."
            aria-label="Tìm kiếm đơn hàng"
            className="h-10 w-72 rounded-full border-0 bg-secondary pr-4 pl-10 text-label outline-none placeholder:text-subtle-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </form>

        <Link
          href="/admin/orders?status=PENDING"
          aria-label={pendingOrders > 0 ? `${pendingOrders} đơn chờ xác nhận` : "Không có đơn chờ xác nhận"}
          className="relative grid size-10 place-items-center rounded-full bg-secondary text-sidebar-foreground outline-none hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <BellIcon className="size-5" aria-hidden />
          {pendingOrders > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-brand ring-2 ring-secondary" aria-hidden />}
        </Link>

        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-ink text-caption font-bold text-white" aria-hidden>
            {initials(user.name)}
          </span>
          <span className="hidden text-label font-bold sm:block">{user.name}</span>
        </div>
      </div>
    </header>
  )
}
