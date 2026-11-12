import "server-only"

/*
 * Điểm móc cho tầng AI (docs/ai/01-data-for-ai.md mục 4).
 * Các service Admin gọi hàm này SAU KHI thao tác sản phẩm đã commit (tạo / sửa / ẩn-hiện / xoá / chỉnh tồn),
 * ngoài transaction; lỗi bị nuốt và ghi log nên không bao giờ làm hỏng thao tác chính.
 *
 * Hiện là hàm RỖNG. Khi làm bước Embedding (docs/TODO.md C1.3), thân hàm sẽ:
 *  - sản phẩm còn tồn tại: dựng văn bản, so `contentHash` rồi chỉ embed lại khi đổi;
 *  - sản phẩm đã bị xoá (không còn bản ghi): bỏ embedding tương ứng.
 * Job `npm run ai:embed` vẫn bù những lần hàm này lỗi.
 */
export async function syncProductEmbedding(productId: string): Promise<void> {
  void productId
}
