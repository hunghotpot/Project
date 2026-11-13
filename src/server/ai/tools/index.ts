import "server-only"
import { addToCartTool } from "./add-to-cart"
import { applyFiltersTool } from "./apply-filters"
import type { ToolContext } from "./context"
import { getOrderStatusTool } from "./get-order-status"
import { getOutfitSuggestionTool } from "./get-outfit-suggestion"
import { getProductDetailTool } from "./get-product-detail"
import { getSizeRecommendationTool } from "./get-size-recommendation"
import { searchProductsTool } from "./search-products"
import { navigateTool, openCartTool } from "./ui-tools"
import { viewCartTool } from "./view-cart"

export type { ToolContext } from "./context"

/**
 * Tập tool ĐÓNG của trợ lý (docs/ai/04-tool-calling.md): đọc, điều khiển giao diện và MỘT tool ghi là `addToCart` (chỉ tạo thẻ
 * xác nhận, việc ghi nằm ở POST /api/ai/confirm). Không có tool thanh toán, tạo hay huỷ đơn, cũng không có tool admin.
 */
export function createChatTools(ctx: ToolContext) {
  return {
    searchProducts: searchProductsTool(ctx),
    applyFilters: applyFiltersTool(ctx),
    getProductDetail: getProductDetailTool(ctx),
    getSizeRecommendation: getSizeRecommendationTool(ctx),
    viewCart: viewCartTool(ctx),
    addToCart: addToCartTool(ctx),
    getOrderStatus: getOrderStatusTool(ctx),
    getOutfitSuggestion: getOutfitSuggestionTool(ctx),
    openCart: openCartTool(ctx),
    navigate: navigateTool(ctx),
  }
}
