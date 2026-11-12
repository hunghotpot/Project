"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { QuickReplyOption } from "@/types/assistant"

// Nút trả lời nhanh. Chọn một lần rồi khoá cả nhóm để không gửi trùng.
export function QuickReplies({
  options,
  onSelect,
}: {
  options: QuickReplyOption[]
  onSelect?: (value: string, label: string) => void
}) {
  const [chosen, setChosen] = useState<string | null>(null)

  return (
    <div role="group" aria-label="Gợi ý trả lời" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          variant={chosen === o.value ? "dark" : "outline"}
          size="sm"
          disabled={chosen !== null}
          onClick={() => {
            setChosen(o.value)
            onSelect?.(o.value, o.label)
          }}
        >
          {o.label}
        </Button>
      ))}
    </div>
  )
}
