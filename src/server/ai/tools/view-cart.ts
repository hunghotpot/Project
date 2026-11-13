import "server-only"
import { tool } from "ai"
import { z } from "zod"
import { getCart } from "@/server/services/cart.service"
import { runTool, type ToolContext } from "./context"

export function viewCartTool(ctx: ToolContext) {
  return tool({
    description: "Xem giỏ hàng hiện tại của khách: các dòng, số lượng, tạm tính và cảnh báo (hết hàng, đổi giá). Dùng khi khách hỏi về giỏ hàng.",
    inputSchema: z.object({}),
    execute: () =>
      runTool("viewCart", async () => {
        const cart = await getCart({ userId: ctx.userId })
        return {
          ok: true as const,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal,
          items: cart.items.map((l) => ({
            name: l.name,
            size: l.size,
            color: l.color,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            warnings: l.warnings.map((w) => w.message),
          })),
        }
      }),
  })
}
