import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/server/db"
import type { AiConfig } from "../core/env"

// Không gọi Ollama: embed trả vector 1024 chiều xác định theo nội dung.
vi.mock("../core/embeddings", async (importOriginal) => {
  const original = await importOriginal<typeof import("../core/embeddings")>()
  return {
    ...original,
    embedTexts: vi.fn(async (texts: string[]) => texts.map((t) => Array.from({ length: 1024 }, (_, j) => ((t.length + j) % 5) / 10))),
  }
})

import { embedTexts } from "../core/embeddings"
import { syncKnowledge } from "./knowledge-sync"

const embed = vi.mocked(embedTexts)
const config = { embeddingModel: "bge-m3", embeddingDimensions: 1024, timeoutMs: 1000 } as AiConfig
const RUN = `zz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const FILES = [
  { file: `${RUN}-a.md`, type: "care" as const },
  { file: `${RUN}-b.md`, type: "policy" as const },
]

const section = (title: string, body: string, meta = "{}") => `## ${title}\n<!-- meta: ${meta} -->\n${body}\n\n`
let dir = ""

const write = async (a: string, b: string) => {
  await writeFile(join(dir, FILES[0].file), `# A\n\n${a}`)
  await writeFile(join(dir, FILES[1].file), `# B\n\n${b}`)
}
const rows = () => db.knowledgeChunk.findMany({ where: { source: { in: FILES.map((f) => f.file) } }, orderBy: [{ source: "asc" }, { title: "asc" }] })
const run = (options = {}) => syncKnowledge(config, { dir, files: FILES, ...options })

beforeEach(async () => {
  embed.mockClear()
  await db.knowledgeChunk.deleteMany({ where: { source: { in: FILES.map((f) => f.file) } } })
  dir ||= await mkdtemp(join(tmpdir(), "kb-"))
})

afterAll(async () => {
  await db.knowledgeChunk.deleteMany({ where: { source: { in: FILES.map((f) => f.file) } } })
  await db.knowledgeChunk.deleteMany({ where: { source: `${RUN}-ngoai.md` } })
  if (dir) await rm(dir, { recursive: true, force: true })
  await db.$disconnect()
})

describe("syncKnowledge", () => {
  it("nạp đoạn mới: ghi nội dung, loại theo file, metadata, vector 1024 chiều, hash", async () => {
    await write(
      section("Giặt linen", "Giặt nước 30 độ.", '{"materials":["linen"],"basis":"tra-cuu"}') + section("Giặt len", "Giặt tay nước mát."),
      section("Phí ship", "Miễn phí từ 500.000 đ."),
    )
    expect(await run()).toEqual({ total: 3, embedded: 3, skipped: 0, removed: 0 })
    const all = await rows()
    expect(all.map((r) => [r.source.replace(RUN, "RUN"), r.type, r.title])).toEqual([
      ["RUN-a.md", "care", "Giặt len"],
      ["RUN-a.md", "care", "Giặt linen"],
      ["RUN-b.md", "policy", "Phí ship"],
    ])
    expect(all.find((r) => r.title === "Giặt linen")).toMatchObject({ content: "Giặt nước 30 độ.", metadata: { materials: ["linen"], basis: "tra-cuu" }, model: "bge-m3" })
    const dims = await db.$queryRaw<{ n: number }[]>`SELECT vector_dims("embedding") AS n FROM "KnowledgeChunk" WHERE "source" = ${FILES[0].file} LIMIT 1`
    expect(dims[0].n).toBe(1024)
  })

  it("chạy lại khi không đổi thì bỏ qua, không gọi embed", async () => {
    await write(section("Một", "Nội dung một."), section("Hai", "Nội dung hai."))
    await run()
    embed.mockClear()
    expect(await run()).toEqual({ total: 2, embedded: 0, skipped: 2, removed: 0 })
    expect(embed).not.toHaveBeenCalled()
  })

  it("đổi nội dung hoặc tiêu đề thì embed lại; --force embed lại tất cả", async () => {
    await write(section("Một", "Nội dung một.") + section("Hai", "Nội dung hai."), "")
    await run()
    await write(section("Một", "Nội dung một ĐÃ SỬA.") + section("Hai", "Nội dung hai."), "")
    expect(await run()).toMatchObject({ embedded: 1, skipped: 1, removed: 0 })
    expect((await rows()).find((r) => r.title === "Một")?.content).toBe("Nội dung một ĐÃ SỬA.")
    expect(await run({ force: true })).toMatchObject({ embedded: 2, skipped: 0 })
  })

  it("chỉ đổi metadata hoặc loại: cập nhật mà không embed lại", async () => {
    await write(section("Một", "Nội dung một.", "{}"), "")
    await run()
    embed.mockClear()
    await write(section("Một", "Nội dung một.", '{"seasons":["hè"]}'), "")
    expect(await run()).toMatchObject({ embedded: 0, skipped: 1 })
    expect(embed).not.toHaveBeenCalled()
    expect((await rows())[0].metadata).toEqual({ seasons: ["hè"] })
  })

  it("xoá đoạn khỏi file thì xoá khỏi DB; đoạn thuộc file khác không bị đụng", async () => {
    await db.knowledgeChunk.deleteMany({ where: { source: `${RUN}-ngoai.md` } })
    await write(section("Giữ", "Đoạn giữ.") + section("Bỏ", "Đoạn sẽ bị bỏ."), "")
    await run()
    await db.$executeRaw`INSERT INTO "KnowledgeChunk" ("id","source","type","title","content","metadata","embedding","contentHash","model","templateVersion","updatedAt")
      VALUES (${`id-${RUN}`}, ${`${RUN}-ngoai.md`}, 'faq', 'Của file khác', 'x', '{}'::jsonb, ${`[${new Array(1024).fill(0).join(",")}]`}::vector, 'h', 'm', 1, now())`

    await write(section("Giữ", "Đoạn giữ."), "")
    expect(await run()).toMatchObject({ embedded: 0, skipped: 1, removed: 1 })
    expect((await rows()).map((r) => r.title)).toEqual(["Giữ"])
    expect(await db.knowledgeChunk.count({ where: { source: `${RUN}-ngoai.md` } })).toBe(1) // không đụng tới

    // shouldPrune chỉ nhận đúng tiền tố của test này: KHÔNG được để lệnh dọn chạm vào kho thật trong cùng bảng.
    expect(await run({ shouldPrune: (source: string) => source.startsWith(RUN) })).toMatchObject({ removed: 1 })
    expect(await db.knowledgeChunk.count({ where: { source: `${RUN}-ngoai.md` } })).toBe(0)
  })

  it("file sai quy ước làm dừng và không ghi gì (kèm tên file và tiêu đề)", async () => {
    await write("## Hỏng\nkhông có meta\n", "")
    await expect(run()).rejects.toThrow(/Hỏng/)
    expect(await rows()).toHaveLength(0)
  })

  it("lỗi embed giữa chừng thì ném lỗi, lần chạy sau tiếp tục phần còn thiếu", async () => {
    await write(section("Một", "Nội dung một.") + section("Hai", "Nội dung hai."), "")
    embed.mockRejectedValueOnce(new Error("Ollama tắt"))
    await expect(run()).rejects.toThrow("Ollama tắt")
    expect(await rows()).toHaveLength(0)
    expect(await run()).toMatchObject({ embedded: 2 })
  })
})
