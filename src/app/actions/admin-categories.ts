"use server"

import { revalidatePath } from "next/cache"
import type { AdminActionResult } from "@/lib/admin-action"
import { adminIdSchema, createCategorySchema, updateCategorySchema } from "@/lib/validators/admin-catalog"
import { getAdminUser, NOT_ADMIN_MESSAGE } from "@/server/auth/admin"
import { AdminCatalogError } from "@/server/services/admin-catalog.service"
import { createCategory, deleteCategory, updateCategory } from "@/server/services/admin-category.service"

// Danh mục đổi thì bộ lọc/sản phẩm/bảng size cũng đổi theo: làm mới cả khu Admin.
const done = (message: string): AdminActionResult => {
  revalidatePath("/admin", "layout")
  return { ok: true, message }
}

export async function createCategoryAction(input: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const parsed = createCategorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  try {
    // Truyền input gốc: service tự parse lại (đầu ra của schema không còn là đầu vào hợp lệ).
    await createCategory({ userId: admin.id }, input as Parameters<typeof createCategory>[1])
  } catch (e) {
    if (e instanceof AdminCatalogError) return { ok: false, message: e.message }
    throw e
  }
  return done("Đã thêm danh mục")
}

export async function updateCategoryAction(categoryId: unknown, input: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = adminIdSchema.safeParse(categoryId)
  if (!id.success) return { ok: false, message: "Danh mục không hợp lệ" }
  const parsed = updateCategorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  try {
    await updateCategory({ userId: admin.id }, id.data, input as Parameters<typeof updateCategory>[2])
  } catch (e) {
    if (e instanceof AdminCatalogError) return { ok: false, message: e.message }
    throw e
  }
  return done("Đã cập nhật danh mục")
}

export async function deleteCategoryAction(categoryId: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = adminIdSchema.safeParse(categoryId)
  if (!id.success) return { ok: false, message: "Danh mục không hợp lệ" }

  try {
    await deleteCategory({ userId: admin.id }, id.data)
  } catch (e) {
    if (e instanceof AdminCatalogError) return { ok: false, message: e.message }
    throw e
  }
  return done("Đã xóa danh mục")
}
