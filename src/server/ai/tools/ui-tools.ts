import "server-only"
import { tool } from "ai"
import { z } from "zod"
import { navigateInputSchema } from "@/lib/validators/ai"
import type { ToolContext } from "./context"

/* Hai tool điều khiển giao diện: server chỉ kiểm và phát hành động, client mới thực thi (và kiểm lại bằng whitelist). */

export function openCartTool(ctx: ToolContext) {
  return tool({
    description: "Mở ngăn kéo giỏ hàng cho khách xem. Dùng khi khách muốn mở hoặc xem giỏ hàng trên màn hình.",
    inputSchema: z.object({}),
    execute: async () => {
      ctx.emit({ type: "ui", action: { type: "openCart" } })
      return { ok: true as const }
    },
  })
}

export function navigateTool(ctx: ToolContext) {
  return tool({
    description:
      "Đưa khách tới một trang trong cửa hàng: /products, /products/<slug>, /categories/<slug>, /cart, /checkout, /account, /account/orders. Chỉ dùng các đường dẫn đó; để thanh toán hãy đưa khách tới /checkout, không tự đặt đơn.",
    inputSchema: navigateInputSchema,
    execute: async ({ to }) => {
      ctx.emit({ type: "ui", action: { type: "navigate", to } })
      return { ok: true as const, to }
    },
  })
}
