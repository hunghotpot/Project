"use server"

import { revalidatePath } from "next/cache"
import { fieldErrorsFrom, type ActionResult } from "@/lib/action-result"
import {
  addressIdSchema,
  addressSchema,
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/validators/auth"
import { setAuthCookies, getCurrentUser } from "@/server/auth/session"
import {
  AddressNotFoundError,
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/server/services/address.service"
import {
  AuthError,
  changePassword,
  startSession,
  updateProfile,
} from "@/server/services/auth.service"

const NOT_SIGNED_IN: ActionResult = { ok: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại" }

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return NOT_SIGNED_IN
  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

  await updateProfile(user.id, parsed.data)
  revalidatePath("/account", "layout")
  return { ok: true, message: "Đã cập nhật thông tin" }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return NOT_SIGNED_IN
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

  try {
    await changePassword(user.id, parsed.data)
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, fieldErrors: e.field ? { [e.field]: e.message } : undefined, message: e.field ? undefined : e.message }
    }
    throw e
  }
  // Mọi refresh token đã bị thu hồi → cấp phiên mới cho thiết bị đang dùng.
  await setAuthCookies(await startSession(user.id))
  return { ok: true, message: "Đã đổi mật khẩu" }
}

async function withAddress(fn: (userId: string) => Promise<void>, success: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return NOT_SIGNED_IN
  try {
    await fn(user.id)
  } catch (e) {
    if (e instanceof AddressNotFoundError) return { ok: false, message: e.message }
    throw e
  }
  revalidatePath("/account/addresses")
  return { ok: true, message: success }
}

export async function createAddressAction(input: unknown): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  return withAddress(async (userId) => void (await createAddress(userId, parsed.data)), "Đã thêm địa chỉ")
}

export async function updateAddressAction(id: string, input: unknown): Promise<ActionResult> {
  const parsedId = addressIdSchema.safeParse(id)
  const parsed = addressSchema.safeParse(input)
  if (!parsedId.success) return { ok: false, message: "Địa chỉ không hợp lệ" }
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
  return withAddress(
    async (userId) => void (await updateAddress(userId, parsedId.data, parsed.data)),
    "Đã cập nhật địa chỉ"
  )
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  const parsedId = addressIdSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Địa chỉ không hợp lệ" }
  return withAddress((userId) => deleteAddress(userId, parsedId.data), "Đã xoá địa chỉ")
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult> {
  const parsedId = addressIdSchema.safeParse(id)
  if (!parsedId.success) return { ok: false, message: "Địa chỉ không hợp lệ" }
  return withAddress((userId) => setDefaultAddress(userId, parsedId.data), "Đã đặt làm địa chỉ mặc định")
}
