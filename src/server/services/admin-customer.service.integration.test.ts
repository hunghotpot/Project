import bcrypt from "bcryptjs"
import { afterAll, describe, expect, it } from "vitest"
import { VIP_SPEND_THRESHOLD } from "@/lib/customer-tier"
import { db } from "@/server/db"
import { createFixtures } from "@/test/db-fixtures"
import {
  AdminCustomerError,
  createCustomerByAdmin,
  getCustomerDetail,
  getCustomerSummary,
  listCustomers,
  lockCustomer,
  unlockCustomer,
} from "./admin-customer.service"

/*
 * Test tích hợp trên PostgreSQL thật (cần `npm run db:up`). Dữ liệu dùng tiền tố riêng và tự dọn.
 * Tìm kiếm theo tiền tố email của lần chạy này (q) để cô lập khỏi dữ liệu có sẵn trong DB.
 */

const fx = createFixtures()
const createdEmails: string[] = []
let orderSeq = 0

// Khai báo SAU fx.cleanup: hook afterAll chạy theo thứ tự ngược → dọn user do createCustomerByAdmin tạo trước khi ngắt kết nối.
afterAll(fx.cleanup)
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: createdEmails } } })
})

async function expectError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(AdminCustomerError)
  expect((err as AdminCustomerError).code).toBe(code)
  return err as AdminCustomerError
}

