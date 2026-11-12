import type { Metadata } from "next"
import { AddProductButton, EditProductModal, type ProductFormOptions } from "@/components/admin/products/product-form-modal"
import { CategoryFilter } from "@/components/admin/products/category-filter"
import { formFromProduct } from "@/components/admin/products/product-form-state"
import { ProductTable } from "@/components/admin/products/product-table"
import { StatCard, StatGrid } from "@/components/admin/dashboard/stat-card"
import { AdminPagination } from "@/components/admin/list/admin-pagination"
import { ListCard, ListSection } from "@/components/admin/list/admin-table"
import { ListToolbar } from "@/components/admin/list/list-toolbar"
import type { RawSearchParams } from "@/lib/admin-list"
import { formatVnd, GENDER_LABEL, STYLE_LABEL } from "@/lib/format"
import { STOCK_STATUS_LABEL } from "@/lib/inventory"
import { SITE_NAME } from "@/lib/site"
import { ADMIN_GENDERS, ADMIN_OCCASIONS, ADMIN_SEASONS, ADMIN_STYLES, MAX_PRODUCT_IMAGES } from "@/lib/validators/admin-catalog"
import { listCategoriesTree } from "@/server/services/admin-category.service"
import { getAdminProduct, getInventorySummary, listAdminProducts } from "@/server/services/admin-product.service"

export const metadata: Metadata = { title: "Tồn kho & Sản phẩm" }

const STOCK_FILTERS = (["IN_STOCK", "LOW", "OUT"] as const).map((value) => ({ value, label: STOCK_STATUS_LABEL[value] }))

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams
  const editId = one(sp.edit)

  const [summary, list, tree, editing] = await Promise.all([
    getInventorySummary(),
    listAdminProducts(sp),
    listCategoriesTree(),
    // Id sai/không tồn tại thì bỏ qua (không mở modal) thay vì làm hỏng cả trang.
    editId ? getAdminProduct(editId).catch(() => null) : Promise.resolve(null),
  ])

  const options: ProductFormOptions = {
    categories: tree.map((c) => ({ id: c.id, name: c.name, children: c.children.map((x) => ({ id: x.id, name: x.name })) })),
    occasions: [...ADMIN_OCCASIONS],
    seasons: [...ADMIN_SEASONS],
    genders: ADMIN_GENDERS.map((value) => ({ value, label: GENDER_LABEL[value] })),
    styles: ADMIN_STYLES.map((value) => ({ value, label: STYLE_LABEL[value] ?? value })),
    maxImages: MAX_PRODUCT_IMAGES,
    defaultBrand: SITE_NAME,
  }
  const filterCategories = tree.flatMap((c) => [{ id: c.id, name: c.name, depth: 0 as const }, ...c.children.map((x) => ({ id: x.id, name: x.name, depth: 1 as const }))])

  return (
    <>
      <StatGrid>
        <StatCard label="Tổng lượng tồn kho" value={summary.totalStock.toLocaleString("vi-VN")} unit="cái" chip={`${summary.productCount} sản phẩm`} chipTone="info" />
        <StatCard label="Ước tính giá trị kho" value={formatVnd(summary.inventoryValue)} chip="Giá bán × tồn" chipTone="success" accent />
        <StatCard
          label="Cảnh báo sắp hết"
          value={summary.lowStockVariants.toLocaleString("vi-VN")}
          unit="biến thể (màu × size)"
          chip={summary.lowStockVariants > 0 ? "Cần nhập" : "Ổn định"}
          chipTitle={`${summary.lowStockProducts} sản phẩm có tổng tồn sắp hết`}
          chipTone={summary.lowStockVariants > 0 ? "warning" : "info"}
        />
        <StatCard
          label="Hết hàng"
          value={summary.outOfStockVariants.toLocaleString("vi-VN")}
          unit="biến thể (màu × size)"
          chip={summary.outOfStockVariants > 0 ? "Hết" : "Ổn định"}
          chipTitle={`${summary.outOfStockProducts} sản phẩm hết hàng hoàn toàn`}
          chipTone={summary.outOfStockVariants > 0 ? "brand" : "info"}
        />
      </StatGrid>

      <ListSection title="Kho Hàng Sản Phẩm">
        <ListToolbar placeholder="Tìm theo mã SKU, tên sản phẩm..." filters={STOCK_FILTERS} filterParam="stockStatus">
          <CategoryFilter categories={filterCategories} />
          <AddProductButton options={options} />
        </ListToolbar>

        <ListCard>
          <ProductTable items={list.items} searchParams={sp} />
          <AdminPagination page={list.page} pageSize={list.pageSize} total={list.total} noun="mặt hàng" basePath="/admin/products" searchParams={sp} />
        </ListCard>
      </ListSection>

      {editing && <EditProductModal key={editing.id} productId={editing.id} initial={formFromProduct(editing)} options={options} />}
    </>
  )
}
