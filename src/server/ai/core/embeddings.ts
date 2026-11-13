import "server-only"
import { createHash } from "node:crypto"
import { embedMany } from "ai"
import { CircuitOpenError, getBreaker } from "./breaker"
import type { AiConfig } from "./env"
import { createAiModels } from "./models"

/** sha256(content + "|" + model + "|" + templateVersion): khác hash ⇒ phải embed lại (docs/ai/01-data-for-ai.md mục 4). */
export function hashContent(content: string, model: string, templateVersion: number): string {
  return createHash("sha256").update(`${content}|${model}|${templateVersion}`).digest("hex")
}

/** Mọi vector phải đúng số chiều của cột `vector(N)`; sai thì dừng, không ghi dữ liệu hỏng vào DB. */
export function assertDimensions(vectors: number[][], expected: number): void {
  vectors.forEach((v, i) => {
    if (v.length !== expected) {
      throw new Error(`Embedding thứ ${i} có ${v.length} chiều, cấu hình AI_EMBEDDING_DIMENSIONS là ${expected}`)
    }
  })
}

/**
 * Embed một lô văn bản, giữ nguyên thứ tự. Quá `config.timeoutMs` thì huỷ và ném lỗi. Có circuit breaker (core/breaker.ts): model
 * embedding lỗi liên tiếp thì các lời gọi sau ném `CircuitOpenError` ngay, người gọi (tìm kiếm, kiến thức) rơi về tìm từ khoá.
 */
export async function embedTexts(texts: string[], config: AiConfig): Promise<number[][]> {
  if (texts.length === 0) return []
  const breaker = getBreaker("embedding")
  const gate = breaker.allow()
  if (!gate.allowed) throw new CircuitOpenError("embedding", gate.retryAfterSeconds)
  let embeddings: number[][]
  try {
    ;({ embeddings } = await embedMany({
      model: createAiModels(config).embedding,
      values: texts,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
    }))
  } catch (e) {
    breaker.failure()
    throw e
  }
  breaker.success()
  // Sai số chiều là lỗi cấu hình, không phải model sập: không tính vào breaker.
  assertDimensions(embeddings, config.embeddingDimensions)
  return embeddings
}