async function makeOrder(userId: string, total: number, status: "PENDING" | "DELIVERED" | "CANCELLED" = "DELIVERED") {
  return db.order.create({
    data: {
      code: `T-${Date.now().toString(36)}-${++orderSeq}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      status,
      subtotal: total,
      shippingFee: 0,
      total,
      shippingAddress: {},
      paymentMethod: "COD",
    },
  })
}

const prefixOf = (email: string) => email.split("-")[0]

describe("listCustomers / getCustomerDetail", () => {
  it("tính số đơn, tổng chi tiêu (bỏ đơn huỷ), hạng; lọc VIP/Thành viên/Bị khoá; tìm kiếm; phân trang", async () => {
    const vip = (await fx.makeBuyer([])).user
    const member = (await fx.makeBuyer([])).user
    const none = (await fx.makeBuyer([])).user
    const locked = (await fx.makeBuyer([])).user
    await db.user.update({ where: { id: locked.id }, data: { status: "LOCKED" } })

    await makeOrder(vip.id, VIP_SPEND_THRESHOLD - 1_000_000)
    await makeOrder(vip.id, 1_000_000, "PENDING")
    await makeOrder(vip.id, 50_000_000, "CANCELLED") // không tính
    await makeOrder(member.id, 100_000)

    const q = prefixOf(vip.email)
    const all = await listCustomers({ q, pageSize: 50 })
    expect(all.total).toBe(4)
    const byId = new Map(all.items.map((i) => [i.id, i]))
    expect(byId.get(vip.id)).toMatchObject({ orderCount: 2, totalSpend: VIP_SPEND_THRESHOLD, tier: "VIP", status: "ACTIVE" })
    expect(byId.get(member.id)).toMatchObject({ orderCount: 1, totalSpend: 100_000, tier: "MEMBER" })
    expect(byId.get(none.id)).toMatchObject({ orderCount: 0, totalSpend: 0, tier: "MEMBER", initial: "N" })
    expect(byId.get(locked.id)?.status).toBe("LOCKED")
    expect(JSON.stringify(all.items)).not.toContain("passwordHash")

    const ids = async (filter: "vip" | "member" | "locked") =>
      (await listCustomers({ q, filter, pageSize: 50 })).items.map((i) => i.id).sort()
    expect(await ids("vip")).toEqual([vip.id])
    expect(await ids("member")).toEqual([member.id, none.id, locked.id].sort())
    expect(await ids("locked")).toEqual([locked.id])

    const p1 = await listCustomers({ q, pageSize: 3, page: 1 })
    const p2 = await listCustomers({ q, pageSize: 3, page: 2 })
    expect(p1.totalPages).toBe(2)
    expect(p1.items).toHaveLength(3)
    expect(p2.items).toHaveLength(1)

    expect((await listCustomers({ q: member.email.toUpperCase() })).items.map((i) => i.id)).toEqual([member.id])
    expect((await listCustomers({ q: "khong-co-ai-ten-nay-xyz" })).items).toEqual([])

    const detail = await getCustomerDetail(vip.id)
    expect(detail).toMatchObject({ orderCount: 2, totalSpend: VIP_SPEND_THRESHOLD, tier: "VIP" })
    expect(detail.addresses).toHaveLength(1)
    expect(detail.recentOrders).toHaveLength(3) // đơn huỷ vẫn hiện trong lịch sử gần đây
    expect(JSON.stringify(detail)).not.toContain("passwordHash")
  })

  it("getCustomerDetail: không có / không phải khách → lỗi", async () => {
    await expectError(getCustomerDetail("khong-ton-tai"), "CUSTOMER_NOT_FOUND")
    const admin = await fx.makeAdmin()
    await expectError(getCustomerDetail(admin.id), "NOT_A_CUSTOMER")
  })

  it("danh sách không lộ admin", async () => {
    const admin = await fx.makeAdmin()
    const res = await listCustomers({ q: admin.email, pageSize: 50 })
    expect(res.items).toEqual([])
  })
})

describe("getCustomerSummary", () => {
  it("cộng đúng tổng khách, khách mới, VIP; tỉ lệ mua lại hợp lệ", async () => {
    const before = await getCustomerSummary()
    const a = (await fx.makeBuyer([])).user
    const b = (await fx.makeBuyer([])).user
    await makeOrder(a.id, VIP_SPEND_THRESHOLD)
    await makeOrder(a.id, 1000)
    await makeOrder(b.id, 1000)
    await makeOrder(b.id, 99_000_000, "CANCELLED")
    const after = await getCustomerSummary()

    expect(after.totalCustomers - before.totalCustomers).toBe(2)
    expect(after.newThisMonth - before.newThisMonth).toBe(2)
    expect(after.vipCount - before.vipCount).toBe(1)
    expect(after.repurchaseRate).toBeGreaterThanOrEqual(0)
    expect(after.repurchaseRate).toBeLessThanOrEqual(100)
  })
})

describe("lockCustomer / unlockCustomer", () => {
  it("khoá: đổi status và thu hồi mọi refresh token; mở khoá chỉ đổi status", async () => {
    const admin = await fx.makeAdmin()
    const { user } = await fx.makeBuyer([])
    const future = new Date(Date.now() + 3600_000)
    await db.refreshToken.createMany({
      data: [
        { userId: user.id, familyId: "f1", tokenHash: `${user.id}-h1`, expiresAt: future },
        { userId: user.id, familyId: "f2", tokenHash: `${user.id}-h2`, expiresAt: future },
      ],
    })

    await lockCustomer({ userId: admin.id }, user.id)
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("LOCKED")
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0)

    await unlockCustomer({ userId: admin.id }, user.id)
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe("ACTIVE")
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0) // không khôi phục
  })

  it("không khoá chính mình, không khoá Admin, không có user → lỗi", async () => {
    const admin = await fx.makeAdmin()
    const other = await fx.makeAdmin()
    await expectError(lockCustomer({ userId: admin.id }, admin.id), "CANNOT_LOCK_SELF")
    await expectError(lockCustomer({ userId: admin.id }, other.id), "NOT_A_CUSTOMER")
    await expectError(unlockCustomer({ userId: admin.id }, other.id), "NOT_A_CUSTOMER")
    await expectError(lockCustomer({ userId: admin.id }, "khong-ton-tai"), "CUSTOMER_NOT_FOUND")
    expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("ACTIVE")
  })
})

describe("createCustomerByAdmin", () => {
  it("tạo CUSTOMER ACTIVE, email chuẩn hoá, mật khẩu băm, không có phiên", async () => {
    const email = `T${Date.now().toString(36)}.Admin.Create@Test.Local`
    createdEmails.push(email.toLowerCase())

    const c = await createCustomerByAdmin({ name: "  Khách Do Admin Tạo ", email, phone: "0901234567", password: "matkhau123" })
    expect(c).toMatchObject({ name: "Khách Do Admin Tạo", email: email.toLowerCase(), phone: "0901234567", status: "ACTIVE", tier: "MEMBER", orderCount: 0, totalSpend: 0 })

    const row = await db.user.findUniqueOrThrow({ where: { id: c.id } })
    expect(row.role).toBe("CUSTOMER")
    expect(row.passwordHash).not.toBe("matkhau123")
    expect(await bcrypt.compare("matkhau123", row.passwordHash)).toBe(true)
    expect(await db.refreshToken.count({ where: { userId: c.id } })).toBe(0)

    await expectError(
      createCustomerByAdmin({ name: "Trùng Email", email: email.toUpperCase(), phone: null, password: "matkhau123" }),
      "EMAIL_TAKEN"
    )
  })

  it("từ chối dữ liệu sai (ZodError)", async () => {
    await expect(createCustomerByAdmin({ name: "A", email: "khong-hop-le", phone: "123", password: "123" })).rejects.toThrow()
  })
})
