import "server-only"
import type { AddressInput } from "@/lib/validators/auth"
import { db } from "@/server/db"
import type { AddressDTO } from "@/types/address"

/* Sổ địa chỉ. Mọi hàm đều ràng buộc theo userId để user không đụng được địa chỉ của người khác. */

export class AddressNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy địa chỉ")
    this.name = "AddressNotFoundError"
  }
}

const select = {
  id: true,
  fullName: true,
  phone: true,
  street: true,
  ward: true,
  district: true,
  province: true,
  isDefault: true,
} as const

export async function listAddresses(userId: string): Promise<AddressDTO[]> {
  return db.address.findMany({
    where: { userId },
    select,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressDTO> {
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } })
    // Địa chỉ đầu tiên luôn là mặc định.
    const isDefault = input.isDefault || count === 0
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.create({ data: { ...input, isDefault, userId }, select })
  })
}

export async function updateAddress(userId: string, id: string, input: AddressInput): Promise<AddressDTO> {
  return db.$transaction(async (tx) => {
    const current = await tx.address.findFirst({ where: { id, userId } })
    if (!current) throw new AddressNotFoundError()
    // Không cho bỏ mặc định trực tiếp: phải chọn địa chỉ khác làm mặc định.
    const isDefault = input.isDefault || current.isDefault
    if (isDefault) {
      await tx.address.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } })
    }
    return tx.address.update({ where: { id }, data: { ...input, isDefault }, select })
  })
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.address.findFirst({ where: { id, userId } })
    if (!current) throw new AddressNotFoundError()
    await tx.address.delete({ where: { id } })
    // Xoá địa chỉ mặc định → chuyển mặc định cho địa chỉ mới nhất còn lại.
    if (current.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  })
}

export async function setDefaultAddress(userId: string, id: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const current = await tx.address.findFirst({ where: { id, userId } })
    if (!current) throw new AddressNotFoundError()
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    await tx.address.update({ where: { id }, data: { isDefault: true } })
  })
}
