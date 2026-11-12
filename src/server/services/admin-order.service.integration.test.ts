import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import { createFixtures } from "@/test/db-fixtures"
import {
  adminCancelOrder,
  adminChangeOrderStatus,
  getAdminOrderDetail,
  getOrderStatusCounts,
  listAllOrders,
  markBankTransferPaid,
  vnMonthRange,
} from "./admin-order.service"
import { createOrder, OrderError } from "./order.service"

/*
 * Test tích hợp trên PostgreSQL thật (cần `npm run db:up`). Dữ liệu có tiền tố riêng và tự dọn.
 * Danh sách/đếm toàn cục nên test tìm theo mã đơn duy nhất hoặc so sánh số đếm trước/sau.
 */

const fx = createFixtures()
const { makeVariant, makeBuyer, makeAdmin, stockOf } = fx

async function expectOrderError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(OrderError)
  expect((err as OrderError).code).toBe(code)
  return err as OrderError
}

/** Tạo một đơn thật qua createOrder; trả cả variant để kiểm kho. */
async function placeOrder(opts: { paymentMethod?: "COD" | "BANK_TRANSFER" | "VNPAY"; quantity?: number; stock?: number } = {}) {
  const v = await makeVariant(opts.stock ?? 5, 100_000)
  const buyer = await makeBuyer([{ variantId: v.id, quantity: opts.quantity ?? 2 }])
  const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: opts.paymentMethod ?? "COD" })
  return { v, buyer, order }
}

afterAll(fx.cleanup)

describe("listAllOrders", () => {
  it("thấy đơn của mọi khách, tìm theo mã đơn, trả DTO gọn không lộ passwordHash", async () => {
    const a = await placeOrder()
    const b = await placeOrder({ paymentMethod: "BANK_TRANSFER" })

    const res = await listAllOrders({ q: a.order.code })
    expect(res.total).toBe(1)
    expect(res.items[0]).toMatchObject({
      id: a.order.id,
      code: a.order.code,
      status: "PENDING",
      paymentMethod: "COD",
      total: 230_000,
      customerName: "Người Mua Thử",
      quantity: 2,
      otherLines: 0,
    })
    expect(JSON.stringify(res)).not.toContain("passwordHash")
    expect((await listAllOrders({ q: `#${b.order.code.toLowerCase()}` })).items[0].id).toBe(b.order.id)
  })

  it("tìm theo tên khách và số điện thoại, hiển thị '+N món'", async () => {
    const v1 = await makeVariant(5)
    const v2 = await makeVariant(5)
    const buyer = await makeBuyer([
      { variantId: v1.id, quantity: 1 },
      { variantId: v2.id, quantity: 3 },
    ])
    const name = `Khach${Date.now().toString(36)}`
    const phone = `09${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`
    await db.user.update({ where: { id: buyer.user.id }, data: { name, phone } })
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })

    const byName = await listAllOrders({ q: name.toLowerCase() })
    expect(byName.items.map((i) => i.id)).toEqual([order.id])
    expect(byName.items[0]).toMatchObject({ otherLines: 1, quantity: 4, customerPhone: phone })

    expect((await listAllOrders({ q: phone })).items.map((i) => i.id)).toContain(order.id)
    // SĐT trên địa chỉ giao hàng ("0901234567" của fixture) cũng tìm được.
    expect((await listAllOrders({ q: order.code })).items[0].id).toBe(order.id)
  })

  it("lọc theo trạng thái / thanh toán / phương thức, phân trang và sắp mới nhất trước", async () => {
    const a = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    const b = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    await db.order.update({ where: { id: b.order.id }, data: { status: "CONFIRMED", paymentStatus: "PAID" } })
    const ids = [a.order.id, b.order.id]

    const pending = await listAllOrders({ status: "CONFIRMED", paymentStatus: "PAID", paymentMethod: "BANK_TRANSFER", pageSize: 50 })
    expect(pending.items.map((i) => i.id)).toContain(b.order.id)
    expect(pending.items.map((i) => i.id)).not.toContain(a.order.id)
    expect(pending.items.every((i) => i.status === "CONFIRMED" && i.paymentStatus === "PAID")).toBe(true)

    const all = await listAllOrders({ paymentMethod: "BANK_TRANSFER", pageSize: 50 })
    const mine = all.items.filter((i) => ids.includes(i.id))
    expect(mine).toHaveLength(2)
    expect(mine[0].createdAt.getTime()).toBeGreaterThanOrEqual(mine[1].createdAt.getTime())

    const p1 = await listAllOrders({ pageSize: 1, page: 1 })
    const p2 = await listAllOrders({ pageSize: 1, page: 2 })
    expect(p1.items).toHaveLength(1)
    expect(p2.items[0].id).not.toBe(p1.items[0].id)
    expect(p1.pageCount).toBe(p1.total)
  })
})

