"use client"

import { useState } from "react"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import {
  CONFIRM_OUTFIT,
  OUTFIT_MISSING_SLOT,
  OUTFIT_OFFICE,
  SIZE_BETWEEN,
  SIZE_NEED_INFO,
  SIZE_NO_CHART,
  SIZE_OUT_OF_RANGE,
  SIZE_OUT_OF_STOCK,
  SIZE_RECOMMENDED,
} from "@/components/assistant/fixtures"
import { MessageBubble } from "@/components/assistant/message-bubble"
import { buildWelcome, nextMessageId } from "@/stores/assistant-ui"
import type { AssistantActions, ChatMessage } from "@/types/assistant"

const CARDS: { title: string; message: ChatMessage }[] = [
  { title: "Size: recommended", message: { id: "c1", role: "assistant", parts: [{ type: "size", data: SIZE_RECOMMENDED }] } },
  {
    title: "Size: between_two (+ trả lời nhanh)",
    message: {
      id: "c2",
      role: "assistant",
      parts: [
        { type: "text", text: "Bạn nằm giữa hai size M và L của áo này. Mình xếp theo số đo bạn đưa:" },
        { type: "size", data: SIZE_BETWEEN },
        { type: "text", text: "Bạn thích mặc ôm hay thoải mái?" },
        {
          type: "quickReplies",
          options: [
            { label: "Ôm", value: "tight" },
            { label: "Vừa", value: "regular" },
            { label: "Rộng", value: "loose" },
          ],
        },
      ],
    },
  },
  { title: "Size: size đề xuất hết hàng", message: { id: "c3", role: "assistant", parts: [{ type: "size", data: SIZE_OUT_OF_STOCK }] } },
  { title: "Size: need_info", message: { id: "c4", role: "assistant", parts: [{ type: "size", data: SIZE_NEED_INFO }] } },
  { title: "Size: out_of_range", message: { id: "c5", role: "assistant", parts: [{ type: "size", data: SIZE_OUT_OF_RANGE }] } },
  { title: "Size: no_chart", message: { id: "c6", role: "assistant", parts: [{ type: "size", data: SIZE_NO_CHART }] } },
  { title: "Bộ đồ (Mix & Match)", message: { id: "c7", role: "assistant", parts: [{ type: "outfit", data: OUTFIT_OFFICE }] } },
  { title: "Bộ đồ thiếu món", message: { id: "c8", role: "assistant", parts: [{ type: "outfit", data: OUTFIT_MISSING_SLOT }] } },
  { title: "Thẻ xác nhận", message: { id: "c9", role: "assistant", parts: [{ type: "confirm", data: CONFIRM_OUTFIT }] } },
]

export function AssistantPreview() {
  const [log, setLog] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>(() => buildWelcome({ slug: "ao-so-mi-poplin-cong-so", name: "Áo sơ mi poplin công sở" }))

  const record = (entry: string) => setLog((l) => [entry, ...l].slice(0, 8))
  const actions: AssistantActions = {
    onQuickReply: (value) => record(`quick reply: ${value}`),
    onSelectSize: (size) => record(`chọn size: ${size}`),
    onViewSizeChart: () => record("xem bảng size"),
    onSubmitMeasurements: (v) => record(`gửi số đo: ${JSON.stringify(v)}`),
    onAddOutfit: () => record("thêm cả bộ"),
    onConfirm: (id) => record(`xác nhận: ${id}`),
    onCancelConfirm: (id) => record(`huỷ: ${id}`),
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Trợ lý mua sắm: giao diện thẻ (dữ liệu mẫu)</h1>
        <p className="text-label text-muted-foreground">Chưa nối backend AI. Dữ liệu lấy từ docs/ai/03-rag-advisor.md và seed.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section aria-label="Khung chat" className="space-y-2">
          <h2 className="text-lg font-bold">Khung chat</h2>
          <div className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-white">
            <AssistantPanel
              messages={messages}
              actions={actions}
              onSend={(text) =>
                setMessages((m) => [
                  ...m,
                  { id: nextMessageId(), role: "user", parts: [{ type: "text", text }] },
                  { id: nextMessageId(), role: "assistant", parts: [{ type: "text", text: "(Bản xem thử: chưa có phản hồi từ AI.)" }] },
                ])
              }
            />
          </div>
          <div aria-live="polite" className="rounded-xl bg-secondary p-3 text-xs">
            <p className="font-bold">Hành động vừa bấm</p>
            {log.length === 0 ? <p className="text-muted-foreground">Chưa có.</p> : log.map((l, i) => <p key={`${l}-${i}`}>{l}</p>)}
          </div>
        </section>

        <section aria-label="Các loại thẻ" className="space-y-6">
          <h2 className="text-lg font-bold">Các loại thẻ</h2>
          {CARDS.map((c) => (
            <div key={c.title} className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground">{c.title}</h3>
              <div className="max-w-md rounded-2xl bg-surface p-4">
                <MessageBubble message={c.message} actions={actions} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
