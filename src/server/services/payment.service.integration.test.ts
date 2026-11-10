import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import { formatVnpDate, makeTxnRef, sign, toVnpParams, verifySignature, type VnpParams } from "@/server/payment/vnpay"
import { createFixtures } from "@/test/db-fixtures"
import { createOrder } from "./order.service"
import { createPaymentUrl, expireUnpaidVnpayOrders, handleIPN, verifyReturn } from "./payment.service"

/* Test tích hợp trên PostgreSQL thật (cần `npm run db:up`). Secret VNPay là giá trị giả cố định trong vitest.config.ts. */

const SECRET = process.env.VNP_HASH_SECRET!
const fx = createFixtures()
afterAll(fx.cleanup)

/** Tạo đơn VNPAY (kho 5, mua 1, giá 100.000 → total 130.000 gồm ship 30.000). */
async function makeVnpayOrder() {
  const v = await fx.makeVariant(5, 100_000)
  const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
  const order = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "VNPAY" })
  return { v, order, buyer }
}

/** Dữ liệu VNPay gọi về (IPN/Return) đã ký đúng bằng secret. */
function vnpayCallback(order: { code: string; total: number }, over: VnpParams = {}): VnpParams {
  const params: VnpParams = {
    vnp_TmnCode: process.env.VNP_TMN_CODE!,
    vnp_Amount: String(order.total * 100),
    vnp_BankCode: "NCB",
    vnp_TransactionNo: "14000001",
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: makeTxnRef(order.code, new Date()),
    ...over,
  }
  return { ...params, vnp_SecureHash: sign(params, SECRET) }
}

const reload = (id: string) => db.order.findUniqueOrThrow({ where: { id } })
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

describe("createPaymentUrl", () => {
  it("URL đã ký, số tiền nhân 100, hết hạn đúng 15 phút sau khi đặt, không chứa secret", async () => {
    const { order } = await makeVnpayOrder()
    const url = new URL(createPaymentUrl(order))
    const p = toVnpParams(url.searchParams)

    expect(url.origin + url.pathname).toBe("https://sandbox.test/vpcpay.html")
    expect(verifySignature(p, SECRET)).toBe(true)
    expect(p).toMatchObject({ vnp_Amount: "13000000", vnp_CurrCode: "VND", vnp_Command: "pay", vnp_TmnCode: "TESTTMN1" })
    expect(p.vnp_OrderInfo).toBe(`Thanh toan don hang ${order.code}`)
    expect(p.vnp_ExpireDate).toBe(formatVnpDate(new Date(order.createdAt.getTime() + 15 * 60_000)))
    expect(url.toString()).not.toContain(SECRET)
  })
})

describe("handleIPN", () => {
  it("thanh toán thành công → paymentStatus PAID và đơn CONFIRMED", async () => {
    const { order } = await makeVnpayOrder()
    expect(await handleIPN(vnpayCallback(order))).toEqual({ RspCode: "00", Message: "Confirm Success" })
    expect(await reload(order.id)).toMatchObject({ paymentStatus: "PAID", status: "CONFIRMED" })
  })

  it("IDEMPOTENT: gọi lại nhiều lần (kể cả đồng thời) chỉ cập nhật đúng một lần", async () => {
    const { order } = await makeVnpayOrder()
    const call = vnpayCallback(order)

    const results = await Promise.all(Array.from({ length: 5 }, () => handleIPN(call)))
    expect(results.filter((r) => r.RspCode === "00")).toHaveLength(1)
    expect(results.filter((r) => r.RspCode === "02")).toHaveLength(4)

    const before = await reload(order.id)
    expect(await handleIPN(call)).toMatchObject({ RspCode: "02" })
    const after = await reload(order.id)
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime()) // không ghi lại
  })

  it("từ chối chữ ký sai (97) và không đổi trạng thái", async () => {
    const { order } = await makeVnpayOrder()
    const tampered = { ...vnpayCallback(order), vnp_ResponseCode: "00", vnp_SecureHash: "0".repeat(128) }
    expect(await handleIPN(tampered)).toMatchObject({ RspCode: "97" })
    expect((await reload(order.id)).paymentStatus).toBe("PENDING")
  })

  it("từ chối số tiền không khớp đơn (04) dù chữ ký hợp lệ", async () => {
    const { order } = await makeVnpayOrder()
    expect(await handleIPN(vnpayCallback(order, { vnp_Amount: "100" }))).toMatchObject({ RspCode: "04" })
    expect((await reload(order.id)).paymentStatus).toBe("PENDING")
  })

  it("không tìm thấy đơn (01): mã lạ, hoặc đơn không phải VNPAY", async () => {
    expect(await handleIPN(vnpayCallback({ code: "FS-20000101-0001", total: 1 }))).toMatchObject({ RspCode: "01" })

    const v = await fx.makeVariant(5)
    const buyer = await fx.makeBuyer([{ variantId: v.id, quantity: 1 }])
    const cod = await createOrder(buyer.user, { addressId: buyer.addressId, paymentMethod: "COD" })
    expect(await handleIPN(vnpayCallback(cod))).toMatchObject({ RspCode: "01" })
    expect((await reload(cod.id)).paymentStatus).toBe("PENDING")
  })

  it("giao dịch thất bại → FAILED (đơn vẫn PENDING để thanh toán lại); thanh toán lại thành công → PAID", async () => {
    const { order } = await makeVnpayOrder()
    const failed = vnpayCallback(order, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })

    expect(await handleIPN(failed)).toMatchObject({ RspCode: "00" })
    expect(await reload(order.id)).toMatchObject({ paymentStatus: "FAILED", status: "PENDING" })
    expect(await handleIPN(failed)).toMatchObject({ RspCode: "02" }) // lặp lại: không xử lý lần hai

    expect(await handleIPN(vnpayCallback(order, { vnp_TxnRef: makeTxnRef(order.code, new Date(Date.now() + 5000)) }))).toMatchObject({ RspCode: "00" })
    expect(await reload(order.id)).toMatchObject({ paymentStatus: "PAID", status: "CONFIRMED" })
  })

  it("tiền về sau khi đơn đã bị huỷ thì không làm đơn sống lại (02)", async () => {
    const { order, v } = await makeVnpayOrder()
    await db.order.update({ where: { id: order.id }, data: { createdAt: minutesAgo(60) } })
    await expireUnpaidVnpayOrders()
    expect((await reload(order.id)).status).toBe("CANCELLED")

    expect(await handleIPN(vnpayCallback(order))).toMatchObject({ RspCode: "02" })
    expect(await reload(order.id)).toMatchObject({ status: "CANCELLED", paymentStatus: "FAILED" })
    expect(await fx.stockOf(v.id)).toBe(5)
  })
})

