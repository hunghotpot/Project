import "server-only"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { db } from "@/server/db"
import { embedTexts, hashContent } from "../core/embeddings"
import type { AiConfig } from "../core/env"
import { KNOWLEDGE_FILES, knowledgeDocument, parseKnowledgeMarkdown, type KnowledgeChunkInput } from "./knowledge-parser"

/*
 * Nạp kho kiến thức (docs/ai/knowledge/*.md) vào bảng KnowledgeChunk, cùng cơ chế với ProductEmbedding: `contentHash` quyết định
 * embed lại hay bỏ qua, nên chạy lại an toàn. Đoạn bị xoá khỏi file thì bị xoá khỏi DB. Chỉ metadata/loại đổi thì cập nhật
 * mà không embed lại (metadata không nằm trong văn bản embed).
 */

/** Tăng khi đổi cách dựng văn bản embed của kho kiến thức (buộc embed lại toàn bộ). */
export const KNOWLEDGE_TEMPLATE_VERSION = 1

export const DEFAULT_KNOWLEDGE_DIR = join(process.cwd(), "docs", "ai", "knowledge")

export async function loadKnowledgeChunks(dir = DEFAULT_KNOWLEDGE_DIR, files = KNOWLEDGE_FILES): Promise<KnowledgeChunkInput[]> {
  const parsed = await Promise.all(
    files.map(async ({ file, type }) => parseKnowledgeMarkdown(file, type, await readFile(join(dir, file), "utf8"))),
  )
  return parsed.flat()
}

const hashOf = (c: KnowledgeChunkInput, model: string) => hashContent(knowledgeDocument(c), model, KNOWLEDGE_TEMPLATE_VERSION)

/** So sánh hai metadata không phụ thuộc thứ tự khoá (jsonb của Postgres sắp lại khoá). */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => (val && typeof val === "object" && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val))

export interface SyncKnowledgeOptions {
  dir?: string
  files?: typeof KNOWLEDGE_FILES
  /** Embed lại cả đoạn có hash khớp. */
  force?: boolean
  batchSize?: number
  /**
   * Nguồn nào được phép dọn đoạn mồ côi (đoạn có trong DB nhưng không còn trong file). Mặc định chỉ các file đang nạp.
   * Lệnh `ai:embed` truyền `() => true` để dọn cả file đã bị xoá khỏi danh sách; test chỉ truyền đúng tiền tố của nó để không
   * đụng vào kho thật trong cùng bảng.
   */
  shouldPrune?: (source: string) => boolean
  onProgress?: (done: number, total: number) => void
}

export interface SyncKnowledgeSummary {
  total: number
  embedded: number
  skipped: number
  removed: number
}

export async function syncKnowledge(config: AiConfig, options: SyncKnowledgeOptions = {}): Promise<SyncKnowledgeSummary> {
  const { dir, files = KNOWLEDGE_FILES, force = false, batchSize = 16, onProgress } = options
  const chunks = await loadKnowledgeChunks(dir, files)
  const key = (c: { source: string; title: string }) => `${c.source}\u0000${c.title}`

  const existing = await db.knowledgeChunk.findMany({ select: { id: true, source: true, title: true, type: true, metadata: true, contentHash: true } })
  const byKey = new Map(existing.map((e) => [key(e), e]))

  const stale = chunks.filter((c) => force || byKey.get(key(c))?.contentHash !== hashOf(c, config.embeddingModel))
  const staleKeys = new Set(stale.map(key))

  // Chỉ metadata hoặc loại đổi: cập nhật cột thường, không embed lại.
  for (const c of chunks) {
    const row = byKey.get(key(c))
    if (row && !staleKeys.has(key(c)) && (row.type !== c.type || stable(row.metadata) !== stable(c.metadata))) {
      await db.knowledgeChunk.update({ where: { id: row.id }, data: { type: c.type, metadata: c.metadata } })
    }
  }

  let done = 0
  for (let i = 0; i < stale.length; i += batchSize) {
    const batch = stale.slice(i, i + batchSize)
    const vectors = await embedTexts(batch.map(knowledgeDocument), config)
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j]
      const literal = `[${vectors[j].join(",")}]`
      await db.$executeRaw`
        INSERT INTO "KnowledgeChunk" ("id", "source", "type", "title", "content", "metadata", "embedding", "contentHash", "model", "templateVersion", "updatedAt")
        VALUES (${randomUUID()}, ${c.source}, ${c.type}, ${c.title}, ${c.content}, ${JSON.stringify(c.metadata)}::jsonb, ${literal}::vector,
                ${hashOf(c, config.embeddingModel)}, ${config.embeddingModel}, ${KNOWLEDGE_TEMPLATE_VERSION}, now())
        ON CONFLICT ("source", "title") DO UPDATE SET
          "type" = EXCLUDED."type",
          "content" = EXCLUDED."content",
          "metadata" = EXCLUDED."metadata",
          "embedding" = EXCLUDED."embedding",
          "contentHash" = EXCLUDED."contentHash",
          "model" = EXCLUDED."model",
          "templateVersion" = EXCLUDED."templateVersion",
          "updatedAt" = now()`
    }
    done += batch.length
    onProgress?.(done, stale.length)
  }

  // Dọn đoạn không còn trong file, chỉ ở các nguồn được phép (mặc định: các file đang nạp).
  const live = new Set(chunks.map(key))
  const loadedSources = new Set(files.map((f) => f.file))
  const shouldPrune = options.shouldPrune ?? ((source: string) => loadedSources.has(source))
  const orphanIds = existing.filter((e) => !live.has(key(e)) && shouldPrune(e.source)).map((e) => e.id)
  if (orphanIds.length) await db.knowledgeChunk.deleteMany({ where: { id: { in: orphanIds } } })

  return { total: chunks.length, embedded: stale.length, skipped: chunks.length - stale.length, removed: orphanIds.length }
}
