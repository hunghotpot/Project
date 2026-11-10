import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import { createFixtures } from "@/test/db-fixtures"
import { cancelOrder, createOrder, OrderError } from "./order.service"

/*
 * Test tích hợp trên PostgreSQL thật (cần `npm run db:up`): tranh chấp tồn kho chỉ kiểm chứng được bằng
 * khoá hàng của DB, giả lập in-memory không chứng minh được gì. Mọi dữ liệu có tiền tố riêng và tự dọn.
 */

const fx = createFixtures()
const { makeVariant, makeBuyer, stockOf, cartSize } = fx

async function expectOrderError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(OrderError)
  expect((err as OrderError).code).toBe(code)
  return err as OrderError
}

afterAll(fx.cleanup)

describe("createOrder", () => {
  it("trừ kho, snapshot giá/tên/size/màu, tính phí ship, cấp mã đơn và xoá giỏ", async () => {
    const v = await makeVariant(5, 100_000)
    const { user, addressId } = await makeBuyer([{ variantId: v.id, quantity: 2 }])

    const order = await createOrder(user, { addressId, paymentMethod: "COD", note: "Giao giờ hành chính" })

    expect(order.code).toMatch(/^FS-\d{8}-\d{4,}$/)
    expect(order).toMatchObject({ subtotal: 200_000, shippingFee: 30_000, total: 230_000, status: "PENDING", paymentMethod: "COD", note: "Giao giờ hành chính" })
    expect(order.items).toMatchObject([{ size: "M", color: "Đen", unitPrice: 100_000, quantity: 2 }])
    expect(order.shippingAddress).toMatchObject({ fullName: "Người Mua Thử", street: "1 Test" })
    expect(await stockOf(v.id)).toBe(3)
    expect(await cartSize(user.id)).toBe(0)
  })

  it("miễn phí vận chuyển từ 500.000đ", async () => {
    const v = await makeVariant(5, 300_000)
    const { user, addressId } = await makeBuyer([{ variantId: v.id, quantity: 2 }])
    const order = await createOrder(user, { addressId, paymentMethod: "BANK_TRANSFER" })
    expect(order).toMatchObject({ subtotal: 600_000, shippingFee: 0, total: 600_000 })
  })

  it("giá trong đơn là giá lúc mua: đổi giá sau đó không làm đổi đơn cũ", async () => {
    const v = await makeVariant(5, 100_000)
    const { user, addressId } = await makeBuyer([{ variantId: v.id, quantity: 1 }])
    const order = await createOrder(user, { addressId, paymentMethod: "COD" })

    await db.productVariant.update({ where: { id: v.id }, data: { price: 999_000 } })
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } })
    expect(item.unitPrice).toBe(100_000)
  })

  it("HAI ĐƠN CÙNG MUA biến thể chỉ còn 1 sản phẩm: chỉ 1 đơn thành công", async () => {
    const v = await makeVariant(1)
    const a = await makeBuyer([{ variantId: v.id, quantity: 1 }])
    const b = await makeBuyer([{ variantId: v.id, quantity: 1 }])

    const results = await Promise.allSettled([
      createOrder(a.user, { addressId: a.addressId, paymentMethod: "COD" }),
      createOrder(b.user, { addressId: b.addressId, paymentMethod: "COD" }),
    ])

    const ok = results.filter((r) => r.status === "fulfilled")
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected")
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].reason).toBeInstanceOf(OrderError)
    expect((failed[0].reason as OrderError).code).toBe("OUT_OF_STOCK")
    expect((failed[0].reason as OrderError).shortages).toMatchObject([{ variantId: v.id, requested: 1, available: 0 }])

    expect(await stockOf(v.id)).toBe(0) // không âm: không oversell
    expect(await db.order.count({ where: { userId: { in: [a.user.id, b.user.id] } } })).toBe(1)
    // Bên thua được rollback trọn vẹn: giỏ còn nguyên để người dùng sửa.
    const losers = [a, b].filter((x) => results[[a, b].indexOf(x)].status === "rejected")
    expect(await cartSize(losers[0].user.id)).toBe(1)
  })

  it("5 người tranh 2 sản phẩm: đúng 2 đơn thành công, kho về 0", async () => {
    const v = await makeVariant(2)
    const buyers = await Promise.all(Array.from({ length: 5 }, () => makeBuyer([{ variantId: v.id, quantity: 1 }])))

    const results = await Promise.allSettled(
      buyers.map((b) => createOrder(b.user, { addressId: b.addressId, paymentMethod: "COD" }))
    )

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2)
    expect(await stockOf(v.id)).toBe(0)
    const codes = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.code] : []))
    expect(new Set(codes).size).toBe(2) // mã đơn không trùng
  })

  it("thiếu hàng ở một dòng thì rollback toàn bộ (kho dòng khác không bị trừ) và báo đúng dòng", async () => {
    const enough = await makeVariant(5)
    const short = await makeVariant(1)
    const { user, addressId } = await makeBuyer([
      { variantId: enough.id, quantity: 1 },
      { variantId: short.id, quantity: 3 },
    ])

    const err = await expectOrderError(createOrder(user, { addressId, paymentMethod: "COD" }), "OUT_OF_STOCK")

    expect(err.shortages).toMatchObject([{ variantId: short.id, requested: 3, available: 1 }])
    expect(await stockOf(enough.id)).toBe(5)
    expect(await stockOf(short.id)).toBe(1)
    expect(await db.order.count({ where: { userId: user.id } })).toBe(0)
    expect(await cartSize(user.id)).toBe(2)
  })

  it("sản phẩm bị ngừng bán sau khi vào giỏ thì báo hết hàng", async () => {
    const v = await makeVariant(5)
    const { user, addressId } = await makeBuyer([{ variantId: v.id, quantity: 1 }])
    const variant = await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })
    await db.product.update({ where: { id: variant.productId }, data: { isActive: false } })

    const err = await expectOrderError(createOrder(user, { addressId, paymentMethod: "COD" }), "OUT_OF_STOCK")
    expect(err.shortages?.[0].available).toBe(0)
  })

  it("từ chối giỏ trống, phương thức chưa hỗ trợ và địa chỉ của người khác", async () => {
    const v = await makeVariant(5)
    const empty = await makeBuyer([])
    await expectOrderError(createOrder(empty.user, { addressId: empty.addressId, paymentMethod: "COD" }), "EMPTY_CART")

    const a = await makeBuyer([{ variantId: v.id, quantity: 1 }])
    const other = await makeBuyer([])
    await expectOrderError(createOrder(a.user, { addressId: a.addressId, paymentMethod: "MOMO" as never }), "PAYMENT_METHOD_UNAVAILABLE")
    await expectOrderError(createOrder(a.user, { addressId: other.addressId, paymentMethod: "COD" }), "ADDRESS_NOT_FOUND")
    expect(await stockOf(v.id)).toBe(5)
  })

  it("địa chỉ mới được lưu vào sổ địa chỉ", async () => {
    const v = await makeVariant(5)
    const { user } = await makeBuyer([{ variantId: v.id, quantity: 1 }])
    const order = await createOrder(user, {
      newAddress: { fullName: "Nhận Hàng Mới", phone: "0912345678", street: "9 Mới", ward: "P9", district: "Q9", province: "HCM", isDefault: false },
      paymentMethod: "COD",
    })
    expect(order.shippingAddress.fullName).toBe("Nhận Hàng Mới")
    expect(await db.address.count({ where: { userId: user.id } })).toBe(2)
  })
})

