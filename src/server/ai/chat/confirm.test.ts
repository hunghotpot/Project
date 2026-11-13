import { describe, expect, it, vi } from "vitest"
import { CartError } from "@/server/services/cart.service"
import { createConfirmationStore } from "../core/confirmations"
import { createRateLimiter } from "../core/rate-limit"
import { handleConfirm } from "./confirm"

/* Không gọi DB hay Redis: kho xác nhận và bộ giới hạn dùng bộ nhớ, bước ghi giỏ được giả để đếm số lần gọi. */

const uid = () => `u${Math.random().toString(36).slice(2, 10)}`
const pending = { kind: "addToCart" as const, variantId: "v1", quantity: 2 }
const cart = { itemCount: 3, subtotal: 600000, items: [] }

function setup(addItem = vi.fn(async () => cart)) {
  const confirmations = createConfirmationStore(undefined)
  const limiter = createRateLimiter(undefined)
  const run = (userId: string, confirmationId: string, action: "confirm" | "cancel" = "confirm") =>
    handleConfirm(userId, { confirmationId, action }, { confirmations, limiter, addItem: addItem as never })
  return { confirmations, limiter, addItem, run }
}

describe("handleConfirm (pha 2 của tool ghi)", () => {
  it("khách xác nhận: ghi đúng biến thể và số lượng đã được server kiểm, bằng userId của phiên", async () => {
    const { confirmations, addItem, run } = setup()
    const user = uid()
    const { id } = await confirmations.create(user, pending)
    const res = await run(user, id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: "added", itemCount: 3, subtotal: 600000 })
    expect(addItem).toHaveBeenCalledTimes(1)
    expect(addItem).toHaveBeenCalledWith({ userId: user }, "v1", 2)
  })

  it("dùng một lần: bấm lại hoặc phát lại cùng id thì 410 và KHÔNG ghi thêm", async () => {
    const { confirmations, addItem, run } = setup()
    const user = uid()
    const { id } = await confirmations.create(user, pending)
    expect((await run(user, id)).status).toBe(200)
    const replay = await run(user, id)
    expect(replay.status).toBe(410)
    expect((await replay.json()).error.code).toBe("CONFIRMATION_INVALID")
    expect(addItem).toHaveBeenCalledTimes(1)
  })

  it("id của người khác: 410, không ghi, và bản ghi của chủ vẫn dùng được", async () => {
    const { confirmations, addItem, run } = setup()
    const owner = uid()
    const { id } = await confirmations.create(owner, pending)
    expect((await run(uid(), id)).status).toBe(410)
    expect(addItem).not.toHaveBeenCalled()
    expect((await run(owner, id)).status).toBe(200)
  })

  it("id không có hoặc đã hết hạn: 410, không ghi", async () => {
    const { addItem, run } = setup()
    expect((await run(uid(), "0".repeat(32))).status).toBe(410)
    expect(addItem).not.toHaveBeenCalled()
  })

  it("khách huỷ: 200, không ghi, và id không dùng lại được", async () => {
    const { confirmations, addItem, run } = setup()
    const user = uid()
    const { id } = await confirmations.create(user, pending)
    const res = await run(user, id, "cancel")
    expect(await res.json()).toEqual({ ok: true, status: "cancelled" })
    expect(addItem).not.toHaveBeenCalled()
    expect((await run(user, id)).status).toBe(410)
    expect(addItem).not.toHaveBeenCalled()
  })

  it("huỷ id không có vẫn 200 (không lộ id có tồn tại hay không)", async () => {
    const { run } = setup()
    expect((await run(uid(), "f".repeat(32), "cancel")).status).toBe(200)
  })

  it("hết hàng sau khi thẻ hiện: 409 với đúng lý do của cart.service; id đã bị dùng nên không thử lại được", async () => {
    const addItem = vi.fn(async () => {
      throw new CartError("INSUFFICIENT_STOCK", "Chỉ còn 1 sản phẩm", 1)
    })
    const { confirmations, run } = setup(addItem)
    const user = uid()
    const { id } = await confirmations.create(user, pending)
    const res = await run(user, id)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toEqual({ code: "INSUFFICIENT_STOCK", message: "Chỉ còn 1 sản phẩm" })
    expect((await run(user, id)).status).toBe(410)
    expect(addItem).toHaveBeenCalledTimes(1)
  })

  it("lỗi bất ngờ: 500 với câu chung, không lộ chi tiết", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const addItem = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432")
    })
    const { confirmations, run } = setup(addItem)
    const user = uid()
    const { id } = await confirmations.create(user, pending)
    const res = await run(user, id)
    log.mockRestore()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/)
  })

  it("giới hạn 20 thao tác mỗi phút cho mỗi người", async () => {
    const { run } = setup()
    const user = uid()
    for (let i = 0; i < 20; i++) expect((await run(user, "0".repeat(32), "cancel")).status).toBe(200)
    expect((await run(user, "0".repeat(32), "cancel")).status).toBe(429)
    expect((await run(uid(), "0".repeat(32), "cancel")).status).toBe(200)
  })
})
