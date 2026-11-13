"use client"

import { useEffect, useRef, useState } from "react"
import { SendIcon } from "lucide-react"
import { MessageBubble } from "@/components/assistant/message-bubble"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AssistantActions, ChatMessage } from "@/types/assistant"

// Khớp AI_MAX_INPUT_CHARS trong .env.example (docs/ai/07-env-and-setup.md).
export const MAX_INPUT_CHARS = 1000

/** Cách đáy tối đa chừng này (px) thì coi là khách đang đọc ở cuối và tự cuộn theo; kéo lên đọc tin cũ thì không giật xuống. */
const STICK_DISTANCE_PX = 120

// Phần thân khung chat: danh sách tin nhắn + ô nhập. Chỉ trình bày, không biết gì về backend.
export function AssistantPanel({
  messages,
  onSend,
  actions,
  busy = false,
}: {
  messages: ChatMessage[]
  onSend: (text: string) => void
  actions?: AssistantActions
  /** Đang chờ trợ lý trả lời: khoá nút gửi để không gửi chồng. */
  busy?: boolean
}) {
  const [text, setText] = useState("")
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  // Tin có sẵn lúc mở khung chat là lịch sử: không chạy lại hiệu ứng vào cho chúng.
  const initialIds = useRef(new Set(messages.map((m) => m.id)))

  // Nội dung đổi chiều cao (chữ dài ra, chấm "đang soạn" thành chữ, thẻ nở ra từng khung hình) thì giữ đáy, miễn khách đang ở cuối.
  // Dùng ResizeObserver thay vì đếm thời gian: máy giật hay trang đang tải nặng cũng không làm lỡ nhịp (đã gặp: vòng đếm 1,1 giây kết thúc
  // trước khi thẻ nở xong nên thẻ bị cắt ở đáy). Kéo lên đọc tin cũ (cách đáy > STICK_DISTANCE_PX) thì ngừng bám.
  useEffect(() => {
    const scroller = scrollerRef.current
    const content = contentRef.current
    if (!scroller || !content) return
    const pin = () => {
      if (stickRef.current) scroller.scrollTop = scroller.scrollHeight
    }
    pin()
    const observer = new ResizeObserver(pin)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // Khách vừa gửi tin: luôn kéo xuống đáy dù trước đó đang kéo lên đọc tin cũ.
  const lastRole = messages.at(-1)?.role
  const count = messages.length
  useEffect(() => {
    if (lastRole !== "user") return
    stickRef.current = true
    const scroller = scrollerRef.current
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [lastRole, count])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    onSend(value)
    setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        role="log"
        aria-live="polite"
        aria-label="Hội thoại với trợ lý"
        onScroll={(e) => {
          const el = e.currentTarget
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_DISTANCE_PX
        }}
        className="flex-1 overflow-y-auto bg-surface px-4 py-4"
      >
        <div ref={contentRef} className="space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} actions={actions} animate={!initialIds.current.has(m.id)} />
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-white p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_INPUT_CHARS}
          size="sm"
          variant="white"
          placeholder="Nhắn cho trợ lý…"
          aria-label="Tin nhắn"
          autoComplete="off"
        />
        <Button type="submit" variant="dark" size="icon" aria-label="Gửi" disabled={!text.trim() || busy}>
          <SendIcon />
        </Button>
      </form>
    </div>
  )
}
