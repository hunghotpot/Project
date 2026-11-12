import Link from "next/link"
import { AdminEmpty, AdminTable, AdminTr } from "@/components/admin/list/admin-table"
import { StatusPill } from "@/components/admin/status-pill"
import { CustomerAvatar } from "@/components/admin/customers/customer-avatar"
import { CustomerLockButton } from "@/components/admin/customers/customer-lock-button"
import { CUSTOMER_TIER_LABEL } from "@/lib/customer-tier"
import { formatVnd } from "@/lib/format"
import type { CustomerListItem } from "@/server/services/admin-customer.service"

const COLUMNS = [
  { label: "Khách hàng" },
  { label: "Số điện thoại" },
  { label: "Hạng" },
  { label: "Đơn hàng" },
  { label: "Tổng chi tiêu" },
  { label: "Trạng thái" },
  { label: "Thao tác", className: "text-right" },
]

export function CustomerTable({ items }: { items: CustomerListItem[] }) {
  if (items.length === 0) {
    return <AdminEmpty title="Không tìm thấy khách hàng nào." hint="Thử đổi từ khóa hoặc bộ lọc." />
  }
  return (
    <AdminTable columns={COLUMNS} minWidth={860} caption="Danh sách khách hàng">
      {items.map((c) => {
        const locked = c.status === "LOCKED"
        return (
          <AdminTr key={c.id}>
            <td>
              <div className="flex items-center gap-3">
                <CustomerAvatar initial={c.initial} tier={c.tier} locked={locked} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                </div>
              </div>
            </td>
            <td className="whitespace-nowrap">{c.phone ?? "—"}</td>
            <td>
              <StatusPill tone={c.tier === "VIP" ? "dark" : "neutral"}>{CUSTOMER_TIER_LABEL[c.tier]}</StatusPill>
            </td>
            <td className="whitespace-nowrap">{c.orderCount} đơn</td>
            <td className={`font-bold whitespace-nowrap ${c.tier === "VIP" ? "text-brand" : ""}`}>{formatVnd(c.totalSpend)}</td>
            <td>
              <StatusPill tone={locked ? "danger" : "success"}>{locked ? "Đã khóa" : "Hoạt động"}</StatusPill>
            </td>
            <td>
              <div className="flex items-center justify-end gap-4">
                <Link
                  href={`/admin/customers/${c.id}`}
                  aria-label={`Xem khách hàng ${c.name}`}
                  className="rounded text-label font-bold hover:underline"
                >
                  Xem
                </Link>
                <CustomerLockButton customerId={c.id} name={c.name} locked={locked} />
              </div>
            </td>
          </AdminTr>
        )
      })}
    </AdminTable>
  )
}
