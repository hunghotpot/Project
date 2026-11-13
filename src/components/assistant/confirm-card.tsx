"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatVnd } from "@/lib/format"
import type { ConfirmResolved, ConfirmView } from "@/types/assistant"

// Bước 2 của tool ghi: chỉ khi khách bấm "Xác nhận" ở đây mới được gọi API ghi (docs/ai/04-tool-calling.md mục 3).
// Bấm một lần là khoá cả hai nút để không gửi trùng. Kết quả (`resolved`) do tầng trên giữ trong tin nhắn nên thẻ không quên khi
// khung chat đóng rồi mở lại; state cục bộ chỉ là dự phòng khi thẻ dùng riêng (trang /dev/assistant) không có ai ghi kết quả.
const RESOLVED_LABEL: Record<ConfirmResolved, string> = {
  confirming: "Đang thêm vào giỏ…",
  added: "Đã thêm vào giỏ hàng",
  cancelled: "Đã huỷ",
  failed: "Chưa thêm được, bạn nhờ trợ lý thử lại nhé",
}

export function ConfirmCard({
  data,
  resolved: resolvedProp,
  onConfirm,
  onCancel,
}: {
  data: ConfirmView
  resolved?: ConfirmResolved
  onConfirm?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  const [local, setLocal] = useState<ConfirmResolved | null>(null)
  const resolved = resolvedProp ?? local

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
          {RESOLVED_LABEL[resolved]}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setLocal("confirming")
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
              setLocal("cancelled")
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
