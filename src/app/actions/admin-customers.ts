"use server"

import { revalidatePath } from "next/cache"
import type { AdminActionResult } from "@/lib/admin-action"
import { createCustomerSchema, customerIdSchema } from "@/lib/validators/admin-customer"
import { getAdminUser, NOT_ADMIN_MESSAGE } from "@/server/auth/admin"
import {
  AdminCustomerError,
  createCustomerByAdmin,
  lockCustomer,
  unlockCustomer,
} from "@/server/services/admin-customer.service"

/** Kết quả tạo khách: thêm `fieldErrors` (tên ô → lỗi) để form gắn lỗi đúng ô. Không bao giờ chứa mật khẩu. */
export type CreateCustomerResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export async function lockCustomerAction(customerId: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = customerIdSchema.safeParse(customerId)
  if (!id.success) return { ok: false, message: "Khách hàng không hợp lệ" }

  try {
    await lockCustomer({ userId: admin.id }, id.data)
  } catch (e) {
    if (e instanceof AdminCustomerError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Đã khóa tài khoản khách hàng" }
}

export async function unlockCustomerAction(customerId: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const id = customerIdSchema.safeParse(customerId)
  if (!id.success) return { ok: false, message: "Khách hàng không hợp lệ" }

  try {
    await unlockCustomer({ userId: admin.id }, id.data)
  } catch (e) {
    if (e instanceof AdminCustomerError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Đã mở khóa tài khoản khách hàng" }
}

export async function createCustomerAction(input: unknown): Promise<CreateCustomerResult> {
  const admin = await getAdminUser()
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }

  const parsed = createCustomerSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "")
      if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message
    }
    return { ok: false, message: "Vui lòng kiểm tra lại thông tin", fieldErrors }
  }

  try {
    await createCustomerByAdmin(parsed.data)
  } catch (e) {
    if (e instanceof AdminCustomerError) {
      return { ok: false, message: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined }
    }
    throw e
  }
  revalidatePath("/admin", "layout")
  return { ok: true, message: "Đã tạo tài khoản khách hàng" }
}
