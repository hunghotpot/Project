import { describe, expect, it } from "vitest"
import { buildVietQrPayload, crc16 } from "./vietqr"

describe("crc16", () => {
  it("khớp vector chuẩn CRC-16/CCITT-FALSE của '123456789' (0x29B1)", () => {
    expect(crc16("123456789")).toBe("29B1")
  })
})

describe("buildVietQrPayload", () => {
  const payload = buildVietQrPayload({ bankBin: "970422", accountNo: "0123456789", amount: 430000, content: "FS202611090001" })

  it("có đủ các trường bắt buộc theo đúng thứ tự TLV", () => {
    expect(payload.startsWith("000201010212")).toBe(true)
    expect(payload).toContain("38") // tài khoản thụ hưởng
    expect(payload).toContain("0010A000000727") // GUI NAPAS
    expect(payload).toContain("00069704220110" + "0123456789") // BIN + số tài khoản
    expect(payload).toContain("QRIBFTTA")
    expect(payload).toContain("5303704") // VND
  })

  it("số tiền và nội dung được mã hoá đúng độ dài", () => {
    expect(payload).toContain("5406430000")
    expect(payload).toContain("62180814FS202611090001")
    expect(payload).toContain("5802VN")
  })

  it("kết thúc bằng 6304 + CRC hợp lệ của phần còn lại", () => {
    const body = payload.slice(0, -4)
    expect(body.endsWith("6304")).toBe(true)
    expect(payload.slice(-4)).toBe(crc16(body))
  })
})
