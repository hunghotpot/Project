import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import { createFixtures } from "@/test/db-fixtures"
import {
  cancelOrder,
  changeOrderStatus,
  createOrder,
  getOrderDetail,
  listOrders,
  OrderError,
  reorder,
} from "./order.service"

/* Test tích hợp trên PostgreSQL thật (cần `npm run db:up`): danh sách/lọc/phân trang, quyền chủ đơn, lịch sử trạng thái, mua lại. */

const fx = createFixtures()
afterAll(fx.cleanup)

type Buyer = Awaited<ReturnType<typeof fx.makeBuyer>>

/** Đặt thêm một đơn COD (1 sản phẩm của variantId) cho buyer. */
async function placeOrder(buyer: Buyer, variantId: string, quantity = 1) {
  const cart = await db.cart.findFirstOrThrow({ where: { userId: buyer.user.id } })
  await db.cartItem.create({ data: { cartId: cart.id, variantId, quantity } })
  return createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })
}

async function expectOrderError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(OrderError)
  expect((err as OrderError).code).toBe(code)
}

const historyOf = (orderId: string) => db.orderStatusHistory.findMany({ where: { orderId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })

describe("lịch sử trạng thái", () => {
  it("tạo đơn ghi dòng đầu tiên: null → PENDING bởi khách hàng", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })

    expect(await historyOf(order.id)).toMatchObject([
      { fromStatus: null, toStatus: "PENDING", actorType: "CUSTOMER", actorUserId: buyer.user.id },
    ])
  })

  it("changeOrderStatus ghi người đổi; chỉ đi tuần tự, không nhảy cóc, không đi lùi", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const admin = await fx.makeAdmin()
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })

    await expectOrderError(changeOrderStatus(order.id, "SHIPPING", { type: "ADMIN", userId: admin.id }), "INVALID_STATUS_CHANGE") // nhảy cóc
    await changeOrderStatus(order.id, "CONFIRMED", { type: "ADMIN", userId: admin.id }, "Đã gọi xác nhận")
    await changeOrderStatus(order.id, "SHIPPING", { type: "SYSTEM" })
    await expectOrderError(changeOrderStatus(order.id, "CONFIRMED", { type: "SYSTEM" }), "INVALID_STATUS_CHANGE") // đi lùi
    await expectOrderError(changeOrderStatus(order.id, "CANCELLED", { type: "SYSTEM" }), "INVALID_STATUS_CHANGE") // huỷ đi qua cancelOrder

    expect(await historyOf(order.id)).toMatchObject([
      { fromStatus: null, toStatus: "PENDING" },
      { fromStatus: "PENDING", toStatus: "CONFIRMED", actorType: "ADMIN", actorUserId: admin.id, note: "Đã gọi xác nhận" },
      { fromStatus: "CONFIRMED", toStatus: "SHIPPING", actorType: "SYSTEM", actorUserId: null },
    ])
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SHIPPING")
  })

  it("huỷ đơn ghi lịch sử với trạng thái trước đó và lý do", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const admin = await fx.makeAdmin()
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })
    await changeOrderStatus(order.id, "CONFIRMED", { type: "ADMIN", userId: admin.id })

    await cancelOrder(buyer.user, order.id, "Đổi ý size")

    const last = (await historyOf(order.id)).at(-1)
    expect(last).toMatchObject({ fromStatus: "CONFIRMED", toStatus: "CANCELLED", actorType: "CUSTOMER", actorUserId: buyer.user.id, note: "Đổi ý size" })
  })

  it("huỷ thất bại (đang giao) thì không ghi thêm dòng nào", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })
    await changeOrderStatus(order.id, "CONFIRMED", { type: "SYSTEM" })
    await changeOrderStatus(order.id, "SHIPPING", { type: "SYSTEM" })
    const before = (await historyOf(order.id)).length

    await expectOrderError(cancelOrder(buyer.user, order.id), "CANNOT_CANCEL")
    expect((await historyOf(order.id)).length).toBe(before)
  })

  it("huỷ và đổi trạng thái đồng thời: kết quả luôn nhất quán, lịch sử khớp trạng thái cuối", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })

    await Promise.allSettled([cancelOrder(buyer.user, order.id), changeOrderStatus(order.id, "CONFIRMED", { type: "SYSTEM" })])

    const final = await db.order.findUniqueOrThrow({ where: { id: order.id } })
    const history = await historyOf(order.id)
    expect(history.at(-1)!.toStatus).toBe(final.status) // dòng cuối luôn phản ánh trạng thái thật
    // Kho khớp trạng thái: huỷ → hoàn đủ 5; còn sống → đã trừ 1.
    expect(await fx.stockOf(v.id)).toBe(final.status === "CANCELLED" ? 5 : 4)
  })

  it("getOrderDetail trả lịch sử theo thứ tự thời gian; tên người đổi chỉ lộ với nhân viên", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const admin = await fx.makeAdmin()
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })
    await changeOrderStatus(order.id, "CONFIRMED", { type: "ADMIN", userId: admin.id })

    const detail = await getOrderDetail(buyer.user.id, order.id)
    expect(detail!.history.map((h) => h.toStatus)).toEqual(["PENDING", "CONFIRMED"])
    expect(detail!.history[0]).toMatchObject({ actorType: "CUSTOMER", actorName: null }) // không lộ tên khách
    expect(detail!.history[1]).toMatchObject({ actorType: "ADMIN", actorName: "Quản Trị Thử" })
  })
})