describe("getOrderStatusCounts", () => {
  it("đếm theo trạng thái và đơn hoàn thành trong tháng", async () => {
    const before = await getOrderStatusCounts()
    const admin = await makeAdmin()

    const a = await placeOrder()
    const b = await placeOrder()
    await adminChangeOrderStatus({ userId: admin.id }, b.order.id, "CONFIRMED")
    await adminChangeOrderStatus({ userId: admin.id }, b.order.id, "SHIPPING")
    await adminChangeOrderStatus({ userId: admin.id }, b.order.id, "DELIVERED")
    const c = await placeOrder()
    await adminCancelOrder({ userId: admin.id }, c.order.id)

    const after = await getOrderStatusCounts()
    expect(after.PENDING - before.PENDING).toBe(1)
    expect(after.DELIVERED - before.DELIVERED).toBe(1)
    expect(after.CANCELLED - before.CANCELLED).toBe(1)
    expect(after.ALL - before.ALL).toBe(3)
    expect(after.deliveredThisMonth - before.deliveredThisMonth).toBe(1)
    expect(a.order.id).toBeTruthy()

    // Tháng sau: đơn vừa giao không còn tính vào "trong tháng".
    const nextMonth = await getOrderStatusCounts(new Date(Date.now() + 40 * 24 * 3600 * 1000))
    expect(nextMonth.deliveredThisMonth).toBeLessThan(after.deliveredThisMonth)
  })
})

describe("vnMonthRange (thuần)", () => {
  it("đầu tháng tính theo giờ Việt Nam (UTC+7)", () => {
    // 2026-10-31 18:00 UTC = 2026-11-01 01:00 giờ VN → đã sang tháng 11.
    const r = vnMonthRange(new Date("2026-10-31T18:00:00Z"))
    expect(r.start.toISOString()).toBe("2026-10-31T17:00:00.000Z")
    expect(r.end.toISOString()).toBe("2026-11-30T17:00:00.000Z")
    // Cuối năm: tháng 12 → 1.
    expect(vnMonthRange(new Date("2026-12-15T00:00:00Z")).end.toISOString()).toBe("2026-12-31T17:00:00.000Z")
  })
})

describe("getAdminOrderDetail", () => {
  it("trả chi tiết không ràng userId: khách, dòng hàng, địa chỉ, lịch sử", async () => {
    const admin = await makeAdmin()
    const { order, buyer } = await placeOrder()
    await adminChangeOrderStatus({ userId: admin.id }, order.id, "CONFIRMED", "Đã kiểm hàng")

    const d = (await getAdminOrderDetail(order.id))!
    expect(d.customer).toMatchObject({ id: buyer.user.id, name: "Người Mua Thử" })
    expect(JSON.stringify(d)).not.toContain("passwordHash")
    expect(d.items).toMatchObject([{ unitPrice: 100_000, quantity: 2, lineTotal: 200_000 }])
    expect(d.shippingAddress).toMatchObject({ street: "1 Test" })
    expect(d.history.map((h) => [h.fromStatus, h.toStatus, h.actorType])).toEqual([
      [null, "PENDING", "CUSTOMER"],
      ["PENDING", "CONFIRMED", "ADMIN"],
    ])
    expect(d.history[1]).toMatchObject({ actorName: "Quản Trị Thử", note: "Đã kiểm hàng" })
  })

  it("không có đơn → null", async () => {
    expect(await getAdminOrderDetail("khong-ton-tai")).toBeNull()
  })
})

describe("adminChangeOrderStatus", () => {
  it("Duyệt rồi Giao đi, ghi actor ADMIN; không nhảy cóc, không đi lùi", async () => {
    const admin = await makeAdmin()
    const { order } = await placeOrder()
    const actor = { userId: admin.id }

    await expectOrderError(adminChangeOrderStatus(actor, order.id, "SHIPPING"), "INVALID_STATUS_CHANGE") // nhảy cóc
    expect((await adminChangeOrderStatus(actor, order.id, "CONFIRMED")).status).toBe("CONFIRMED")
    await expectOrderError(adminChangeOrderStatus(actor, order.id, "CONFIRMED"), "INVALID_STATUS_CHANGE") // lặp lại
    expect((await adminChangeOrderStatus(actor, order.id, "SHIPPING")).status).toBe("SHIPPING")

    const rows = await db.orderStatusHistory.findMany({ where: { orderId: order.id, toStatus: { in: ["CONFIRMED", "SHIPPING"] } } })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.actorType === "ADMIN" && r.actorUserId === admin.id)).toBe(true)
  })

  it("trạng thái đích sai hoặc đơn không tồn tại → lỗi OrderError", async () => {
    const admin = await makeAdmin()
    const { order } = await placeOrder()
    await expectOrderError(adminChangeOrderStatus({ userId: admin.id }, order.id, "CANCELLED" as never), "INVALID_STATUS_CHANGE")
    await expectOrderError(adminChangeOrderStatus({ userId: admin.id }, "khong-ton-tai", "CONFIRMED"), "ORDER_NOT_FOUND")
  })
})

