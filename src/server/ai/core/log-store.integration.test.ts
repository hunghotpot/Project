import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import { buildLogRow } from "./log"
import { purgeChatLogs, writeChatLog } from "./log-store"

/* Chạy trên PostgreSQL thật. Dùng một user riêng và dọn sạch dòng của nó, không đụng nhật ký thật. */

const email = `log-test-${Date.now()}@example.test`
let userId = ""

const base = { userId: "", model: "m", status: "ok" as const, retries: 0, latencyMs: 10, tokensIn: 1, tokensOut: 1, tools: [], userText: "hỏi", replyText: "đáp" }

beforeAll(async () => {
  userId = (await db.user.create({ data: { email, passwordHash: "x", name: "Log Test" } })).id
})
afterAll(async () => {
  await db.user.deleteMany({ where: { id: userId } }) // xoá user kéo theo nhật ký (onDelete: Cascade)
})

describe("nhật ký chat trong DB", () => {
  it("ghi một dòng; mức 0 không có nội dung, mức 2 có", async () => {
    await writeChatLog(buildLogRow(0, { ...base, userId }))
    await writeChatLog(buildLogRow(2, { ...base, userId, tools: [{ name: "viewCart", ok: true, ms: 5, input: {} }] }))
    const rows = await db.aiChatLog.findMany({ where: { userId }, orderBy: { level: "asc" } })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ level: 0, userText: null, params: null })
    expect(rows[1]).toMatchObject({ level: 2, userText: "hỏi", replyText: "đáp", tools: [{ name: "viewCart", ok: true, ms: 5 }] })
  })

  it("purge: xoá nội dung/tham số cũ, xoá hẳn dòng rất cũ, giữ dòng mới", async () => {
    const now = new Date()
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)
    const row = (createdAt: Date) => ({ ...buildLogRow(2, { ...base, userId, tools: [{ name: "t", ok: true, ms: 1, input: { a: 1 } }] }), createdAt })
    const mk = (r: ReturnType<typeof row>) => db.aiChatLog.create({ data: { ...r, tools: r.tools, params: (r.params ?? undefined) as never } })
    const fresh = await mk(row(ago(1)))
    const mid = await mk(row(ago(30)))
    const old = await mk(row(ago(100)))
    await purgeChatLogs({ now })
    expect(await db.aiChatLog.findUnique({ where: { id: fresh.id } })).toMatchObject({ userText: "hỏi", replyText: "đáp" })
    const scrubbed = await db.aiChatLog.findUnique({ where: { id: mid.id } })
    expect(scrubbed).toMatchObject({ userText: null, replyText: null, params: null, tools: [{ name: "t" }] })
    expect(await db.aiChatLog.findUnique({ where: { id: old.id } })).toBeNull()
  })
})
