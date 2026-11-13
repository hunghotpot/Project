import "server-only"
import { tool } from "ai"
import { addToCartInputSchema } from "@/lib/validators/ai"
import { formatVnd } from "@/lib/format"
import { CONFIRMATION_TTL_SECONDS } from "../core/confirmations"
import { sizeMatches } from "../core/size-match"
import { notFound, runTool, type ToolContext } from "./context"
import { plain, resolveProduct } from "./resolve-product"
import { getProductBySlug } from "@/server/services/catalog.service"

const MAX_OPTIONS = 12

/**
 * Tool GHI duy nhất, hai pha (docs/ai/04-tool-calling.md mục 3). Tool này KHÔNG gọi `addItem`: nó chỉ kiểm biến thể thật còn hàng
 * rồi tạo bản ghi chờ xác nhận và hiện thẻ cho khách. Giỏ chỉ được ghi khi khách bấm "Xác nhận" (POST /api/ai/confirm, không qua
 * model), nên prompt bị tiêm lệnh cũng không thêm được gì vào giỏ.
 * Model đưa tên, size, màu (không đưa id: model 4B hay bịa); biến thể do code chọn, mơ hồ hoặc không có thì trả lỗi để hỏi lại khách.
 */
export function addToCartTool(ctx: ToolContext) {
  return tool({
    description:
      "Chuẩn bị thêm một sản phẩm vào giỏ khi khách muốn mua: cần tên sản phẩm, size, màu và số lượng khách nói (thiếu size hoặc màu thì hỏi khách, đừng đoán). Tool chỉ hiện thẻ xác nhận cho khách, CHƯA thêm vào giỏ: khách phải bấm Xác nhận. Không dùng để đặt hàng hay thanh toán.",
    inputSchema: addToCartInputSchema,
    execute: ({ product, size, color, quantity }) =>
      runTool("addToCart", async () => {
        const resolved = await resolveProduct(product, ctx.config)
        if (!resolved) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")
        if ("candidates" in resolved) {
          return notFound("AMBIGUOUS_PRODUCT", "Có nhiều sản phẩm khớp tên này: hãy hỏi khách muốn sản phẩm nào", { candidates: resolved.candidates.map((c) => c.name) })
        }
        const p = await getProductBySlug(resolved.slug)
        if (!p) return notFound("PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm này hoặc sản phẩm đã ngừng bán")

        const inStock = p.variants.filter((v) => v.stock > 0)
        const options = inStock.slice(0, MAX_OPTIONS).map((v) => `${v.size} · ${v.color}`)
        const matches = inStock.filter(
          (v) => (!size || sizeMatches(v.size, size)) && (!color || plain(v.color) === plain(color)),
        )
        if (matches.length === 0) {
          return notFound("VARIANT_NOT_AVAILABLE", "Không có size và màu này còn hàng: hãy báo khách các lựa chọn còn hàng", { options })
        }
        if (matches.length > 1) {
          return notFound("NEED_SIZE_OR_COLOR", "Còn nhiều lựa chọn: hãy hỏi khách chọn size và màu", { options })
        }
        const variant = matches[0]
        if (quantity > variant.stock) {
          return notFound("INSUFFICIENT_STOCK", `Chỉ còn ${variant.stock} sản phẩm này`, { available: variant.stock })
        }

        const pending = await ctx.confirmations.create(ctx.userId, { kind: "addToCart", variantId: variant.id, quantity })
        const line = `${p.name} · ${variant.color} · ${variant.size} × ${quantity}`
        const total = variant.price * quantity
        ctx.emit({
          type: "confirm",
          data: { id: pending.id, title: "Thêm vào giỏ hàng?", lines: [line], total, expiresInMinutes: Math.round(CONFIRMATION_TTL_SECONDS / 60) },
        })
        return {
          ok: true as const,
          status: "pending_confirmation" as const,
          summary: `${line}, ${formatVnd(total)}`,
          note: "Đã hiện thẻ xác nhận cho khách. CHƯA thêm vào giỏ: chờ khách bấm Xác nhận. Không nói là đã thêm.",
        }
      }),
  })
}
