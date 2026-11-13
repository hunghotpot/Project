import { describe, expect, it } from "vitest"
import { parseAiEnv } from "./env"

const VALID = {
  AI_ENABLED: "true",
  AI_PROVIDER: "ollama",
  AI_CHAT_MODEL: "qwen3:4b",
  AI_EMBEDDING_PROVIDER: "ollama",
  AI_EMBEDDING_MODEL: "bge-m3",
  AI_EMBEDDING_DIMENSIONS: "1024",
}

describe("parseAiEnv", () => {
  it("tắt AI khi AI_ENABLED không phải true, kể cả khi cấu hình đủ", () => {
    expect(parseAiEnv({ ...VALID, AI_ENABLED: "false" })).toMatchObject({ enabled: false })
    expect(parseAiEnv({ ...VALID, AI_ENABLED: undefined })).toMatchObject({ enabled: false })
    expect(parseAiEnv({})).toMatchObject({ enabled: false })
  })

  it("bật AI với cấu hình tối thiểu và dùng giá trị mặc định cho Ollama local", () => {
    const status = parseAiEnv(VALID)
    expect(status).toMatchObject({ enabled: true })
    if (!status.enabled) return
    expect(status.config).toMatchObject({
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      chatModel: "qwen3:4b",
      fastModel: "qwen3:4b",
      embeddingModel: "bge-m3",
      embeddingDimensions: 1024,
      timeoutMs: 60_000,
      maxInputChars: 1000,
      maxOutputTokens: 800,
      maxToolSteps: 3,
      logLevel: 0,
    })
    expect(status.config.rateLimitPerMinute).toBeUndefined()
  })

  it("đọc đủ giá trị tuỳ chọn, bỏ dấu / cuối ở địa chỉ, fastModel riêng nếu có", () => {
    const status = parseAiEnv({
      ...VALID,
      AI_BASE_URL: "http://192.168.1.5:11434/",
      AI_FAST_MODEL: "qwen3:1.7b",
      AI_REQUEST_TIMEOUT_MS: "90000",
      AI_MAX_TOOL_STEPS: "4",
      AI_RATE_LIMIT_PER_MINUTE: "10",
      AI_LOG_LEVEL: "1",
    })
    if (!status.enabled) throw new Error(status.reason)
    expect(status.config).toMatchObject({
      baseUrl: "http://192.168.1.5:11434",
      fastModel: "qwen3:1.7b",
      timeoutMs: 90_000,
      maxToolSteps: 4,
      rateLimitPerMinute: 10,
      logLevel: 1,
    })
  })

  it("coi chuỗi rỗng như chưa đặt (giống .env.example)", () => {
    const status = parseAiEnv({ ...VALID, AI_BASE_URL: "", AI_FAST_MODEL: "  ", AI_RATE_LIMIT_PER_MINUTE: "" })
    if (!status.enabled) throw new Error(status.reason)
    expect(status.config.baseUrl).toBe("http://localhost:11434")
    expect(status.config.fastModel).toBe("qwen3:4b")
  })

  it("tự tắt và nêu lý do khi thiếu model hoặc số chiều, không ném lỗi", () => {
    for (const missing of ["AI_PROVIDER", "AI_CHAT_MODEL", "AI_EMBEDDING_PROVIDER", "AI_EMBEDDING_MODEL", "AI_EMBEDDING_DIMENSIONS"]) {
      const status = parseAiEnv({ ...VALID, [missing]: undefined })
      expect(status.enabled, missing).toBe(false)
      if (!status.enabled) expect(status.reason, missing).toContain(missing)
    }
  })

  it("tự tắt khi giá trị sai: nhà cung cấp lạ, số không hợp lệ, URL hỏng", () => {
    expect(parseAiEnv({ ...VALID, AI_PROVIDER: "openai" }).enabled).toBe(false)
    expect(parseAiEnv({ ...VALID, AI_EMBEDDING_DIMENSIONS: "abc" }).enabled).toBe(false)
    expect(parseAiEnv({ ...VALID, AI_EMBEDDING_DIMENSIONS: "0" }).enabled).toBe(false)
    expect(parseAiEnv({ ...VALID, AI_MAX_TOOL_STEPS: "-1" }).enabled).toBe(false)
    expect(parseAiEnv({ ...VALID, AI_BASE_URL: "not a url" }).enabled).toBe(false)
    expect(parseAiEnv({ ...VALID, AI_LOG_LEVEL: "5" }).enabled).toBe(false)
  })

  it("lý do không lặp lại giá trị cấu hình (không lộ chuỗi nhạy cảm)", () => {
    const status = parseAiEnv({ ...VALID, AI_BASE_URL: "http://user:secret-token@bad host" })
    expect(status.enabled).toBe(false)
    if (!status.enabled) expect(status.reason).not.toContain("secret-token")
  })
})
