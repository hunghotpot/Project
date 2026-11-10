import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  buildPaymentUrl,
  formatVnpDate,
  makeTxnRef,
  normalizeIp,
  orderCodeFromTxnRef,
  sign,
  sortedQuery,
  toVnpParams,
  verifySignature,
} from "./vnpay"

const SECRET = "TEST-SECRET-0123456789"

describe("sortedQuery / sign", () => {
  it("sắp xếp theo key và encode giá trị như code mẫu VNPay (khoảng trắng → +, ký tự đặc biệt → %XX)", () => {
    const q = sortedQuery({ vnp_B: "a b", vnp_A: "x&y=z", vnp_C: "Việt" })
    expect(q).toBe("vnp_A=x%26y%3Dz&vnp_B=a+b&vnp_C=Vi%E1%BB%87t")
  })

  it("ký HMAC-SHA512 trên chuỗi đã sắp xếp, bỏ vnp_SecureHash và tham số không phải vnp_", () => {
    const params = { vnp_Amount: "1000000", vnp_TxnRef: "ABC", vnp_SecureHash: "bo-qua", other: "bo-qua" }
    const expected = createHmac("sha512", SECRET).update("vnp_Amount=1000000&vnp_TxnRef=ABC").digest("hex")
    expect(sign(params, SECRET)).toBe(expected)
    expect(sign(params, SECRET)).toHaveLength(128)
  })
})

describe("verifySignature", () => {
  const params = { vnp_Amount: "43000000", vnp_ResponseCode: "00", vnp_TxnRef: "FS202611100011T1" }
  const signed = { ...params, vnp_SecureHash: sign(params, SECRET) }

  it("chấp nhận chữ ký đúng (kể cả chữ hoa/thường)", () => {
    expect(verifySignature(signed, SECRET)).toBe(true)
    expect(verifySignature({ ...signed, vnp_SecureHash: signed.vnp_SecureHash.toUpperCase() }, SECRET)).toBe(true)
  })

  it("từ chối khi sửa số tiền, sai secret, thiếu hoặc rác chữ ký", () => {
    expect(verifySignature({ ...signed, vnp_Amount: "100" }, SECRET)).toBe(false)
    expect(verifySignature(signed, "secret-khac")).toBe(false)
    expect(verifySignature(params, SECRET)).toBe(false)
    expect(verifySignature({ ...signed, vnp_SecureHash: "abc" }, SECRET)).toBe(false)
  })

  it("không bị lừa bởi tham số lạ thêm vào (không tham gia chữ ký)", () => {
    expect(verifySignature({ ...signed, utm_source: "x" }, SECRET)).toBe(true)
  })
})

describe("buildPaymentUrl", () => {
  it("URL có tham số sắp xếp và vnp_SecureHash ở cuối, khớp với sign()", () => {
    const params = { vnp_TmnCode: "T1", vnp_Amount: "100", vnp_OrderInfo: "Thanh toan don FS-1" }
    const url = new URL(buildPaymentUrl("https://sandbox.example/pay", params, SECRET))
    expect(url.origin + url.pathname).toBe("https://sandbox.example/pay")
    expect(url.search.startsWith("?vnp_Amount=100&vnp_OrderInfo=Thanh+toan+don+FS-1&vnp_TmnCode=T1&vnp_SecureHash=")).toBe(true)
    expect(verifySignature(toVnpParams(url.searchParams), SECRET)).toBe(true)
  })
})

describe("ngày, mã giao dịch, IP", () => {
  it("formatVnpDate theo giờ Việt Nam (UTC+7)", () => {
    expect(formatVnpDate(new Date("2026-11-10T00:05:09Z"))).toBe("20261110070509")
    expect(formatVnpDate(new Date("2026-11-09T20:00:00Z"))).toBe("20261110030000")
  })

  it("TxnRef đọc ngược được về mã đơn và khác nhau giữa các lần thanh toán", () => {
    const a = makeTxnRef("FS-20261110-0011", new Date("2026-11-10T01:00:00Z"))
    const b = makeTxnRef("FS-20261110-0011", new Date("2026-11-10T01:00:05Z"))
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9]+$/)
    expect(orderCodeFromTxnRef(a)).toBe("FS-20261110-0011")
    expect(orderCodeFromTxnRef(makeTxnRef("FS-20261110-12345", new Date()))).toBe("FS-20261110-12345")
  })

  it("TxnRef lạ/thiếu → null", () => {
    expect(orderCodeFromTxnRef("abc")).toBeNull()
    expect(orderCodeFromTxnRef(undefined)).toBeNull()
  })

  it("normalizeIp đổi ::1 và ::ffff:x về IPv4", () => {
    expect(normalizeIp("::1")).toBe("127.0.0.1")
    expect(normalizeIp("::ffff:10.0.0.5")).toBe("10.0.0.5")
    expect(normalizeIp("203.0.113.7")).toBe("203.0.113.7")
    expect(normalizeIp(null)).toBe("127.0.0.1")
  })
})