describe("verifyReturn", () => {
  it("báo thành công/thất bại để hiển thị nhưng KHÔNG ghi nhận thanh toán", async () => {
    const { order } = await makeVnpayOrder()

    const ok = verifyReturn(vnpayCallback(order))
    expect(ok).toMatchObject({ valid: true, success: true, orderCode: order.code })

    const cancelled = verifyReturn(vnpayCallback(order, { vnp_ResponseCode: "24" }))
    expect(cancelled).toMatchObject({ valid: true, success: false, message: "Bạn đã huỷ giao dịch" })

    expect(verifyReturn({ ...vnpayCallback(order), vnp_Amount: "1" })).toMatchObject({ valid: false, success: false })
    expect((await reload(order.id)).paymentStatus).toBe("PENDING") // chỉ IPN mới đổi trạng thái
  })
})

describe("expireUnpaidVnpayOrders", () => {
  it("huỷ đơn quá hạn chưa trả tiền và hoàn tồn kho; giữ nguyên đơn còn trong hạn", async () => {
    const stale = await makeVnpayOrder()
    const fresh = await makeVnpayOrder()
    expect(await fx.stockOf(stale.v.id)).toBe(4)
    await db.order.update({ where: { id: stale.order.id }, data: { createdAt: minutesAgo(30) } })

    const { cancelled } = await expireUnpaidVnpayOrders()

    expect(cancelled).toBeGreaterThanOrEqual(1)
    expect(await reload(stale.order.id)).toMatchObject({ status: "CANCELLED", paymentStatus: "FAILED" })
    expect(await fx.stockOf(stale.v.id)).toBe(5)
    expect(await reload(fresh.order.id)).toMatchObject({ status: "PENDING" })
    expect(await fx.stockOf(fresh.v.id)).toBe(4)

    // Chạy lại không hoàn kho lần hai.
    await expireUnpaidVnpayOrders()
    expect(await fx.stockOf(stale.v.id)).toBe(5)
  })

  it("không bao giờ huỷ đơn đã thanh toán, dù đã quá hạn", async () => {
    const { order, v } = await makeVnpayOrder()
    await handleIPN(vnpayCallback(order))
    await db.order.update({ where: { id: order.id }, data: { createdAt: minutesAgo(120) } })

    await expireUnpaidVnpayOrders()

    expect(await reload(order.id)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" })
    expect(await fx.stockOf(v.id)).toBe(4)
  })

  it("IPN thành công và job hết hạn chạy ĐỒNG THỜI: kết quả luôn nhất quán (đã trả tiền + trừ kho, hoặc huỷ + hoàn kho)", async () => {
    const { order, v } = await makeVnpayOrder()
    await db.order.update({ where: { id: order.id }, data: { createdAt: minutesAgo(60) } })

    await Promise.all([handleIPN(vnpayCallback(order)), expireUnpaidVnpayOrders()])

    const final = await reload(order.id)
    const stock = await fx.stockOf(v.id)
    const paid = final.paymentStatus === "PAID" && final.status === "CONFIRMED" && stock === 4
    const cancelled = final.status === "CANCELLED" && final.paymentStatus !== "PAID" && stock === 5
    expect(paid || cancelled).toBe(true)
  })
})

