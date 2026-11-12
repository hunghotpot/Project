"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatVnd } from "@/lib/format"
import type { ConfirmView } from "@/types/assistant"

// Bước 2 của tool ghi: chỉ khi khách bấm "Xác nhận" ở đây mới được gọi API ghi (docs/ai/04-tool-calling.md mục 3).
// Bấm một lần là khoá cả hai nút để không gửi trùng.
export function ConfirmCard({
  data,
  onConfirm,
  onCancel,
}: {
  data: ConfirmView
  onConfirm?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  const [resolved, setResolved] = useState<"confirmed" | "cancelled" | null>(null)

  return (
    <section aria-label="Xác nhận" className="space-y-3 rounded-2xl border border-primary bg-white p-4">
      <div>
        <p className="text-sm font-bold">{data.title}</p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {data.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-1 text-label">
          Tổng: <b>{formatVnd(data.total)}</b>
        </p>
      </div>

      {resolved ? (
        <p role="status" className="text-label font-bold text-muted-foreground">
          {resolved === "confirmed" ? "Đã gửi xác nhận" : "Đã huỷ"}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setResolved("confirmed")
              onConfirm?.(data.id)
            }}
          >
            Xác nhận
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setResolved("cancelled")
              onCancel?.(data.id)
            }}
          >
            Huỷ
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">Hết hạn sau {data.expiresInMinutes} phút</span>
        </div>
      )}
    </section>
  )
}
