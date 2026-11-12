import "server-only"
import {
  adminIdSchema,
  deleteSizeChartRowsSchema,
  replaceSizeChartSchema,
  sizeChartBrandSchema,
  type AdminContext,
  type SizeChartRowInput,
} from "@/lib/validators/admin-catalog"
import { sizeRank } from "@/lib/product-variants"
import { db } from "@/server/db"
import { AdminCatalogError, parseAdmin, parseInput } from "./admin-catalog.service"

/*
 * Admin: Bảng size (số đo tham chiếu cm/kg dùng cho tư vấn size).
 * Mỗi bảng xác định bởi (danh mục, thương hiệu); brand = null là bảng chung. Việc chọn bảng cho sản phẩm
 * (bảng riêng của brand thắng bảng chung) nằm ở catalog.service/getSizeChart, không đổi ở đây.
 */

export interface AdminSizeChartRow {
  id: string
  categoryId: string
  brand: string | null
  size: string
  chest: number | null
  waist: number
  hip: number
  heightMin: number
  heightMax: number
  weightMin: number
  weightMax: number
}

const rowSelect = {
  id: true,
  categoryId: true,
  brand: true,
  size: true,
  chest: true,
  waist: true,
  hip: true,
  heightMin: true,
  heightMax: true,
  weightMin: true,
  weightMax: true,
} as const

/** Bảng chung đứng đầu, rồi theo tên brand; trong mỗi bảng sắp theo size (S<M<L…, số tăng dần). */
const sortRows = (rows: AdminSizeChartRow[]) =>
  [...rows].sort(
    (a, b) =>
      Number(a.brand !== null) - Number(b.brand !== null) ||
      (a.brand ?? "").localeCompare(b.brand ?? "", "vi") ||
      sizeRank(a.size) - sizeRank(b.size) ||
      a.size.localeCompare(b.size)
  )

/** Mọi dòng bảng size của danh mục (bảng chung và các bảng riêng của brand). */
export async function listSizeChart(categoryId: string): Promise<AdminSizeChartRow[]> {
  const cid = parseInput(adminIdSchema, categoryId)
  return sortRows(await db.sizeChart.findMany({ where: { categoryId: cid }, select: rowSelect }))
}

/**
 * Thay TOÀN BỘ bảng (danh mục, brand) bằng `rows` trong một transaction; các bảng brand khác không bị đụng tới.
 * brand bỏ trống/null = bảng chung. Số đo được kiểm: min ≤ max, khoảng hợp lý, size không trùng.
 */
export async function replaceSizeChart(
  admin: AdminContext,
  categoryId: string,
  rows: SizeChartRowInput[],
  brand?: string | null
): Promise<AdminSizeChartRow[]> {
  parseAdmin(admin)
  const cid = parseInput(adminIdSchema, categoryId)
  const data = parseInput(replaceSizeChartSchema, rows)
  const b = parseInput(sizeChartBrandSchema, brand)

  return db.$transaction(async (tx) => {
    if (!(await tx.category.findUnique({ where: { id: cid }, select: { id: true } })))
      throw new AdminCatalogError("CATEGORY_NOT_FOUND", "Danh mục không tồn tại")
    await tx.sizeChart.deleteMany({ where: { categoryId: cid, brand: b } })
    await tx.sizeChart.createMany({ data: data.map((r) => ({ ...r, categoryId: cid, brand: b })) })
    return sortRows(await tx.sizeChart.findMany({ where: { categoryId: cid, brand: b }, select: rowSelect }))
  })
}

/** Xoá một số dòng theo id (phải thuộc danh mục này); có id không tồn tại thì không xoá gì. Trả số dòng đã xoá. */
export async function deleteSizeChartRows(admin: AdminContext, categoryId: string, rowIds: string[]): Promise<number> {
  parseAdmin(admin)
  const cid = parseInput(adminIdSchema, categoryId)
  const ids = [...new Set(parseInput(deleteSizeChartRowsSchema, rowIds))]
  return db.$transaction(async (tx) => {
    const r = await tx.sizeChart.deleteMany({ where: { categoryId: cid, id: { in: ids } } })
    if (r.count !== ids.length) throw new AdminCatalogError("SIZE_CHART_ROW_NOT_FOUND", "Có dòng bảng size không tồn tại hoặc không thuộc danh mục này")
    return r.count
  })
}
