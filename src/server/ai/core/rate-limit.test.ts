import { afterAll, describe, expect, it, vi } from "vitest"
import { createRateLimiter } from "./rate-limit"

/*
 * Bộ nhớ: không cần Redis. Redis thật: dùng container `fashion-redis` (npm run db:up), tự bỏ qua nếu không kết nối được.
 * Đường lui: trỏ tới cổng không có Redis để kiểm tra vẫn giới hạn được.
 */

const unique = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

describe("giới hạn tốc độ (bộ nhớ)", () => {
  const limiter = createRateLimiter(undefined)

  it("cho phép tới giới hạn rồi chặn, báo số giây phải chờ", async () => {
    const key = unique()
    const t0 = 1_000_000
    for (let i = 1; i <= 3; i++) {
      const r = await limiter.consume(key, 3, 60, t0)
      expect(r).toEqual({ allowed: true, remaining: 3 - i, retryAfterSeconds: 0 })
    }
    const blocked = await limiter.consume(key, 3, 60, t0 + 10_000)
    expect(blocked).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 50 })
  })

  it("hết cửa sổ thì đếm lại từ đầu", async () => {
    const key = unique()
    const t0 = 5_000_000
    await limiter.consume(key, 1, 60, t0)
    expect((await limiter.consume(key, 1, 60, t0 + 1000)).allowed).toBe(false)
    expect((await limiter.consume(key, 1, 60, t0 + 61_000)).allowed).toBe(true)
  })

  it("mỗi khoá đếm riêng", async () => {
    const a = unique()
    const b = unique()
    await limiter.consume(a, 1, 60)
    expect((await limiter.consume(a, 1, 60)).allowed).toBe(false)
    expect((await limiter.consume(b, 1, 60)).allowed).toBe(true)
  })

  it("ngân sách token: cộng dồn trong ngày, ngày khác tính riêng", async () => {
    const user = unique()
    const day1 = Date.UTC(2026, 10, 13, 5, 0, 0)
    const day2 = day1 + 24 * 60 * 60 * 1000
    expect(await limiter.tokensUsedToday(user, day1)).toBe(0)
    await limiter.addTokens(user, 300, day1)
    await limiter.addTokens(user, 200.4, day1)
    expect(await limiter.tokensUsedToday(user, day1)).toBe(500)
    expect(await limiter.tokensUsedToday(user, day2)).toBe(0)
  })

  it("tổng toàn hệ thống: cộng token của mọi người dùng, ngày khác tính riêng", async () => {
    const own = createRateLimiter(undefined) // bộ đếm riêng để tổng không lẫn với các test khác
    const day1 = Date.UTC(2026, 10, 13, 5, 0, 0)
    await own.addTokens(unique(), 300, day1)
    await own.addTokens(unique(), 200, day1)
    expect(await own.totalTokensToday(day1)).toBe(500)
    expect(await own.totalTokensToday(day1 + 24 * 60 * 60 * 1000)).toBe(0)
  })

  it("bỏ qua số token không hợp lệ", async () => {
    const user = unique()
    await limiter.addTokens(user, 0)
    await limiter.addTokens(user, -5)
    await limiter.addTokens(user, Number.NaN)
    expect(await limiter.tokensUsedToday(user)).toBe(0)
  })
})

describe("giới hạn tốc độ (Redis thật)", async () => {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379"
  const probe = createRateLimiter(url)
  const reachable = await probe.consume(`probe:${unique()}`, 1, 5).then(
    async () => {
      // consume rơi về bộ nhớ khi Redis lỗi, nên kiểm tra thẳng bằng một kết nối riêng.
      const { default: Redis } = await import("ioredis")
      const r = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, connectTimeout: 800 })
      r.on("error", () => {})
      try {
        await r.connect()
        return (await r.ping()) === "PONG"
      } catch {
        return false
      } finally {
        r.disconnect()
      }
    },
    () => false,
  )
  await probe.close()

  const limiter = createRateLimiter(url)
  afterAll(() => limiter.close())

  it.skipIf(!reachable)("đếm trên Redis, chặn khi vượt, khoá tự hết hạn", async () => {
    const key = unique()
    expect((await limiter.consume(key, 2, 2)).allowed).toBe(true)
    expect((await limiter.consume(key, 2, 2)).allowed).toBe(true)
    const blocked = await limiter.consume(key, 2, 2)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(2)
    await new Promise((r) => setTimeout(r, 2200))
    expect((await limiter.consume(key, 2, 2)).allowed).toBe(true)
  })

  it.skipIf(!reachable)("ngân sách token trên Redis cộng dồn qua hai lần ghi", async () => {
    const user = unique()
    await limiter.addTokens(user, 120)
    await limiter.addTokens(user, 80)
    expect(await limiter.tokensUsedToday(user)).toBe(200)
  })
})

describe("giới hạn tốc độ (Redis không dùng được)", () => {
  it("vẫn giới hạn bằng bộ nhớ và chỉ cảnh báo một lần", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const limiter = createRateLimiter("redis://127.0.0.1:1") // cổng không có Redis
    const key = unique()
    expect((await limiter.consume(key, 1, 60)).allowed).toBe(true)
    expect((await limiter.consume(key, 1, 60)).allowed).toBe(false)
    await limiter.addTokens(key, 50)
    expect(await limiter.tokensUsedToday(key)).toBe(50)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    await limiter.close()
  })
})
