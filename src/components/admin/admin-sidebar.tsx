"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowUpRightIcon, LogOutIcon } from "lucide-react"
import { cn } from "cn"
import { logoutAction } from "@/app/actions/auth"
import { activeAdminNav, ADMIN_NAV } from "@/components/admin/admin-nav"

// Figma: card bo lớn, nhãn nhóm, mục đang mở nền ink chữ trắng, nút "Xem Store" nền xám nhạt, "Đăng xuất" nền hồng nhạt.
export function AdminSidebar({ pendingOrders }: { pendingOrders: number }) {
  const active = activeAdminNav(usePathname())

  return (
    <aside className="hidden flex-col gap-6 rounded-3xl border border-border bg-card p-5 lg:flex lg:self-start">
      <nav aria-label="Danh mục quản trị" className="flex flex-col gap-1.5">
        <p className="px-3 pb-2 text-caption font-bold tracking-wide text-subtle-foreground uppercase">Danh mục quản trị</p>
        {ADMIN_NAV.map((item) => {
          const isActive = item.href === active.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-3 text-label font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                isActive ? "bg-ink text-white" : "text-sidebar-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="size-5 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.href === "/admin/orders" && pendingOrders > 0 && (
                <span
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-caption font-bold",
                    isActive ? "bg-brand text-white" : "bg-secondary text-sidebar-foreground"
                  )}
                  aria-label={`${pendingOrders} đơn chờ xác nhận`}
                >
                  {pendingOrders > 99 ? "99+" : pendingOrders}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <Link
          href="/"
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-secondary text-label font-bold transition-colors outline-none hover:bg-border focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Xem Store <ArrowUpRightIcon className="size-3.5" aria-hidden />
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-soft text-label font-bold text-destructive transition-colors outline-none hover:bg-destructive/15 focus-visible:ring-3 focus-visible:ring-destructive/20"
          >
            <LogOutIcon className="size-4" aria-hidden /> Đăng xuất
          </button>
        </form>
      </div>
    </aside>
  )
}

/** Điều hướng gọn cho màn hẹp (Figma chỉ có bản desktop): hàng chip cuộn ngang. */
export function AdminMobileNav({ pendingOrders }: { pendingOrders: number }) {
  const active = activeAdminNav(usePathname())

  return (
    <nav aria-label="Danh mục quản trị" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {ADMIN_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active.href ? "page" : undefined}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-label font-bold",
            item.href === active.href ? "bg-ink text-white" : "bg-secondary text-sidebar-foreground"
          )}
        >
          {item.label}
          {item.href === "/admin/orders" && pendingOrders > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-caption text-white">{pendingOrders}</span>
          )}
        </Link>
      ))}
      <Link href="/" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-secondary px-4 text-label font-bold">
        Xem Store <ArrowUpRightIcon className="size-3.5" aria-hidden />
      </Link>
    </nav>
  )
}
