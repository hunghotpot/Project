import { cn } from "cn"
import { ConfirmCard } from "@/components/assistant/confirm-card"
import { NoticeCard } from "@/components/assistant/notice-card"
import { OutfitCard } from "@/components/assistant/outfit-card"
import { QuickReplies } from "@/components/assistant/quick-replies"
import { SizeCard } from "@/components/assistant/size-card"
import { SizeInfoCard } from "@/components/assistant/size-info-card"
import type { AssistantActions, ChatMessage, MessagePart } from "@/types/assistant"

function Part({ part, actions }: { part: MessagePart; actions: AssistantActions }) {
  switch (part.type) {
    case "text":
      // Chữ do LLM sinh luôn render dạng text thuần, không HTML.
      return <p className="whitespace-pre-wrap">{part.text}</p>
    case "size": {
      const { data } = part
      if (data.status === "recommended" || data.status === "between_two") {
        return <SizeCard data={data} onSelectSize={actions.onSelectSize} onViewSizeChart={actions.onViewSizeChart} />
      }
      if (data.status === "need_info") return <SizeInfoCard data={data} onSubmit={actions.onSubmitMeasurements} />
      return <NoticeCard data={data} />
    }
    case "outfit":
      return <OutfitCard data={part.data} onAddAll={actions.onAddOutfit} />
    case "confirm":
      return <ConfirmCard data={part.data} onConfirm={actions.onConfirm} onCancel={actions.onCancelConfirm} />
    case "quickReplies":
      return <QuickReplies options={part.options} onSelect={actions.onQuickReply} />
  }
}

// Một tin nhắn = nhiều "part". Chữ nằm trong bong bóng, thẻ đứng riêng bên dưới.
export function MessageBubble({ message, actions = {} }: { message: ChatMessage; actions?: AssistantActions }) {
  const isUser = message.role === "user"
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
                isUser ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm border border-border bg-white"
              )}
            >
              <Part part={part} actions={actions} />
            </div>
          )
        }
        return (
          <div key={key} className="w-full">
            <Part part={part} actions={actions} />
          </div>
        )
      })}
    </div>
  )
}
