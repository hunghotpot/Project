import "server-only"
import { tool } from "ai"
import { searchProductsInputSchema, type ProductCardLite } from "@/lib/validators/ai"
import { describeIntent } from "../search/describe-intent"
import { searchProducts } from "../search/search.service"
import { runTool, type ToolContext } from "./context"

/** Tìm sản phẩm theo mô tả tự nhiên; thẻ sản phẩm đi thẳng vào khung chat, model chỉ nhận bản rút gọn để diễn đạt. */
export function searchProductsTool(ctx: ToolContext) {
  return tool({
    description:
      "Tìm sản phẩm theo mô tả của khách (loại đồ, màu, size, dịp, mức giá). Dùng khi khách muốn tìm hoặc xin gợi ý sản phẩm. Không dùng để hỏi về một sản phẩm đã biết slug (dùng getProductDetail) hay về chăm sóc, chính sách.",
    inputSchema: searchProductsInputSchema,
    execute: ({ query, maxResults }) =>
      runTool("searchProducts", async () => {
        const found = await searchProducts(query, { pageSize: maxResults, config: ctx.config })
        const cards: ProductCardLite[] = found.result.items.map((p) => ({
          slug: p.slug,
          name: p.name,
          price: p.price,
          categoryName: p.categoryName,
          image: p.image ? { url: p.image.url, alt: p.image.alt } : null,
          colors: p.colors.map((c) => c.name).slice(0, 8),
        }))
        if (cards.length > 0) ctx.emit({ type: "products", items: cards })
        return {
          ok: true as const,
          total: found.result.total,
          shown: cards.length,
          items: cards.map((c) => ({ name: c.name, slug: c.slug, price: c.price, category: c.categoryName, colors: c.colors })),
          understood: describeIntent(found.intent).map((chip) => chip.label),
          relaxed: found.relaxed,
        }
      }),
  })
}
