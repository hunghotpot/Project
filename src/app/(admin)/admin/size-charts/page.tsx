import type { Metadata } from "next"
import { StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { AdminEmpty, ListCard } from "@/components/admin/list/admin-table"
import { CategoryPicker } from "@/components/admin/size-charts/category-picker"
import { SizeChartSection } from "@/components/admin/size-charts/size-chart-section"
import { listCategoriesTree } from "@/server/services/admin-category.service"
import { listSizeChart } from "@/server/services/admin-size-chart.service"

export const metadata: Metadata = { title: "Bảng size" }

export default async function AdminSizeChartsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { categoryId: rawId } = await searchParams
  const tree = await listCategoriesTree()

  // Danh mục lá = không có danh mục con; hiện "Gốc / Con" để phân biệt tên trùng.
  const leaves = tree.flatMap((r) =>
    r.children.length === 0
      ? [{ id: r.id, name: r.name, label: r.name, rows: r.sizeChartRowCount }]
      : r.children.map((c) => ({ id: c.id, name: `${r.name} / ${c.name}`, label: `${r.name} / ${c.name}`, rows: c.sizeChartRowCount }))
  )
  const requested = Array.isArray(rawId) ? rawId[0] : rawId
  const current = leaves.find((l) => l.id === requested) ?? leaves[0]

  const rows = current ? await listSizeChart(current.id) : []
  const brandCount = new Set(rows.filter((r) => r.brand).map((r) => r.brand)).size

  return (
    <>
      <StatGrid>
        <StatCard label="Danh mục lá" value={String(leaves.length)} unit="danh mục" />
        <StatCard label="Đã có bảng size" value={String(leaves.filter((l) => l.rows > 0).length)} unit="danh mục" chip="Toàn hệ thống" chipTone="info" />
        <StatCard label="Dòng của danh mục này" value={String(rows.length)} unit="dòng" accent />
        <StatCard label="Bảng theo thương hiệu" value={String(brandCount)} unit="bảng riêng" chipTitle="Trong danh mục đang chọn" />
      </StatGrid>

      {current ? (
        <>
          <CategoryPicker options={leaves.map((l) => ({ id: l.id, label: l.label, hasChart: l.rows > 0 }))} value={current.id} />
          <SizeChartSection key={current.id} categoryId={current.id} categoryName={current.name} rows={rows} />
        </>
      ) : (
        <ListCard>
          <AdminEmpty title="Chưa có danh mục nào." hint="Hãy tạo danh mục ở mục Danh mục trước." />
        </ListCard>
      )}
    </>
  )
}
