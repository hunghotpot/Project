"use client"

import { useEffect, useRef, useState } from "react"
import { SendIcon } from "lucide-react"
import { MessageBubble } from "@/components/assistant/message-bubble"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AssistantActions, ChatMessage } from "@/types/assistant"

// Khớp AI_MAX_INPUT_CHARS trong .env.example (docs/ai/07-env-and-setup.md).
export const MAX_INPUT_CHARS = 1000

// Phần thân khung chat: danh sách tin nhắn + ô nhập. Chỉ trình bày, không biết gì về backend.
export function AssistantPanel({
  messages,
  onSend,
  actions,
}: {
  messages: ChatMessage[]
  onSend: (text: string) => void
  actions?: AssistantActions
}) {
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="log" aria-live="polite" aria-label="Hội thoại với trợ lý" className="flex-1 space-y-4 overflow-y-auto bg-surface px-4 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} actions={actions} />
        ))}
        <div ref={endRef} />
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
        <Button type="submit" variant="dark" size="icon" aria-label="Gửi" disabled={!text.trim()}>
          <SendIcon />
        </Button>
      </form>
    </div>
  )
}
