"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { AdminActionResult } from "@/lib/admin-action"
import {
  adminIdSchema,
  deleteSizeChartRowsSchema,
  replaceSizeChartSchema,
  sizeChartBrandSchema,
  type SizeChartRowInput,
} from "@/lib/validators/admin-catalog"
import { getAdminUser, NOT_ADMIN_MESSAGE } from "@/server/auth/admin"
import { AdminCatalogError } from "@/server/services/admin-catalog.service"
import { deleteSizeChartRows, replaceSizeChart } from "@/server/services/admin-size-chart.service"

/** Lỗi theo từng ô: path = [chỉ số dòng, tên trường], ví dụ [2, "heightMax"]. */
export interface SizeChartIssue {
  path: (string | number)[]
  message: string
}
export type SizeChartActionResult = AdminActionResult & { issues?: SizeChartIssue[] }

const replaceInputSchema = z.object({
  categoryId: adminIdSchema,
  brand: sizeChartBrandSchema,
  rows: replaceSizeChartSchema,
})

const deleteInputSchema = z.object({ categoryId: adminIdSchema, rowIds: deleteSizeChartRowsSchema })

const done = (message: string): SizeChartActionResult => {
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}

/** Thay toàn bộ bảng (danh mục, thương hiệu). `brand` rỗng/null = bảng chung. */
export async function replaceSizeChartAction(input: unknown): Promise<SizeChartActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const parsed = replaceInputSchema.safeParse(input)
  if (!parsed.success) {
    // Bỏ đoạn "rows" đầu path để khớp với issues của service.
    const issues = parsed.error.issues
      .filter((i) => i.path[0] === "rows")
      .map((i) => ({ path: i.path.slice(1).filter((p): p is string | number => typeof p !== "symbol"), message: i.message }))
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ", issues }
  }

  const raw = input as { rows: SizeChartRowInput[] }
  try {
    await replaceSizeChart({ userId: admin.id }, parsed.data.categoryId, raw.rows, parsed.data.brand)
  } catch (e) {
    if (e instanceof AdminCatalogError) return { ok: false, message: e.message, issues: e.issues }
    throw e
  }
  return done("Đã lưu bảng size")
}

/** Xóa các dòng bảng size theo id (dùng cho nút "Xóa bảng"). */
export async function deleteSizeChartRowsAction(input: unknown): Promise<SizeChartActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const parsed = deleteInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  try {
    await deleteSizeChartRows({ userId: admin.id }, parsed.data.categoryId, parsed.data.rowIds)
  } catch (e) {
    if (e instanceof AdminCatalogError) return { ok: false, message: e.message }
    throw e
  }
  return done("Đã xóa bảng size")
}
