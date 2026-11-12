import type { Metadata } from "next"
import { AddCustomerDialog } from "@/components/admin/customers/add-customer-dialog"
import { CustomerTable } from "@/components/admin/customers/customer-table"
import { StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { AdminPagination } from "@/components/admin/list/admin-pagination"
import { ListCard, ListSection } from "@/components/admin/list/admin-table"
import { ListToolbar } from "@/components/admin/list/list-toolbar"
import type { RawSearchParams } from "@/lib/admin-list"
import { VIP_SPEND_THRESHOLD } from "@/lib/customer-tier"
import { formatVnd } from "@/lib/format"
import { requireAdmin } from "@/server/auth/session"
import { getCustomerSummary, listCustomers } from "@/server/services/admin-customer.service"

export const metadata: Metadata = { title: "Khách hàng" }

const FILTERS = [
  { value: "vip", label: "VIP" },
  { value: "member", label: "Thành viên" },
  { value: "locked", label: "Bị khóa" },
]

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireAdmin("/admin/customers")
  const sp = await searchParams
  const [summary, list] = await Promise.all([getCustomerSummary(), listCustomers(sp)])

  return (
    <>
      <StatGrid>
        <StatCard label="Tổng số khách hàng" value={summary.totalCustomers.toLocaleString("vi-VN")} unit="khách" chip="Tất cả" chipTone="info" />
        <StatCard label="Khách hàng mới trong tháng" value={summary.newThisMonth.toLocaleString("vi-VN")} unit="khách" chip="Tháng này" chipTone="success" />
        <StatCard label="Thành viên VIP" value={summary.vipCount.toLocaleString("vi-VN")} unit="VIP" chip={`Từ ${formatVnd(VIP_SPEND_THRESHOLD)}`} chipTone="brand" accent />
        <StatCard
          label="Tỉ lệ mua lại"
          value={`${summary.repurchaseRate.toLocaleString("vi-VN")}%`}
          chip="≥ 2 đơn"
          chipTitle="Số khách có từ 2 đơn (không huỷ) trên số khách đã mua"
          chipTone="success"
        />
      </StatGrid>

      <ListSection title="Danh Sách Khách Hàng">
        <ListToolbar placeholder="Tìm theo tên, email, số điện thoại..." filters={FILTERS} filterParam="filter">
          <AddCustomerDialog />
        </ListToolbar>
        <ListCard>
          <CustomerTable items={list.items} />
          <AdminPagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            noun="khách hàng"
            basePath="/admin/customers"
            searchParams={sp}
          />
        </ListCard>
      </ListSection>
    </>
  )
}
