import { beforeEach, describe, expect, it, vi } from "vitest"

const getAdminUser = vi.fn()
const lockCustomer = vi.fn()
const unlockCustomer = vi.fn()
const createCustomerByAdmin = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/server/auth/admin", () => ({
  getAdminUser: () => getAdminUser(),
  NOT_ADMIN_MESSAGE: "Bạn không có quyền thực hiện thao tác này",
}))
vi.mock("@/server/services/admin-customer.service", () => ({
  AdminCustomerError: class AdminCustomerError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly field?: string
    ) {
      super(message)
    }
  },
  lockCustomer: (...args: unknown[]) => lockCustomer(...args),
  unlockCustomer: (...args: unknown[]) => unlockCustomer(...args),
  createCustomerByAdmin: (...args: unknown[]) => createCustomerByAdmin(...args),
}))

import { AdminCustomerError } from "@/server/services/admin-customer.service"
import { createCustomerAction, lockCustomerAction, unlockCustomerAction } from "./admin-customers"

const DENIED = { ok: false, message: "Bạn không có quyền thực hiện thao tác này" }
const ADMIN = { id: "admin-1", role: "ADMIN" }

beforeEach(() => {
  for (const m of [getAdminUser, lockCustomer, unlockCustomer, createCustomerByAdmin]) m.mockReset()
})

describe("lockCustomerAction", () => {
  it("khách / chưa đăng nhập bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await lockCustomerAction("c1")).toEqual(DENIED)
    expect(lockCustomer).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId } của Admin", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    lockCustomer.mockResolvedValue(undefined)
    const res = await lockCustomerAction("c1")
    expect(res.ok).toBe(true)
    expect(lockCustomer).toHaveBeenCalledWith({ userId: "admin-1" }, "c1")
  })

  it("input sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await lockCustomerAction({ bad: true })).ok).toBe(false)
    expect(lockCustomer).not.toHaveBeenCalled()
  })

  it("lỗi nghiệp vụ được trả về dạng message", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    lockCustomer.mockRejectedValue(new AdminCustomerError("CANNOT_LOCK_SELF", "Không thể khoá chính mình"))
    expect(await lockCustomerAction("admin-1")).toEqual({ ok: false, message: "Không thể khoá chính mình" })
  })
})

describe("unlockCustomerAction", () => {
  it("khách / chưa đăng nhập bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await unlockCustomerAction("c1")).toEqual(DENIED)
    expect(unlockCustomer).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId } của Admin", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    unlockCustomer.mockResolvedValue(undefined)
    const res = await unlockCustomerAction("c1")
    expect(res.ok).toBe(true)
    expect(unlockCustomer).toHaveBeenCalledWith({ userId: "admin-1" }, "c1")
  })

  it("input sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await unlockCustomerAction("")).ok).toBe(false)
    expect(unlockCustomer).not.toHaveBeenCalled()
  })
})

describe("createCustomerAction", () => {
  const valid = { name: "Nguyễn Văn A", email: "A@Example.com", phone: "0987654321", password: "matkhau123" }

  it("khách / chưa đăng nhập bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await createCustomerAction(valid)).toEqual(DENIED)
    expect(createCustomerByAdmin).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với dữ liệu đã parse; kết quả không chứa mật khẩu", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    createCustomerByAdmin.mockResolvedValue({ id: "c1" })
    const res = await createCustomerAction(valid)
    expect(res.ok).toBe(true)
    expect(JSON.stringify(res)).not.toContain("matkhau123")
    expect(createCustomerByAdmin).toHaveBeenCalledWith(expect.objectContaining({ email: "a@example.com", name: "Nguyễn Văn A" }))
  })

  it("lỗi Zod gắn đúng ô và không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    const res = await createCustomerAction({ ...valid, email: "khong-hop-le", password: "123" })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.fieldErrors?.email).toBeTruthy()
      expect(res.fieldErrors?.password).toBeTruthy()
      expect(res.fieldErrors?.name).toBeUndefined()
    }
    expect(createCustomerByAdmin).not.toHaveBeenCalled()
  })

  it("EMAIL_TAKEN gắn vào ô email", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    createCustomerByAdmin.mockRejectedValue(new AdminCustomerError("EMAIL_TAKEN", "Email này đã được đăng ký", "email"))
    const res = await createCustomerAction(valid)
    expect(res).toEqual({
      ok: false,
      message: "Email này đã được đăng ký",
      fieldErrors: { email: "Email này đã được đăng ký" },
    })
  })
})