describe("quyền: chỉ chủ đơn", () => {
  it("người khác không xem, huỷ, mua lại hay thấy đơn trong danh sách", async () => {
    const v = await fx.makeVariant(5)
    const owner = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const stranger = await fx.makeBuyer([])
    const order = await createOrder(owner.user, { addressId: owner.addressId, paymentMethod: "COD" })

    expect(await getOrderDetail(stranger.user.id, order.id)).toBeNull()
    await expectOrderError(cancelOrder(stranger.user, order.id), "ORDER_NOT_FOUND")
    await expectOrderError(reorder(stranger.user, order.id), "ORDER_NOT_FOUND")
    expect((await listOrders(stranger.user.id)).total).toBe(0)

    // Đơn của chủ không hề bị ảnh hưởng.
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING")
    expect(await fx.stockOf(v.id)).toBe(4)
    expect(await fx.cartSize(stranger.user.id)).toBe(0)
  })
})

describe("listOrders", () => {
  it("lọc theo trạng thái, đếm theo trạng thái, phân trang và sắp xếp mới nhất trước", async () => {
    const v = await fx.makeVariant(50)
    const buyer = await fx.makeBuyer([])
    const orders = []
    for (let i = 0; i < 7; i++) orders.push(await placeOrder(buyer, v.id))
    await changeOrderStatus(orders[0].id, "CONFIRMED", { type: "SYSTEM" })
    await changeOrderStatus(orders[1].id, "CONFIRMED", { type: "SYSTEM" })
    await changeOrderStatus(orders[1].id, "SHIPPING", { type: "SYSTEM" })
    await cancelOrder(buyer.user, orders[2].id, "Đặt nhầm")

    const page1 = await listOrders(buyer.user.id, { page: 1, pageSize: 5 })
    expect(page1).toMatchObject({ total: 7, pageCount: 2, page: 1 })
    expect(page1.items).toHaveLength(5)
    expect(page1.items[0].code).toBe(orders[6].code) // mới nhất trước
    expect(page1.counts).toMatchObject({ ALL: 7, PENDING: 4, CONFIRMED: 1, SHIPPING: 1, DELIVERED: 0, CANCELLED: 1 })

    const page2 = await listOrders(buyer.user.id, { page: 2, pageSize: 5 })
    expect(page2.items).toHaveLength(2)

    const shipping = await listOrders(buyer.user.id, { status: "SHIPPING" })
    expect(shipping.items.map((o) => o.code)).toEqual([orders[1].code])
    expect(shipping.counts.ALL).toBe(7) // số đếm không bị bộ lọc trạng thái làm thay đổi

    const cancelled = await listOrders(buyer.user.id, { status: "CANCELLED" })
    expect(cancelled.items[0]).toMatchObject({ cancelReason: "Đặt nhầm", status: "CANCELLED" })
  })

  it("tìm theo mã đơn (có hoặc không có dấu #) hoặc tên sản phẩm, không phân biệt hoa thường", async () => {
    const v = await fx.makeVariant(20)
    const buyer = await fx.makeBuyer([])
    const a = await placeOrder(buyer, v.id)
    await placeOrder(buyer, v.id)
    const productName = (await db.orderItem.findFirstOrThrow({ where: { orderId: a.id } })).productName

    expect((await listOrders(buyer.user.id, { q: `#${a.code}` })).items.map((o) => o.code)).toEqual([a.code])
    expect((await listOrders(buyer.user.id, { q: a.code.toLowerCase() })).total).toBe(1)
    expect((await listOrders(buyer.user.id, { q: productName.toUpperCase() })).total).toBe(2)
    expect((await listOrders(buyer.user.id, { q: "khong-ton-tai" })).total).toBe(0)
  })

  it("mỗi dòng đơn kèm ảnh/slug/tình trạng còn hàng và số lượng tổng", async () => {
    const v = await fx.makeVariant(2)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 2 }])
    await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })

    const [o] = (await listOrders(buyer.user.id)).items
    expect(o).toMatchObject({ quantity: 2, lineCount: 1 })
    expect(o.items[0]).toMatchObject({ quantity: 2, inStock: false }) // kho đã về 0 sau khi mua
  })
})

