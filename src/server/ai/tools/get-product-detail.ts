import "server-only"
import { tool } from "ai"
import { getProductDetailInputSchema } from "@/lib/validators/ai"
import { getProductBySlug } from "@/server/services/catalog.service"
import { redactText } from "../core/redact"
import { notFound, runTool, type ToolContext } from "./context"
import { resolveProduct } from "./resolve-product"

const MAX_VARIANTS = 40

/** Chi tiết một sản phẩm đang bán: giá và tồn kho đọc lúc trả lời; bỏ SKU và số tồn chính xác. */
export function getProductDetailTool(ctx: ToolContext) {
  return tool({
    description:
      "Lấy chi tiết một sản phẩm: mô tả, chất liệu, các size và màu còn hàng, giá. Dùng khi khách hỏi về một sản phẩm cụ thể (size nào còn, màu nào, giá bao nhiêu). Chỉ cần tên sản phẩm khách nhắc tới.",
    inputSchema: getProductDetailInputSchema,
    execute: ({ product }) =>
      runTool("getProductDetail", async () => {
        const resolved = await resolveProduct(product, ctx.config)
        if (!resolved) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")
        if ("candidates" in resolved) {
          return notFound("AMBIGUOUS_PRODUCT", "Có nhiều sản phẩm khớp tên này: hãy hỏi khách muốn sản phẩm nào", { candidates: resolved.candidates.map((c) => c.name) })
        }
        const p = await getProductBySlug(resolved.slug)
        if (!p) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")
        const prices = p.variants.map((v) => v.price)
        return {
          ok: true as const,
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          category: p.category.name,
          gender: p.gender,
          material: p.material,
          style: p.style,
          occasion: p.occasion,
          // Mô tả do người bán nhập: che email/SĐT (nếu lỡ ghi) trước khi tới model, và cắt độ dài.
          description: redactText(p.description, 400),
          priceFrom: prices.length ? Math.min(...prices) : null,
          priceTo: prices.length ? Math.max(...prices) : null,
          variants: p.variants.slice(0, MAX_VARIANTS).map((v) => ({ id: v.id, size: v.size, color: v.color, price: v.price, inStock: v.stock > 0 })),
          hasSizeChart: p.sizeChart.length > 0,
        }
      }),
  })
}
