"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { activeAdminNav } from "@/components/admin/admin-nav"

// Figma: breadcrumb "Bảng điều khiển / <trang>" (mục cuối đậm) rồi tiêu đề 28px bold, nằm phía trên sidebar.
export function AdminPageTitle() {
  const item = activeAdminNav(usePathname())

  return (
    <div className="space-y-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">
          Bảng điều khiển
        </Link>
        <span aria-hidden>/</span>
        <span className="font-bold text-foreground">{item.crumb}</span>
      </nav>
      <h1 className="text-3xl font-bold">{item.title}</h1>
    </div>
  )
}
