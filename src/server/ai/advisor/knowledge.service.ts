import "server-only"
import type { KnowledgeMeta, KnowledgeType } from "@/lib/validators/ai"
import { db } from "@/server/db"
import { embedQuery } from "../core/embedding-cache"
import type { AiConfig } from "../core/env"

/*
 * Truy xuất kiến thức cho RAG Advisor (docs/ai/03-rag-advisor.md mục 1): embed câu hỏi, lấy vài đoạn gần nhất theo cosine.
 * Đoạn xa hơn ngưỡng coi như KHÔNG có tri thức (trả mảng rỗng) để trợ lý nói "chưa có thông tin" thay vì suy diễn (mục 6).
 */

export interface KnowledgeHit {
  source: string
  type: KnowledgeType
  title: string
  content: string
  metadata: KnowledgeMeta
  /** Khoảng cách cosine, càng nhỏ càng gần (0 là trùng). */
  distance: number
}

/** Số đoạn tối đa đưa vào prompt (ngữ cảnh model nhỏ có hạn). */
export const KNOWLEDGE_LIMIT = 3
/**
 * Xa hơn mức này là không liên quan. Hiệu chỉnh 2026-11-13 với bge-m3 trên 94 đoạn: đoạn đúng nhất của 15 câu hỏi liên quan
 * nằm ở 0,21–0,39; của 6 câu ngoài lĩnh vực ở 0,48–0,67 (thấp nhất là "thời tiết hôm nay thế nào" 0,477). Chọn 0,45.
 * Đổi model embedding hoặc nội dung kho thì phải đo lại.
 */
export const KNOWLEDGE_MAX_DISTANCE = 0.45

export interface SearchKnowledgeOptions {
  limit?: number
  maxDistance?: number
  /** Chỉ lấy các loại này (mặc định tất cả). */
  types?: KnowledgeType[]
}

export async function searchKnowledge(query: string, config: AiConfig, options: SearchKnowledgeOptions = {}): Promise<KnowledgeHit[]> {
  const { limit = KNOWLEDGE_LIMIT, maxDistance = KNOWLEDGE_MAX_DISTANCE, types } = options
  const text = query.trim()
  if (!text) return []
  const vector = await embedQuery(text, config)
  const literal = `[${vector.join(",")}]`

  const rows = types?.length
    ? await db.$queryRaw<Row[]>`
        SELECT "source", "type", "title", "content", "metadata", ("embedding" <=> ${literal}::vector)::float AS distance
        FROM "KnowledgeChunk" WHERE "type" = ANY(${types})
        ORDER BY "embedding" <=> ${literal}::vector LIMIT ${limit}`
    : await db.$queryRaw<Row[]>`
        SELECT "source", "type", "title", "content", "metadata", ("embedding" <=> ${literal}::vector)::float AS distance
        FROM "KnowledgeChunk"
        ORDER BY "embedding" <=> ${literal}::vector LIMIT ${limit}`

  return rows
    .filter((r) => r.distance <= maxDistance)
    .map((r) => ({ ...r, type: r.type as KnowledgeType, metadata: r.metadata as KnowledgeMeta }))
}

interface Row {
  source: string
  type: string
  title: string
  content: string
  metadata: unknown
  distance: number
}
