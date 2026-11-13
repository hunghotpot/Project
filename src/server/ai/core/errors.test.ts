import { describe, expect, it } from "vitest"
import { z } from "zod"
import { AddressNotFoundError } from "@/server/services/address.service"
import { AuthError } from "@/server/services/auth.service"
import { CartError } from "@/server/services/cart.service"
import { OrderError } from "@/server/services/order.service"
import { toToolError } from "./errors"

describe("toToolError", () => {
  it("CartError: giữ mã và số lượng còn thêm được", () => {
    expect(toToolError(new CartError("INSUFFICIENT_STOCK", "Chỉ còn 2", 2))).toEqual({
      ok: false,
      code: "INSUFFICIENT_STOCK",
      message: "Chỉ còn 2",
      details: { available: 2 },
    })
    expect(toToolError(new CartError("OUT_OF_STOCK", "Hết hàng"))).toEqual({ ok: false, code: "OUT_OF_STOCK", message: "Hết hàng" })
  })

  it("OrderError: giữ mã và danh sách dòng thiếu hàng", () => {
    const shortages = [{ variantId: "v1", productName: "Áo", requested: 3, available: 1 }] as never
    expect(toToolError(new OrderError("OUT_OF_STOCK", "Không đủ hàng", shortages))).toMatchObject({
      code: "OUT_OF_STOCK",
      details: { shortages },
    })
    expect(toToolError(new OrderError("ORDER_NOT_FOUND", "Không thấy đơn"))).toEqual({
      ok: false,
      code: "ORDER_NOT_FOUND",
      message: "Không thấy đơn",
    })
  })

  it("AuthError và AddressNotFoundError", () => {
    expect(toToolError(new AuthError("RATE_LIMITED", "Thử lại sau", undefined, 30))).toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfter: 30 },
    })
    expect(toToolError(new AddressNotFoundError())).toMatchObject({ ok: false, code: "ADDRESS_NOT_FOUND" })
  })

  it("ZodError: chỉ tên trường và lý do, không lộ giá trị nhập", () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: "bi-mat@x" })
    if (parsed.success) throw new Error("kỳ vọng lỗi")
    const out = toToolError(parsed.error)
    expect(out.code).toBe("INVALID_INPUT")
    expect(out.details).toEqual({ fields: [expect.objectContaining({ field: "email" })] })
    expect(JSON.stringify(out)).not.toContain("bi-mat")
  })

  it("hết thời gian và huỷ yêu cầu thành TIMEOUT", () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" })
    expect(toToolError(timeout).code).toBe("TIMEOUT")
    expect(toToolError(new DOMException("aborted", "AbortError")).code).toBe("TIMEOUT")
  })

  it("lỗi lạ chỉ trả mã chung, không lộ nội dung hay stack", () => {
    const secret = new Error("connect ECONNREFUSED postgres://user:pass@db/secret")
    const out = toToolError(secret)
    expect(out).toEqual({ ok: false, code: "INTERNAL", message: "Có lỗi xảy ra, bạn thử lại sau nhé" })
    expect(JSON.stringify(out)).not.toMatch(/postgres|pass|stack|ECONN/)
    expect(toToolError("chuỗi")).toMatchObject({ code: "INTERNAL" })
    expect(toToolError(null)).toMatchObject({ code: "INTERNAL" })
  })
})
