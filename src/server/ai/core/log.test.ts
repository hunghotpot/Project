import { tool } from "ai"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { buildLogRow, traceTools, type ToolTrace, type TurnLog } from "./log"

const turn: TurnLog = {
  userId: "u1",
  model: "qwen3:4b-instruct",
  status: "ok",
  retries: 1,
  latencyMs: 1234.6,
  ttftMs: 400.2,
  tokensIn: 100,
  tokensOut: 50,
  tools: [
    { name: "searchProducts", ok: true, ms: 12.4, input: { query: "áo", text: "mail a@b.co sdt 0987654321", email: "x@y.z" } },
    { name: "addToCart", ok: false, code: "NEED_SIZE_OR_COLOR", ms: 3, input: { product: "áo" } },
  ],
  userText: "mình là a@b.co, gọi 0987654321",
  replyText: "Bạn muốn size nào?",
}

describe("buildLogRow: mức log", () => {
  it("mức 0: số liệu + tên tool và kết quả; không tham số, không nội dung", () => {
    const row = buildLogRow(0, turn)
    expect(row).toMatchObject({ level: 0, latencyMs: 1235, ttftMs: 400, tokensIn: 100, tokensOut: 50, retries: 1, claim: null, error: null })
    expect(row.tools).toEqual([
      { name: "searchProducts", ok: true, ms: 12 },
      { name: "addToCart", ok: false, code: "NEED_SIZE_OR_COLOR", ms: 3 },
    ])
    expect(row.params).toBeNull()
    expect(row.userText).toBeNull()
    expect(row.replyText).toBeNull()
  })

  it("mức 1: thêm tham số đã che PII (bỏ trường nhạy cảm, che email/SĐT trong chuỗi), vẫn không có nội dung", () => {
    const row = buildLogRow(1, turn)
    expect(row.params).toEqual([
      { name: "searchProducts", input: { query: "áo", text: "mail [email] sdt [sđt]" } },
      { name: "addToCart", input: { product: "áo" } },
    ])
    expect(row.userText).toBeNull()
    expect(row.replyText).toBeNull()
  })

  it("mức 2: thêm toàn văn đã che PII", () => {
    const row = buildLogRow(2, turn)
    expect(row.userText).toBe("mình là [email], gọi [sđt]")
    expect(row.replyText).toBe("Bạn muốn size nào?")
  })

  it("không mức nào để lọt email hay số điện thoại", () => {
    for (const level of [0, 1, 2] as const) {
      const json = JSON.stringify(buildLogRow(level, turn))
      expect(json).not.toMatch(/a@b\.co|x@y\.z|0987654321/)
    }
  })

  it("lỗi: chỉ lấy dòng đầu và che PII; ttft vắng thì null", () => {
    const row = buildLogRow(0, { ...turn, ttftMs: undefined, error: "connect ECONNREFUSED 127.0.0.1:11434\n    at stack...", status: "error" })
    expect(row.error).toBe("connect ECONNREFUSED 127.0.0.1:11434")
    expect(row.ttftMs).toBeNull()
  })

  it("cắt văn bản rất dài ở mức 2", () => {
    const row = buildLogRow(2, { ...turn, userText: "x".repeat(10_000) })
    expect(row.userText!.length).toBeLessThanOrEqual(4001)
  })
})

describe("traceTools", () => {
  const tools = {
    ok: tool({ description: "d", inputSchema: z.object({ a: z.string() }), execute: async () => ({ ok: true as const, n: 1 }) }),
    fail: tool({ description: "d", inputSchema: z.object({ x: z.string().optional() }), execute: async (input: { x?: string }) => (void input, { ok: false as const, code: "NOPE", message: "m" }) }),
    boom: tool({
      description: "d",
      inputSchema: z.object({ x: z.string().optional() }),
      execute: async (input: { x?: string }): Promise<{ ok: true }> => {
        void input
        throw new Error("x")
      },
    }),
  }
  const run = (traced: ReturnType<typeof traceTools>, name: string, input: unknown) =>
    (traced[name].execute as (i: unknown, o: unknown) => Promise<unknown>)(input, { toolCallId: "c", messages: [] })

  it("ghi tên, tham số, kết quả; trả nguyên kết quả của tool", async () => {
    const traces: ToolTrace[] = []
    const traced = traceTools(tools, traces)
    expect(await run(traced, "ok", { a: "x" })).toEqual({ ok: true, n: 1 })
    expect(await run(traced, "fail", {})).toEqual({ ok: false, code: "NOPE", message: "m" })
    expect(traces).toEqual([
      expect.objectContaining({ name: "ok", ok: true, input: { a: "x" } }),
      expect.objectContaining({ name: "fail", ok: false, code: "NOPE" }),
    ])
    expect(traces[0].ms).toBeGreaterThanOrEqual(0)
  })

  it("tool ném lỗi: ghi THROWN và ném lại nguyên lỗi", async () => {
    const traces: ToolTrace[] = []
    await expect(run(traceTools(tools, traces), "boom", {})).rejects.toThrow("x")
    expect(traces).toEqual([expect.objectContaining({ name: "boom", ok: false, code: "THROWN" })])
  })

  it("giữ nguyên tên tool và schema (model thấy cùng tập tool)", () => {
    const traced = traceTools(tools, [])
    expect(Object.keys(traced)).toEqual(Object.keys(tools))
    expect(traced.ok.inputSchema).toBe(tools.ok.inputSchema)
  })
})
