import { afterAll, describe, expect, it } from "vitest"
import { createFixtures } from "@/test/db-fixtures"
import { createOrder, getOrderByCode } from "./order.service"

/* Test tích hợp trên PostgreSQL thật (cần `npm run db:up`); dữ liệu có tiền tố riêng và tự dọn. */

const fx = createFixtures()
afterAll(fx.cleanup)

async function makeOrder() {
  const v = await fx.makeVariant(5, 100_000)
  const { user, addressId } = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
  const order = await createOrder(user, { addressId, paymentMethod: "COD" })
  return { user, order }
}

describe("getOrderByCode", () => {
  it("trả đơn của chính người dùng theo mã, kèm lịch sử và món hàng", async () => {
    const { user, order } = await makeOrder()
    const found = await getOrderByCode(user.id, order.code)
    expect(found).toMatchObject({ id: order.id, code: order.code, status: "PENDING" })
    expect(found?.items).toHaveLength(1)
  })

  it("không phân biệt hoa thường và bỏ khoảng trắng hai đầu", async () => {
    const { user, order } = await makeOrder()
    expect((await getOrderByCode(user.id, `  ${order.code.toLowerCase()} `))?.id).toBe(order.id)
  })

  it("đơn của người khác trả null như mã không tồn tại", async () => {
    const mine = await makeOrder()
    const other = await makeOrder()
    expect(await getOrderByCode(other.user.id, mine.order.code)).toBeNull()
    expect(await getOrderByCode(mine.user.id, "FS-20000101-9999")).toBeNull()
  })

  it("mã sai định dạng trả null, không đụng DB với chuỗi lạ", async () => {
    const { user } = await makeOrder()
    for (const bad of ["", "abc", "FS-2026-1", "FS-20261110-12; DROP TABLE", "' OR 1=1 --"]) {
      expect(await getOrderByCode(user.id, bad)).toBeNull()
    }
  })
})
