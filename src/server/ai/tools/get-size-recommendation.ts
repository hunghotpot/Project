import "server-only"
import { tool } from "ai"
import { getSizeRecommendationInputSchema } from "@/lib/validators/ai"
import { adviseSizeForProduct } from "../advisor/size.service"
import { notFound, runTool, type ToolContext } from "./context"
import { resolveProduct } from "./resolve-product"

/** Gợi ý size: tính bằng code theo bảng size (không do LLM); LLM chỉ diễn đạt kết quả. Thẻ size đi thẳng vào khung chat.
 * Sản phẩm được xác định bởi `resolveProduct` (tên → slug thật, không mơ hồ mới chọn). */
export function getSizeRecommendationTool(ctx: ToolContext) {
  return tool({
    description:
      "Gợi ý size cho một sản phẩm theo chiều cao, cân nặng hoặc số đo của khách. Chỉ cần tên sản phẩm khách nhắc tới, không cần tìm trước. Nếu thiếu số đo thì kết quả báo trường còn thiếu: hãy hỏi lại khách, không tự đoán số đo. Nếu có nhiều sản phẩm khớp tên, hỏi khách chọn một.",
    inputSchema: getSizeRecommendationInputSchema,
    execute: ({ product, ...measures }) =>
      runTool("getSizeRecommendation", async () => {
        const resolved = await resolveProduct(product, ctx.config)
        if (!resolved) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")
        if ("candidates" in resolved) {
          return notFound("AMBIGUOUS_PRODUCT", "Có nhiều sản phẩm khớp tên này: hãy hỏi khách muốn sản phẩm nào", { candidates: resolved.candidates.map((c) => c.name) })
        }
        const result = await adviseSizeForProduct({ ...measures, productSlug: resolved.slug })
        if (!result) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")
        // need_info: thẻ nhập số đo gắn với sản phẩm đang mở nên không dựng trong chat; model hỏi lại bằng lời.
        if (result.advice.status !== "need_info") {
          ctx.emit({ type: "size", advice: result.advice, chart: result.chart, categoryName: result.categoryName })
        }
        return { ok: true as const, ...result.advice }
      }),
  })
}
