import { afterAll, describe, expect, it, vi } from "vitest"
import { CONFIRMATION_TTL_SECONDS, createConfirmationStore } from "./confirmations"

/*
 * Bộ nhớ: không cần Redis. Redis thật: container `fashion-redis` (npm run db:up), tự bỏ qua nếu không kết nối được.
 * Đường lui: trỏ tới cổng không có Redis để kiểm tra vẫn dùng được.
 */

const unique = () => `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const pending = { kind: "addToCart" as const, variantId: "v1", quantity: 2 }

function behaviour(name: string, make: () => ReturnType<typeof createConfirmationStore>) {
  describe(name, () => {
    const store = make()
    afterAll(() => store.close())

    it("tạo rồi lấy ra đúng nội dung, id ngẫu nhiên 128 bit", async () => {
      const user = unique()
      const a = await store.create(user, pending)
      const b = await store.create(user, pending)
      expect(a.id).toMatch(/^[0-9a-f]{32}$/)
      expect(a.id).not.toBe(b.id)
      expect(a.expiresInSeconds).toBe(CONFIRMATION_TTL_SECONDS)
      expect(await store.consume(user, a.id)).toEqual(pending)
    })

    it("dùng một lần: lấy lần hai là null (chống phát lại)", async () => {
      const user = unique()
      const { id } = await store.create(user, pending)
      expect(await store.consume(user, id)).toEqual(pending)
      expect(await store.consume(user, id)).toBeNull()
    })

    it("chỉ đúng người dùng lấy được; người khác biết id cũng không lấy được và không làm mất bản ghi", async () => {
      const owner = unique()
      const { id } = await store.create(owner, pending)
      expect(await store.consume(unique(), id)).toBeNull()
      expect(await store.consume(owner, id)).toEqual(pending)
    })

    it("id không có hoặc rác thì null", async () => {
      expect(await store.consume(unique(), "khong-co")).toBeNull()
      expect(await store.consume(unique(), "")).toBeNull()
    })
  })
}

behaviour("kho xác nhận (bộ nhớ)", () => createConfirmationStore(undefined))

describe("kho xác nhận (bộ nhớ): hết hạn", () => {
  it("quá thời hạn thì không lấy được nữa", async () => {
    const store = createConfirmationStore(undefined)
    const user = unique()
    const t0 = 1_000_000
    const { id } = await store.create(user, pending, t0)
    expect(await store.consume(user, id, t0 + CONFIRMATION_TTL_SECONDS * 1000 + 1)).toBeNull()
  })

  it("còn hạn thì lấy được", async () => {
    const store = createConfirmationStore(undefined)
    const user = unique()
    const t0 = 1_000_000
    const { id } = await store.create(user, pending, t0)
    expect(await store.consume(user, id, t0 + 60_000)).toEqual(pending)
  })
})

describe("kho xác nhận (Redis thật)", () => {
  const url = process.env.REDIS_URL
  const store = createConfirmationStore(url)
  afterAll(() => store.close())

  async function redisUp(): Promise<boolean> {
    if (!url) return false
    const probe = createConfirmationStore(url)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      // Nếu Redis không lên, create rơi về bộ nhớ và ghi một cảnh báo: dùng cảnh báo đó để biết.
      await probe.create(unique(), pending)
      return warn.mock.calls.length === 0
    } finally {
      warn.mockRestore()
      await probe.close()
    }
  }

  it("dùng một lần và gắn đúng người dùng trên Redis", async (ctx) => {
    if (!(await redisUp())) return ctx.skip()
    const owner = unique()
    const { id } = await store.create(owner, pending)
    expect(await store.consume(unique(), id)).toBeNull()
    expect(await store.consume(owner, id)).toEqual(pending)
    expect(await store.consume(owner, id)).toBeNull()
  })

  it("hai yêu cầu xác nhận đồng thời: chỉ một yêu cầu lấy được (nguyên tử)", async (ctx) => {
    if (!(await redisUp())) return ctx.skip()
    const owner = unique()
    const { id } = await store.create(owner, pending)
    const results = await Promise.all(Array.from({ length: 8 }, () => store.consume(owner, id)))
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})

describe("kho xác nhận: đường lui khi Redis không có", () => {
  it("vẫn tạo và lấy được bằng bộ nhớ, chỉ cảnh báo một lần", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const store = createConfirmationStore("redis://127.0.0.1:1")
    const user = unique()
    const { id } = await store.create(user, pending)
    expect(await store.consume(user, id)).toEqual(pending)
    await store.create(user, pending)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    await store.close()
  })
})
