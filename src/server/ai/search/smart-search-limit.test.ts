import { describe, expect, it } from "vitest"
import { createRateLimiter } from "../core/rate-limit"
import { allowSmartSearch, SMART_SEARCH_LIMIT_PER_MINUTE } from "./smart-search-limit"

describe("allowSmartSearch", () => {
  it("cho đủ hạn mức mỗi phút rồi chặn; người khác không bị ảnh hưởng", async () => {
    const limiter = createRateLimiter(undefined)
    for (let i = 0; i < SMART_SEARCH_LIMIT_PER_MINUTE; i++) expect(await allowSmartSearch("u1", limiter)).toBe(true)
    expect(await allowSmartSearch("u1", limiter)).toBe(false)
    expect(await allowSmartSearch("u2", limiter)).toBe(true)
  })

  it("tách riêng với giới hạn chat của cùng người dùng", async () => {
    const limiter = createRateLimiter(undefined)
    for (let i = 0; i < 10; i++) await limiter.consume("chat:u1", 10, 60)
    expect((await limiter.consume("chat:u1", 10, 60)).allowed).toBe(false)
    expect(await allowSmartSearch("u1", limiter)).toBe(true)
  })
})
