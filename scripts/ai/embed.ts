import { syncKnowledge } from "@/server/ai/advisor/knowledge-sync"
import { getAiStatus } from "@/server/ai/core/env"
import { syncAllProducts } from "@/server/ai/search/sync-embeddings"
import { db } from "@/server/db"

/*
 * npm run ai:embed          embed sản phẩm và kho kiến thức (docs/ai/knowledge) thiếu hoặc đã đổi nội dung (idempotent, theo contentHash)
 * npm run ai:embed -- --force   embed lại tất cả
 * Cần Ollama đang chạy và các biến AI_* trong .env (xem docs/ai/07-env-and-setup.md).
 */
const force = process.argv.includes("--force")

async function main(): Promise<number> {
  const status = getAiStatus()
  if (!status.enabled) {
    console.error(`AI đang tắt: ${status.reason}`)
    return 1
  }
  const { config } = status
  console.log(`Embed bằng ${config.embeddingModel} (${config.embeddingDimensions} chiều)${force ? ", ép embed lại tất cả" : ""}`)
  const started = Date.now()
  const summary = await syncAllProducts(config, {
    force,
    onProgress: (done, total) => console.log(`  ${done}/${total}`),
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`Sản phẩm xong sau ${seconds}s: tổng ${summary.total}, đã embed ${summary.embedded}, bỏ qua ${summary.skipped}.`)

  const knowledgeStarted = Date.now()
  const knowledge = await syncKnowledge(config, {
    force,
    shouldPrune: () => true, // dọn cả đoạn của file đã bị xoá khỏi danh sách
    onProgress: (done, total) => console.log(`  kiến thức ${done}/${total}`),
  })
  const knowledgeSeconds = ((Date.now() - knowledgeStarted) / 1000).toFixed(1)
  console.log(
    `Kiến thức xong sau ${knowledgeSeconds}s: tổng ${knowledge.total} đoạn, đã embed ${knowledge.embedded}, bỏ qua ${knowledge.skipped}, xoá ${knowledge.removed}.`,
  )
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((e) => {
    console.error("ai:embed lỗi:", e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
