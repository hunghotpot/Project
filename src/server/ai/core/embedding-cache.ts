import "server-only"
import { createHash } from "node:crypto"
import type { AiConfig } from "./env"
import { embedTexts } from "./embeddings"

/*
 * Bộ nhớ đệm cho embedding của CÂU HỎI (tìm kiếm, truy xuất kiến thức). Cùng một câu (sau khi gộp khoảng trắng) với cùng model thì dùng
 * lại vector, khỏi gọi model lần nữa: tìm kiếm nhanh hơn và nhẹ máy hơn. Cũng gộp các yêu cầu giống nhau đang chạy cùng lúc thành một lời gọi.
 * Chỉ lưu kết quả thành công (lỗi không bị nhớ). Cache nằm trong bộ nhớ tiến trình, tối đa MAX_ENTRIES câu (bỏ câu ít dùng nhất trước,
 * ~8 KB mỗi vector 1024 chiều nên tối đa vài MB). Embedding của sản phẩm/kiến thức khi nạp (embedTexts) không qua đây vì mỗi văn bản chỉ nhúng một lần.
 * Cache hit không đi qua circuit breaker nên câu đã hỏi vẫn tìm ngữ nghĩa được khi model embedding đang sập.
 */

const MAX_ENTRIES = 500

const cache = new Map<string, Promise<number[]>>()

const keyOf = (text: string, config: AiConfig) =>
  createHash("sha256").update(`${config.embeddingModel}|${config.embeddingDimensions}|${text.trim().replace(/\s+/g, " ")}`).digest("hex")

/** Vector của một câu hỏi, dùng cache. Lỗi của model được ném nguyên (người gọi tự rơi về tìm từ khoá). */
export function embedQuery(text: string, config: AiConfig): Promise<number[]> {
  const key = keyOf(text, config)
  const hit = cache.get(key)
  if (hit) {
    // Đưa lên cuối thứ tự để làm "mới dùng gần nhất".
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const pending = embedTexts([text], config).then((vectors) => vectors[0])
  cache.set(key, pending)
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key)
  })
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  return pending
}

/** Chỉ dùng trong test. */
export function clearEmbeddingCache(): void {
  cache.clear()
}

export const EMBEDDING_CACHE_MAX_ENTRIES = MAX_ENTRIES