describe("cancelOrder", () => {
  it("huỷ đơn PENDING hoàn lại tồn kho; huỷ lần hai báo lỗi và không hoàn kho thêm", async () => {
    const v = await makeVariant(5)
    const { user, addressId } = await makeBuyer([{ variantId: v.id, quantity: 2 }])
    const order = await createOrder(user, { addressId, paymentMethod: "COD" })
    expect(await stockOf(v.id)).toBe(3)

    const cancelled = await cancelOrder(user, order.id)
    expect(cancelled.status).toBe("CANCELLED")
    expect(await stockOf(v.id)).toBe(5)

    await expectOrderError(cancelOrder(user, order.id), "CANNOT_CANCEL")
    expect(await stockOf(v.id)).toBe(5)
  })

  it("không huỷ được đơn đang giao/đã giao, hay đơn của người khác", async () => {
    const v = await makeVariant(5)
    const { user, addressId } = await makeBuyer([{ variantId: v.id, quantity: 1 }])
    const stranger = await makeBuyer([])
    const order = await createOrder(user, { addressId, paymentMethod: "COD" })

    await expectOrderError(cancelOrder(stranger.user, order.id), "ORDER_NOT_FOUND")

    await db.order.update({ where: { id: order.id }, data: { status: "SHIPPING" } })
    await expectOrderError(cancelOrder(user, order.id), "CANNOT_CANCEL")
    expect(await stockOf(v.id)).toBe(4)
  })
})


