import { z } from "zod"
import { productFilterSchema, serializeProductFilters } from "@/lib/validators/product-filter"

/*
 * Whitelist hành động giao diện mà trợ lý được phép điều khiển (docs/ai/04-tool-calling.md mục 2). Dùng chung server và client
 * (không import gì từ src/server): server kiểm trước khi gửi, client kiểm lại trước khi thực thi và bỏ qua mọi thứ ngoài danh sách.
 * Hành động chỉ điều hướng hoặc mở giao diện, không bao giờ ghi dữ liệu (ghi giỏ chỉ đi qua đường xác nhận).
 */

/** Chỉ các trang trong cửa hàng; không có URL tuyệt đối, không có `javascript:`, không có trang admin. */
export const ALLOWED_PATH =
  /^\/(products(\/[a-z0-9-]+)?|categories\/[a-z0-9-]+|cart|checkout|account(\/orders(\/[A-Za-z0-9]+)?)?)$/

export const uiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setFilters"), filters: productFilterSchema }),
  z.object({ type: z.literal("openCart") }),
  z.object({ type: z.literal("navigate"), to: z.string().max(120).regex(ALLOWED_PATH) }),
])

export type UiAction = z.output<typeof uiActionSchema>

/** Đường dẫn cần chuyển tới cho hành động điều hướng; `openCart` không đổi trang nên trả null. */
export function uiActionHref(action: UiAction): string | null {
  switch (action.type) {
    case "setFilters": {
      const qs = serializeProductFilters(action.filters).toString()
      return qs ? `/products?${qs}` : "/products"
    }
    case "navigate":
      return action.to
    case "openCart":
      return null
  }
}
