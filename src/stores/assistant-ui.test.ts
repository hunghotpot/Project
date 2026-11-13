import { beforeEach, describe, expect, it } from "vitest"
import type { ChatMessage, ConfirmView } from "@/types/assistant"
import { buildWelcome, useAssistantUi } from "./assistant-ui"

const view = (id: string): ConfirmView => ({ id, title: "Thêm vào giỏ hàng?", lines: ["Áo · Trắng · M × 1"], total: 499000, expiresInMinutes: 5 })
const confirmMessage = (messageId: string, confirmationId: string): ChatMessage => ({
  id: messageId,
  role: "assistant",
  parts: [
    { type: "text", text: "Bạn bấm Xác nhận nhé." },
    { type: "confirm", data: view(confirmationId) },
  ],
})
const resolvedOf = (messageId: string) => {
  const m = useAssistantUi.getState().messages.find((x) => x.id === messageId)
  return m?.parts.flatMap((p) => (p.type === "confirm" ? [p.resolved] : []))[0]
}

beforeEach(() => useAssistantUi.setState({ messages: buildWelcome(null) }))

describe("resolveConfirm: kết quả quyết định nằm trong tin nhắn (không mất khi thẻ bị dựng lại)", () => {
  it("ghi kết quả vào đúng thẻ theo id; thẻ chưa quyết định thì chưa có resolved", () => {
    useAssistantUi.getState().push(confirmMessage("m1", "a".repeat(32)))
    expect(resolvedOf("m1")).toBeUndefined()
    useAssistantUi.getState().resolveConfirm("a".repeat(32), "cancelled")
    expect(resolvedOf("m1")).toBe("cancelled")
  })

  it("chỉ đổi thẻ có id đó, các thẻ khác và các phần khác của tin nhắn giữ nguyên", () => {
    const a = "a".repeat(32)
    const b = "b".repeat(32)
    useAssistantUi.getState().push(confirmMessage("m1", a))
    useAssistantUi.getState().push(confirmMessage("m2", b))
    useAssistantUi.getState().resolveConfirm(a, "added")
    expect(resolvedOf("m1")).toBe("added")
    expect(resolvedOf("m2")).toBeUndefined()
    const m1 = useAssistantUi.getState().messages.find((m) => m.id === "m1")!
    expect(m1.parts[0]).toEqual({ type: "text", text: "Bạn bấm Xác nhận nhé." })
    expect(useAssistantUi.getState().messages[0].id).toBe("welcome")
  })

  it("đi qua đủ các trạng thái: đang xử lý rồi đã thêm; hoặc đang xử lý rồi thất bại", () => {
    const id = "c".repeat(32)
    useAssistantUi.getState().push(confirmMessage("m1", id))
    useAssistantUi.getState().resolveConfirm(id, "confirming")
    expect(resolvedOf("m1")).toBe("confirming")
    useAssistantUi.getState().resolveConfirm(id, "failed")
    expect(resolvedOf("m1")).toBe("failed")
  })

  it("id không có thẻ nào: không đổi gì", () => {
    useAssistantUi.getState().push(confirmMessage("m1", "a".repeat(32)))
    const before = useAssistantUi.getState().messages
    useAssistantUi.getState().resolveConfirm("z".repeat(32), "added")
    expect(useAssistantUi.getState().messages).toEqual(before)
  })

  it("kết quả được giữ qua các lần cập nhật khác của store (như khi khung chat đóng rồi mở lại)", () => {
    const id = "d".repeat(32)
    useAssistantUi.getState().push(confirmMessage("m1", id))
    useAssistantUi.getState().resolveConfirm(id, "cancelled")
    useAssistantUi.getState().setOpen(false)
    useAssistantUi.getState().setOpen(true)
    expect(resolvedOf("m1")).toBe("cancelled")
  })
})
