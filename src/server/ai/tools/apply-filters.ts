import "server-only"
import { tool } from "ai"
import { applyFiltersInputSchema } from "@/lib/validators/ai"
import { productFilterSchema } from "@/lib/validators/product-filter"
import { searchProducts } from "../search/search.service"
import { runTool, type ToolContext } from "./context"

const MAX_QUERY_CHARS = 100
/** Bỏ lời mở đầu của yêu cầu ("lọc giúp mình …", "tìm cho mình …") để chip "Từ khoá" trên trang không hiện chữ thừa. */
const LEADING_REQUEST = /^(?:lọc|tìm|xem)\s+(?:(?:giúp|giùm|hộ|cho)\s+)?(?:(?:mình|tôi|em|tớ)\s+)?/i
export const toFilterQuery = (text: string) => {
  const t = text.trim()
  return (t.replace(LEADING_REQUEST, "").trim() || t).slice(0, MAX_QUERY_CHARS)
}

/**
 * Đưa trang danh sách sản phẩm về đúng điều khách vừa yêu cầu. Model KHÔNG truyền giá trị lọc nào: đo trên qwen3:4b-instruct cho
 * thấy nó bịa giá và giới tính, bỏ sót size, và điền bừa danh mục/chất liệu/mùa bằng tiếng Anh (kết quả rỗng). Thay vào đó trang
 * `/products?q=<câu của khách>` đã hiểu câu bằng code (giới tính, giá, size, màu, loại đồ; xem `search/intent.ts`) và hiện lại
 * điều đã hiểu cho khách; tool chỉ đếm kết quả và phát hành động `setFilters`, client mới là nơi đổi URL.
 */
export function applyFiltersTool(ctx: ToolContext) {
  return tool({
    description:
      "Lọc trang danh sách sản phẩm theo đúng điều khách vừa yêu cầu (loại đồ, giới tính, size, màu, giá...). Dùng khi khách nói muốn lọc hoặc xem trang danh sách theo điều kiện. Không cần truyền tham số: điều kiện tự lấy từ câu của khách. Chỉ muốn xem gợi ý ngay trong chat thì dùng searchProducts.",
    inputSchema: applyFiltersInputSchema,
    execute: () =>
      runTool("applyFilters", async () => {
        const q = toFilterQuery(ctx.userText)
        const filters = productFilterSchema.parse({ q })
        // Đếm bằng chính bộ tìm kiếm mà trang dùng, để số model báo khớp số khách thấy.
        const found = await searchProducts(q, { pageSize: 1, config: ctx.config })
        ctx.emit({ type: "ui", action: { type: "setFilters", filters } })
        return { ok: true as const, total: found.result.total, note: "Đã đưa trang danh sách về yêu cầu của khách; chỉ cần báo số sản phẩm." }
      }),
  })
}
