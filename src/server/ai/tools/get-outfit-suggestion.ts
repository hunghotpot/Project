import "server-only"
import { tool } from "ai"
import { getOutfitSuggestionInputSchema } from "@/lib/validators/ai"
import { suggestOutfit } from "../advisor/outfit.service"
import { notFound, runTool, type ToolContext } from "./context"
import { plain, resolveProduct } from "./resolve-product"

/**
 * Mix & Match: code chọn món và tính tiền (`advisor/outfit.ts`), thẻ bộ đồ đi thẳng vào khung chat; model chỉ tóm tắt. Giới tính, dịp,
 * mùa, ngân sách lấy bằng code từ các câu gần đây của khách; model chỉ đưa tên sản phẩm khách đã chọn sẵn (nếu có).
 */
export function getOutfitSuggestionTool(ctx: ToolContext) {
  return tool({
    description:
      "Phối thành một bộ đồ (áo, quần hoặc váy đầm, áo khoác, phụ kiện) còn hàng theo dịp, giới tính, mùa, ngân sách khách nói. Dùng khi khách xin phối đồ, gợi ý cả bộ, hỏi mặc gì cho một dịp. Khách đã chọn sẵn một sản phẩm thì truyền tên sản phẩm đó. Dịp và giới tính tự lấy từ lời khách nên không cần truyền; nếu kết quả báo chưa biết nam hay nữ thì hỏi khách. Không dùng để tìm một món lẻ (dùng searchProducts).",
    inputSchema: getOutfitSuggestionInputSchema,
    execute: ({ product }) =>
      runTool("getOutfitSuggestion", async () => {
        let anchorSlug: string | undefined
        // Model hay bịa tên sản phẩm cho tham số này (đo: "áo thun cotton trắng" khi khách chưa nói gì): chỉ nhận khi MỌI từ của tên đã
        // xuất hiện trong lời khách, nếu không thì bỏ qua và phối từ đầu.
        const said = plain(ctx.userHistory.join(" "))
        if (product && plain(product).split(" ").every((w) => said.includes(w))) {
          const resolved = await resolveProduct(product, ctx.config)
          if (!resolved) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")
          if ("candidates" in resolved) {
            return notFound("AMBIGUOUS_PRODUCT", "Có nhiều sản phẩm khớp tên này: hãy hỏi khách muốn sản phẩm nào", { candidates: resolved.candidates.map((c) => c.name) })
          }
          anchorSlug = resolved.slug
        }

        const result = await suggestOutfit({ userTexts: ctx.userHistory, anchorSlug }, ctx.config)
        if (!result.ok) return notFound(result.code, result.message)

        const { view } = result
        ctx.emit({ type: "outfit", data: view })
        return {
          ok: true as const,
          title: view.title,
          occasion: view.occasion,
          items: view.items.map((i) => ({ slot: i.slot, name: i.name, color: i.variantLabel, price: i.price })),
          totalPrice: view.totalPrice,
          missing: view.missingSlots,
          note: "Đã hiện thẻ bộ đồ cho khách (có ảnh, giá, lý do). Chỉ tóm tắt ngắn gọn, đừng liệt kê lại từng món, và nhắc khách chọn size ở từng sản phẩm trước khi thêm vào giỏ.",
        }
      }),
  })
}
