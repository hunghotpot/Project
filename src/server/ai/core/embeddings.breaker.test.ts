import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AiConfig } from "./env"

const embedMany = vi.fn()
vi.mock("ai", () => ({ embedMany: (...a: unknown[]) => embedMany(...a) }))
vi.mock("./models", () => ({ createAiModels: () => ({ embedding: {} }) }))

import { CircuitOpenError, getBreaker, resetBreakers } from "./breaker"
import { embedTexts } from "./embeddings"

const config = { timeoutMs: 1000, embeddingDimensions: 2 } as AiConfig
const good = { embeddings: [[0.1, 0.2]] }

beforeEach(() => {
  resetBreakers()
  embedMany.mockReset()
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("embedTexts + circuit breaker", () => {
  it("5 lỗi liên tiếp: lời gọi sau ném CircuitOpenError ngay, không gọi model", async () => {
    embedMany.mockRejectedValue(new Error("ECONNREFUSED"))
    for (let i = 0; i < 5; i++) await expect(embedTexts(["a"], config)).rejects.toThrow("ECONNREFUSED")
    embedMany.mockClear()
    await expect(embedTexts(["a"], config)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(embedMany).not.toHaveBeenCalled()
  })

  it("thành công xen giữa xoá chuỗi lỗi", async () => {
    embedMany.mockRejectedValue(new Error("x"))
    for (let i = 0; i < 4; i++) await expect(embedTexts(["a"], config)).rejects.toThrow()
    embedMany.mockResolvedValueOnce(good)
    await embedTexts(["a"], config)
    embedMany.mockRejectedValue(new Error("x"))
    await expect(embedTexts(["a"], config)).rejects.toThrow("x")
    expect(getBreaker("embedding").current).toBe("closed")
  })

  it("sai số chiều là lỗi cấu hình: không tính vào breaker", async () => {
    embedMany.mockResolvedValue({ embeddings: [[1, 2, 3]] })
    for (let i = 0; i < 6; i++) await expect(embedTexts(["a"], config)).rejects.toThrow("chiều")
    expect(getBreaker("embedding").current).toBe("closed")
  })

  it("danh sách rỗng: không đụng tới model hay breaker", async () => {
    expect(await embedTexts([], config)).toEqual([])
    expect(embedMany).not.toHaveBeenCalled()
  })

  it("breaker của embedding độc lập với breaker của chat", async () => {
    embedMany.mockRejectedValue(new Error("x"))
    for (let i = 0; i < 5; i++) await expect(embedTexts(["a"], config)).rejects.toThrow()
    expect(getBreaker("chat").allow().allowed).toBe(true)
  })
})
