import { describe, expect, it } from "vitest"
import { redactForPrompt, redactText } from "./redact"

// Khẳng định trong docs/ai/05 mục 5: không chứa passwordHash|tokenHash|@|VNP_|Bearer.
const FORBIDDEN = /passwordHash|tokenHash|@|VNP_|Bearer\s+[A-Za-z0-9]/

describe("redactText", () => {
  it("che email, số điện thoại và token", () => {
    expect(redactText("liên hệ minh@example.com hoặc 0987654321")).toBe("liên hệ [email] hoặc [sđt]")
    expect(redactText("gọi +84 987 654 321 nhé")).toBe("gọi [sđt] nhé")
    expect(redactText("gọi 098-765-4321")).toBe("gọi [sđt]")
    expect(redactText("Authorization: Bearer abc.def-123")).toBe("Authorization: Bearer [ẩn]")
    expect(redactText("VNP_HASH_SECRET=abcdef")).toBe("[ẩn]")
  })

  it("không che giá tiền, mã đơn, size hay số đo", () => {
    for (const s of ["Áo 479.000 đ", "Đơn FS-20261110-0003", "size 32", "cao 170cm nặng 65kg", "500000", "1.200.000đ"]) {
      expect(redactText(s)).toBe(s)
    }
  })

  it("cắt chuỗi quá dài", () => {
    const out = redactText("a".repeat(700))
    expect(out).toHaveLength(601)
    expect(out.endsWith("…")).toBe(true)
  })
})

describe("redactForPrompt", () => {
  const user = {
    id: "u1",
    name: "Nguyễn Minh Anh",
    email: "customer@example.com",
    phone: "0987654321",
    role: "CUSTOMER",
    passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
    refreshToken: "rt-123",
  }

  it("bỏ trường nhạy cảm theo tên, giữ trường an toàn", () => {
    expect(redactForPrompt(user)).toEqual({ id: "u1", name: "Nguyễn Minh Anh", role: "CUSTOMER" })
  })

  it("đơn hàng: bỏ địa chỉ, ghi chú, liên hệ; giữ mã, trạng thái, tổng tiền, món hàng", () => {
    const order = {
      code: "FS-20261110-0003",
      status: "PENDING",
      total: 529000,
      createdAt: new Date("2026-11-10T03:00:00Z"),
      note: "gọi 0901234567 trước khi giao",
      address: { fullName: "Người Mua", phone: "0901234567", street: "1 Test", district: "Q1", province: "HCM" },
      items: [{ productName: "Áo thun", quantity: 2, price: 229000 }],
      contactEmail: "a@b.co",
    }
    const out = redactForPrompt(order)
    expect(out).toEqual({
      code: "FS-20261110-0003",
      status: "PENDING",
      total: 529000,
      createdAt: "2026-11-10T03:00:00.000Z",
      items: [{ productName: "Áo thun", quantity: 2, price: 229000 }],
    })
    expect(JSON.stringify(out)).not.toMatch(FORBIDDEN)
  })

  it("che PII lọt vào chuỗi tự do của sản phẩm (mô tả, tên)", () => {
    const out = redactForPrompt({ name: "Áo", description: "Liên hệ shop@abc.vn, 0912345678 để đặt" })
    expect(out.description).toBe("Liên hệ [email], [sđt] để đặt")
    expect(JSON.stringify(out)).not.toMatch(FORBIDDEN)
  })

  it("xử lý mảng lồng nhau, null và giá trị nguyên thuỷ", () => {
    expect(redactForPrompt([{ email: "x@y.z", ok: true, n: 1, nothing: null }, "0987654321"])).toEqual([
      { ok: true, n: 1, nothing: null },
      "[sđt]",
    ])
    expect(redactForPrompt(42)).toBe(42)
    expect(redactForPrompt(null)).toBeNull()
  })

  it("không đổi đối tượng gốc", () => {
    const original = { name: "A", email: "a@b.co" }
    redactForPrompt(original)
    expect(original).toEqual({ name: "A", email: "a@b.co" })
  })

  it("cắt độ sâu quá lớn thay vì đệ quy vô hạn", () => {
    type Node = { next?: Node; v: number }
    const root: Node = { v: 0 }
    let cur = root
    for (let i = 1; i < 20; i++) cur = cur.next = { v: i }
    expect(() => redactForPrompt(root)).not.toThrow()
  })
})