describe("adminCancelOrder", () => {
  it("huỷ đơn của khách: hoàn kho, lịch sử actor ADMIN kèm lý do", async () => {
    const admin = await makeAdmin()
    const { order, v } = await placeOrder({ stock: 5, quantity: 2 })
    expect(await stockOf(v.id)).toBe(3)

    const res = await adminCancelOrder({ userId: admin.id }, order.id, "Khách yêu cầu")
    expect(res.status).toBe("CANCELLED")
    expect(await stockOf(v.id)).toBe(5)

    const last = res.history.at(-1)!
    expect(last).toMatchObject({ toStatus: "CANCELLED", actorType: "ADMIN", actorName: "Quản Trị Thử", note: "Khách yêu cầu" })
  })

  it("không huỷ hai lần (kho chỉ hoàn một lần), không huỷ đơn đang giao", async () => {
    const admin = await makeAdmin()
    const actor = { userId: admin.id }
    const a = await placeOrder({ stock: 5, quantity: 2 })
    await adminCancelOrder(actor, a.order.id)
    await expectOrderError(adminCancelOrder(actor, a.order.id), "CANNOT_CANCEL")
    expect(await stockOf(a.v.id)).toBe(5)

    const b = await placeOrder()
    await adminChangeOrderStatus(actor, b.order.id, "CONFIRMED")
    await adminChangeOrderStatus(actor, b.order.id, "SHIPPING")
    await expectOrderError(adminCancelOrder(actor, b.order.id), "CANNOT_CANCEL")
    await expectOrderError(adminCancelOrder(actor, "khong-ton-tai"), "ORDER_NOT_FOUND")
  })

  it("đơn chuyển khoản đã PAID khi huỷ thì thành REFUNDED", async () => {
    const admin = await makeAdmin()
    const { order } = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    await markBankTransferPaid({ userId: admin.id }, order.id)
    const res = await adminCancelOrder({ userId: admin.id }, order.id)
    expect(res.paymentStatus).toBe("REFUNDED")
  })
})

describe("markBankTransferPaid", () => {
  it("đặt PAID, giữ nguyên trạng thái đơn, ghi lịch sử ADMIN có ghi chú", async () => {
    const admin = await makeAdmin()
    const { order } = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    expect(order.paymentStatus).toBe("PENDING")

    const res = await markBankTransferPaid({ userId: admin.id }, order.id)
    expect(res).toMatchObject({ paymentStatus: "PAID", status: "PENDING" })
    expect(res.history.at(-1)).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "PENDING",
      actorType: "ADMIN",
      actorName: "Quản Trị Thử",
      note: "Admin xác nhận đã nhận tiền chuyển khoản",
    })
  })

  it("báo lỗi rõ khi đã PAID, khi không phải chuyển khoản, khi đơn đã huỷ, khi không tồn tại", async () => {
    const admin = await makeAdmin()
    const actor = { userId: admin.id }

    const paid = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    await markBankTransferPaid(actor, paid.order.id)
    const again = await expectOrderError(markBankTransferPaid(actor, paid.order.id), "CANNOT_PAY")
    expect(again.message).toContain("đã được xác nhận")
    expect(await db.orderStatusHistory.count({ where: { orderId: paid.order.id, actorType: "ADMIN" } })).toBe(1)

    const cod = await placeOrder({ paymentMethod: "COD" })
    await expectOrderError(markBankTransferPaid(actor, cod.order.id), "CANNOT_PAY")
    expect((await db.order.findUniqueOrThrow({ where: { id: cod.order.id } })).paymentStatus).toBe("PENDING")

    const cancelled = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    await adminCancelOrder(actor, cancelled.order.id)
    await expectOrderError(markBankTransferPaid(actor, cancelled.order.id), "CANNOT_PAY")

    await expectOrderError(markBankTransferPaid(actor, "khong-ton-tai"), "ORDER_NOT_FOUND")
  })

  it("hai lần bấm đồng thời chỉ một lần thành công", async () => {
    const admin = await makeAdmin()
    const { order } = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    const results = await Promise.allSettled([
      markBankTransferPaid({ userId: admin.id }, order.id),
      markBankTransferPaid({ userId: admin.id }, order.id),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id, actorType: "ADMIN" } })).toBe(1)
  })

  it("đơn chuyển khoản không có hạn tự huỷ: vẫn xác nhận được khi đã đặt từ lâu", async () => {
    const admin = await makeAdmin()
    const { order } = await placeOrder({ paymentMethod: "BANK_TRANSFER" })
    await db.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) } })
    expect((await markBankTransferPaid({ userId: admin.id }, order.id)).paymentStatus).toBe("PAID")
  })
})
