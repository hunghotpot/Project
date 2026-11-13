import { cn } from "cn"
import { ConfirmCard } from "@/components/assistant/confirm-card"
import { NoticeCard } from "@/components/assistant/notice-card"
import { OutfitCard } from "@/components/assistant/outfit-card"
import { ProductsCard } from "@/components/assistant/products-card"
import { QuickReplies } from "@/components/assistant/quick-replies"
import { Reveal } from "@/components/assistant/reveal"
import { SizeCard } from "@/components/assistant/size-card"
import { SizeInfoCard } from "@/components/assistant/size-info-card"
import { splitBold } from "@/lib/ai/chat-text"
import type { AssistantActions, ChatMessage, MessagePart } from "@/types/assistant"

/** Chấm "đang soạn" nhảy lần lượt như Messenger; chữ ẩn cho trình đọc màn hình. */
function TypingDots() {
  return (
    <p role="status" className="flex h-5 items-center gap-1">
      <span className="sr-only">Đang soạn…</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-pulse"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </p>
  )
}

function Part({ part, actions, plain }: { part: MessagePart; actions: AssistantActions; plain: boolean }) {
  switch (part.type) {
    case "text":
      // Chữ do LLM sinh luôn render dạng text thuần, không HTML (chỉ **đậm** của trợ lý được vẽ đậm, xem `splitBold`).
      // Chữ của khách (`plain`) giữ nguyên từng ký tự. Trống nghĩa là đang chờ trợ lý trả lời.
      if (!part.text) return <TypingDots />
      return (
        <p className="whitespace-pre-wrap">
          {plain
            ? part.text
            : splitBold(part.text).map((s, i) =>
                s.bold ? (
                  <strong key={i} className="font-bold">
                    {s.text}
                  </strong>
                ) : (
                  s.text
                ),
              )}
        </p>
      )
    case "size": {
      const { data } = part
      if (data.status === "recommended" || data.status === "between_two") {
        return <SizeCard data={data} onSelectSize={part.noSelect ? undefined : actions.onSelectSize} onViewSizeChart={actions.onViewSizeChart} />
      }
      if (data.status === "need_info") return <SizeInfoCard data={data} onSubmit={actions.onSubmitMeasurements} />
      return <NoticeCard data={data} />
    }
    case "products":
      return <ProductsCard items={part.items} />
    case "outfit":
      return <OutfitCard data={part.data} onAddAll={actions.onAddOutfit} />
    case "confirm":
      return <ConfirmCard data={part.data} resolved={part.resolved} onConfirm={actions.onConfirm} onCancel={actions.onCancelConfirm} />
    case "quickReplies":
      return <QuickReplies options={part.options} onSelect={actions.onQuickReply} />
  }
}

// Một tin nhắn = nhiều "part". Chữ nằm trong bong bóng, thẻ đứng riêng bên dưới.
// `animate`: tin mới (không phải lịch sử có sẵn lúc mở khung chat): bong bóng hiện kiểu Messenger (mờ dần, phóng nhẹ từ góc đuôi,
// trượt lên), thẻ nở ra từ từ và lần lượt từng thẻ (xem `Reveal`).
export function MessageBubble({ message, actions = {}, animate = false }: { message: ChatMessage; actions?: AssistantActions; animate?: boolean }) {
  const isUser = message.role === "user"
  let cardIndex = 0
  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      {message.parts.map((part, i) => {
        const key = `${message.id}-${i}`
        if (part.type === "text") {
          return (
            <div
              key={key}
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2 text-label",
                isUser ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm border border-border bg-white",
                animate &&
                  cn(
                    "animate-in fade-in zoom-in-90 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none",
                    isUser ? "origin-bottom-right" : "origin-bottom-left",
                  ),
              )}
            >
              <Part part={part} actions={actions} plain={isUser} />
            </div>
          )
        }
        return (
          <div key={key} className="w-full">
            <Reveal animate={animate} delay={cardIndex++ * 180}>
              <Part part={part} actions={actions} plain={isUser} />
            </Reveal>
          </div>
        )
      })}
    </div>
  )
}
