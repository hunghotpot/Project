import "server-only"
import { tool } from "ai"
import { getOrderStatusInputSchema } from "@/lib/validators/ai"
import { getOrderByCode, getOrderDetail, listOrders } from "@/server/services/order.service"
import type { OrderDetailView } from "@/types/order"
import { redactText } from "../core/redact"
import { notFound, runTool, type ToolContext } from "./context"

/**
 * Tra đơn của CHÍNH khách (mọi truy vấn ràng buộc userId từ ngữ cảnh). Không trả địa chỉ, SĐT, ghi chú đơn hay tên người xử lý;
 * mã sai và đơn của người khác đều ra cùng một kết quả "không tìm thấy".
 */
export function getOrderStatusTool(ctx: ToolContext) {
  return tool({
    description:
      "Tra trạng thái đơn hàng của khách. Khách không đưa mã đơn thì KHÔNG hỏi lại: gọi ngay mà không truyền orderCode để lấy đơn gần nhất; có mã (dạng FS-20261110-0003) thì truyền vào. Không dùng để huỷ, đổi hay tạo đơn.",
    inputSchema: getOrderStatusInputSchema,
    execute: ({ orderCode }) =>
      runTool("getOrderStatus", async () => {
        let order: OrderDetailView | null
        if (orderCode) order = await getOrderByCode(ctx.userId, orderCode)
        else {
          const latest = (await listOrders(ctx.userId, { pageSize: 1 })).items[0]
          order = latest ? await getOrderDetail(ctx.userId, latest.id) : null
        }
        if (!order) {
          return notFound("ORDER_NOT_FOUND", orderCode ? "Không tìm thấy đơn với mã này trong tài khoản của bạn" : "Bạn chưa có đơn hàng nào")
        }
        return {
          ok: true as const,
          code: order.code,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString(),
          subtotal: order.subtotal,
          shippingFee: order.shippingFee,
          total: order.total,
          items: order.items.map((i) => ({ productName: i.productName, size: i.size, color: i.color, quantity: i.quantity, unitPrice: i.unitPrice })),
          history: order.history.map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString(), note: h.note ? redactText(h.note, 120) : null })),
        }
      }),
  })
}
