import type { Metadata } from "next"
import { StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { AdminPagination } from "@/components/admin/list/admin-pagination"
import { ListCard, ListSection } from "@/components/admin/list/admin-table"
import { ListToolbar } from "@/components/admin/list/list-toolbar"
import { DemoBanner } from "@/components/admin/placeholder/demo-banner"
import { CreateVoucherModal } from "@/components/admin/vouchers/create-voucher-modal"
import { DEMO_VOUCHERS, filterDemoVouchers, VOUCHER_FILTERS } from "@/components/admin/vouchers/voucher-demo-data"
import { VoucherTable } from "@/components/admin/vouchers/voucher-table"
import type { RawSearchParams } from "@/lib/admin-list"

export const metadata: Metadata = { title: "Voucher & Khuyến mãi" }

const PAGE_SIZE = 5

function first(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? ""
}

/* Màn tĩnh: số liệu và bảng là hằng số minh hoạ; ?q= và ?status= lọc ngay trên dữ liệu minh hoạ (phía server). */
export default async function AdminVouchersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams
  const filtered = filterDemoVouchers(first(raw.q), first(raw.status))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(Math.max(1, Number.parseInt(first(raw.page), 10) || 1), pageCount)
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeCount = DEMO_VOUCHERS.filter((v) => v.status === "ACTIVE").length
  const usedTotal = DEMO_VOUCHERS.reduce((sum, v) => sum + v.used, 0)

  return (
    <>
      <DemoBanner />
      <StatGrid>
        <StatCard label="Voucher đang chạy" value={String(activeCount)} unit="mã hoạt động" chip="Minh hoạ" chipTone="success" />
        <StatCard label="Lượt đã áp dụng" value={usedTotal.toLocaleString("vi-VN")} unit="lượt" chip="Minh hoạ" chipTone="info" />
        <StatCard label="Tổng tiền đã giảm" value="68.500.000 ₫" chip="Minh hoạ" chipTone="brand" accent />
        <StatCard label="Doanh số từ voucher" value="412.000.000 ₫" chip="Minh hoạ" chipTone="success" />
      </StatGrid>

      <ListSection title="Danh Sách Mã Ưu Đãi">
        <ListToolbar placeholder="Tìm mã voucher, tên chương trình..." filters={VOUCHER_FILTERS}>
          <CreateVoucherModal />
        </ListToolbar>
        <ListCard>
          <VoucherTable vouchers={rows} />
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} noun="mã khuyến mãi" basePath="/admin/vouchers" searchParams={raw} />
        </ListCard>
      </ListSection>
    </>
  )
}
