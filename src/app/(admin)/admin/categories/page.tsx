import type { Metadata } from "next"
import { CategoryManager } from "@/components/admin/categories/category-manager"
import { StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { listCategoriesTree } from "@/server/services/admin-category.service"

export const metadata: Metadata = { title: "Danh mục" }

export default async function AdminCategoriesPage() {
  const tree = await listCategoriesTree()
  const all = tree.flatMap((r) => [r, ...r.children])
  const childCount = tree.reduce((n, r) => n + r.children.length, 0)
  const leafCount = all.filter((c) => c.children.length === 0).length
  const productTotal = all.reduce((n, c) => n + c.productCount, 0)

  return (
    <>
      <StatGrid>
        <StatCard label="Tổng danh mục" value={String(all.length)} unit="danh mục" />
        <StatCard label="Danh mục gốc" value={String(tree.length)} unit="nhóm" chip={`${childCount} con`} chipTone="info" />
        <StatCard label="Danh mục lá" value={String(leafCount)} unit="loại đồ" chipTitle="Danh mục không có danh mục con" />
        <StatCard label="Tổng sản phẩm" value={productTotal.toLocaleString("vi-VN")} unit="sản phẩm" accent />
      </StatGrid>

      <CategoryManager tree={tree} />
    </>
  )
}