describe("reorder", () => {
  it("thêm dòng còn hàng, cắt theo tồn kho, bỏ dòng hết hàng/ngừng bán và báo lý do", async () => {
    const ok = await fx.makeVariant(10)
    const partial = await fx.makeVariant(5)
    const soldOut = await fx.makeVariant(5)
    const hidden = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([
      { variantId: ok.id, quantity: 2 },
      { variantId: partial.id, quantity: 3 },
      { variantId: soldOut.id, quantity: 1 },
      { variantId: hidden.id, quantity: 1 },
    ])
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })

    // Sau khi mua: partial còn 2 (< 3 đã mua), soldOut còn 4 nhưng ta đặt về 0, hidden bị ngừng bán.
    await db.productVariant.update({ where: { id: soldOut.id }, data: { stock: 0 } })
    await db.product.update({ where: { id: hidden.productId }, data: { isActive: false } })

    const res = await reorder(buyer.user, order.id)

    expect(res.added).toBe(2)
    expect(res.skipped.map((s) => s.reason).sort()).toEqual(["OUT_OF_STOCK", "UNAVAILABLE"])
    const cart = await db.cartItem.findMany({ where: { cart: { userId: buyer.user.id } } })
    const qty = (id: string) => cart.find((c) => c.variantId === id)?.quantity
    expect(qty(ok.id)).toBe(2)
    expect(qty(partial.id)).toBe(2) // chỉ còn 2 dù đơn cũ mua 3
    expect(qty(soldOut.id)).toBeUndefined()
    expect(qty(hidden.id)).toBeUndefined()
  })

  it("không vượt tồn kho khi giỏ đã có sẵn sản phẩm đó", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 3 }])
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" }) // kho còn 2
    const cart = await db.cart.findFirstOrThrow({ where: { userId: buyer.user.id } })
    await db.cartItem.create({ data: { cartId: cart.id, variantId: v.id, quantity: 2 } }) // giỏ đã chứa đủ phần còn lại

    const res = await reorder(buyer.user, order.id)

    expect(res.added).toBe(0)
    expect(res.skipped).toMatchObject([{ reason: "IN_CART_MAX" }])
    expect((await db.cartItem.findFirstOrThrow({ where: { cartId: cart.id } })).quantity).toBe(2)
  })

  it("dòng có biến thể đã bị xoá khỏi hệ thống được báo là không còn bán", async () => {
    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })
    await db.productVariant.delete({ where: { id: v.id } }) // OrderItem.variantId → null (SetNull)

    const res = await reorder(buyer.user, order.id)
    expect(res).toMatchObject({ added: 0, skipped: [{ reason: "UNAVAILABLE" }] })
  })
})
