"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { buildChatHistory, requestChatReply, requestConfirm, type ChatCardEvent } from "@/lib/ai/chat-client"
import { uiActionHref, type UiAction } from "@/lib/ai/ui-actions"
import { CART_KEY } from "@/hooks/use-cart"
import { nextMessageId, useAssistantUi } from "@/stores/assistant-ui"
import { useCartUi } from "@/stores/cart-ui"
import type { ConfirmResolved, MessagePart } from "@/types/assistant"

// Phía server hết thời gian ở AI_REQUEST_TIMEOUT_MS (mặc định 60 giây); trình duyệt chờ thêm một chút rồi bỏ.
const CLIENT_TIMEOUT_MS = 75_000

/**
 * Nối khung chat với `/api/ai/chat`: thêm tin của khách, một ô trả lời trống rồi đổ chữ và thẻ vào ô đó khi luồng về.
 * Hành động giao diện (mở giỏ, đổi bộ lọc, chuyển trang) chỉ thực thi nếu đã qua whitelist `uiActionSchema` (chat-client kiểm
 * từng dòng); hành động không bao giờ ghi dữ liệu. Lỗi thì ô trả lời thành câu báo lỗi thân thiện (đánh dấu `error` để không gửi
 * lại cho model). Mọi logic đọc luồng nằm ở `src/lib/ai/chat-client.ts` (có test); hook chỉ nối store và router.
 */
export function useAssistantChat() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const runUiAction = useCallback(
    (action: UiAction) => {
      if (action.type === "openCart") useCartUi.getState().setOpen(true)
      else {
        const href = uiActionHref(action)
        if (href) router.push(href)
      }
      // Trên mobile ô chat phủ kín màn hình: thu lại để khách thấy giỏ hàng hoặc trang vừa mở.
      if (window.matchMedia("(max-width: 639px)").matches) useAssistantUi.getState().setOpen(false)
    },
    [router],
  )

  const send = useCallback(
    async (text: string) => {
      const ui = useAssistantUi.getState()
      if (ui.pending) return

      const turns = buildChatHistory(ui.messages, text)
      const replyId = nextMessageId()
      ui.push({ id: nextMessageId(), role: "user", parts: [{ type: "text", text }] })
      ui.push({ id: replyId, role: "assistant", parts: [{ type: "text", text: "" }] })
      ui.setPending(true)

      // Phần chữ luôn đứng đầu; thẻ (sản phẩm, size, bộ đồ, xác nhận) do tool dựng chỉ được gắn bên dưới SAU KHI câu trả lời xong.
      // Thẻ tới trước chữ (tool chạy xong rồi model mới viết), nên nếu gắn ngay thì ô thẻ chiếm chỗ và đẩy ô chữ đang chảy lên trên.
      let replyText = ""
      let showCards = false
      const cards: MessagePart[] = []
      const render = (withText: boolean) => {
        const shown = showCards ? cards : []
        useAssistantUi.getState().updateMessage(replyId, withText ? [{ type: "text", text: replyText }, ...shown] : shown)
      }

      const onEvent = (event: ChatCardEvent) => {
        if (event.type === "ui") return runUiAction(event.action)
        if (event.type === "products") cards.push({ type: "products", items: event.items })
        else if (event.type === "confirm") cards.push({ type: "confirm", data: event.data })
        else if (event.type === "outfit") cards.push({ type: "outfit", data: event.data })
        else {
          useAssistantUi.getState().setChart(event.chart.length > 0 ? { rows: event.chart, categoryName: event.categoryName } : null)
          cards.push({ type: "size", data: event.advice, noSelect: true })
        }
        // Thẻ chỉ được gom lại, KHÔNG hiện ngay: hiện giữa lúc câu trả lời đang chảy sẽ đẩy ô chữ lên trên. Thẻ hiện một lần khi câu xong.
      }

      try {
        const reply = await requestChatReply(turns, {
          onText: (soFar) => {
            replyText = soFar
            render(true)
          },
          onEvent,
          signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
        })
        if (!reply.ok) useAssistantUi.getState().updateMessage(replyId, [{ type: "text", text: reply.message }], true)
        // Câu trả lời đã xong: bây giờ mới hiện các thẻ (sản phẩm, size, bộ đồ, xác nhận) bên dưới phần chữ. Không có chữ thì bỏ ô chữ
        // trống (nếu không sẽ treo chữ "Đang soạn…").
        else {
          showCards = true
          render(reply.text.trim().length > 0)
        }
      } finally {
        useAssistantUi.getState().setPending(false)
      }
    },
    [runUiAction],
  )

  /**
   * Khách bấm Xác nhận/Huỷ trên thẻ của tool ghi: gọi `/api/ai/confirm` (không qua model). Kết quả hiện thành một tin của trợ lý;
   * câu báo lỗi đánh dấu `error` để không gửi lại cho model làm ngữ cảnh.
   */
  const decide = useCallback(
    async (confirmationId: string, action: "confirm" | "cancel") => {
      const say = (text: string, error?: boolean) =>
        useAssistantUi.getState().push({ id: nextMessageId(), role: "assistant", parts: [{ type: "text", text }], ...(error ? { error: true } : {}) })
      // Kết quả ghi vào thẻ (trong store) để nó giữ nguyên trạng thái kể cả khi khung chat đóng rồi mở lại.
      const mark = (resolved: ConfirmResolved) =>
        useAssistantUi.getState().resolveConfirm(confirmationId, resolved)
      mark(action === "cancel" ? "cancelled" : "confirming")
      const outcome = await requestConfirm(confirmationId, action)
      if (!outcome.ok) {
        mark("failed")
        return say(outcome.message, true)
      }
      if (outcome.status === "cancelled") return say("Mình đã huỷ, chưa thêm gì vào giỏ.")
      mark("added")
      say("Mình đã thêm vào giỏ hàng cho bạn rồi nhé.")
      await queryClient.invalidateQueries({ queryKey: CART_KEY })
      useCartUi.getState().setOpen(true)
      if (window.matchMedia("(max-width: 639px)").matches) useAssistantUi.getState().setOpen(false)
    },
    [queryClient],
  )

  return { send, decide }
}
