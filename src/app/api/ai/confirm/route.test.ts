import { beforeEach, describe, expect, it, vi } from "vitest"

/* Tầng vào của route xác nhận: xác thực, cờ AI, validate. Handler và phiên được giả; không gọi DB hay Redis. */

const getCurrentUser = vi.fn()
const getAiStatus = vi.fn()
const handleConfirm = vi.fn(async () => Response.json({ ok: true }))

vi.mock("@/server/auth/session", () => ({ getCurrentUser: () => getCurrentUser() }))
vi.mock("@/server/ai/core/env", () => ({ getAiStatus: () => getAiStatus() }))
vi.mock("@/server/ai/chat/confirm", () => ({ handleConfirm: (...args: unknown[]) => handleConfirm(...(args as [])) }))

import { POST } from "./route"

const ID = "a".repeat(32)
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/ai/confirm", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUser.mockResolvedValue({ id: "u1", role: "CUSTOMER", email: "a@b.co", name: "A", phone: null })
  getAiStatus.mockReturnValue({ enabled: true, config: {} })
})

describe("POST /api/ai/confirm", () => {
  it("chưa đăng nhập: 401, không gọi handler", async () => {
    getCurrentUser.mockResolvedValue(null)
    const res = await post({ confirmationId: ID, action: "confirm" })
    expect(res.status).toBe(401)
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it("AI tắt: 503, không gọi handler", async () => {
    getAiStatus.mockReturnValue({ enabled: false, reason: "x" })
    expect((await post({ confirmationId: ID, action: "confirm" })).status).toBe(503)
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it("JSON hỏng hoặc sai schema: 400, không gọi handler", async () => {
    expect((await post("{hỏng")).status).toBe(400)
    for (const bad of [{}, { confirmationId: ID }, { confirmationId: "abc", action: "confirm" }, { confirmationId: ID, action: "delete" }, { confirmationId: "G".repeat(32), action: "confirm" }]) {
      expect((await post(bad)).status).toBe(400)
    }
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it("hợp lệ: chỉ truyền userId của phiên và dữ liệu đã validate (không lấy userId từ nội dung yêu cầu)", async () => {
    const res = await post({ confirmationId: ID, action: "cancel", userId: "attacker", variantId: "v-bịa", quantity: 99 })
    expect(res.status).toBe(200)
    expect(handleConfirm).toHaveBeenCalledTimes(1)
    expect(handleConfirm).toHaveBeenCalledWith("u1", { confirmationId: ID, action: "cancel" })
  })
})
