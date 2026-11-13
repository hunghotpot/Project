import "server-only"
import { getAiStatus } from "@/server/ai/core/env"
import { syncOneProduct } from "@/server/ai/search/sync-embeddings"

/*
 * Điểm móc cho tầng AI (docs/ai/01-data-for-ai.md mục 4).
 * Các service Admin gọi hàm này SAU KHI thao tác sản phẩm đã commit (tạo / sửa / ẩn-hiện / xoá / chỉnh tồn),
 * ngoài transaction.
 *
 * Việc embed chạy NỀN (không await): gọi model có thể mất vài chục giây, không được làm chậm thao tác của Admin.
 * AI tắt thì không làm gì. Lỗi chỉ ghi log; `npm run ai:embed` bù những lần lỗi.
 * Sản phẩm đã bị xoá: bản ghi embedding tự xoá theo (ON DELETE CASCADE) nên không cần xử lý riêng.
 */
export async function syncProductEmbedding(productId: string): Promise<void> {
  const status = getAiStatus()
  if (!status.enabled) return
  void syncOneProduct(productId, status.config).catch((e) => {
    console.error(`[ai] syncProductEmbedding(${productId}) lỗi:`, e)
  })
}
