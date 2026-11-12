"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ImageIcon, InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatVnd } from "@/lib/format"
import type { OutfitSlot, OutfitView } from "@/types/assistant"

const SLOT_LABEL: Record<OutfitSlot, string> = {
  top: "Áo",
  bottom: "Quần",
  dress: "Váy đầm",
  outer: "Áo khoác",
  accessory: "Phụ kiện",
}

// Thẻ bộ đồ (Mix & Match). Tổng tiền lấy từ dữ liệu server, không tính ở đây.
export function OutfitCard({
  data,
  onAddAll,
}: {
  data: OutfitView
  /** Mở bước xác nhận thêm cả bộ vào giỏ (tool ghi cần xác nhận, xem docs/ai/04-tool-calling.md). */
  onAddAll?: () => void
}) {
  const [showReasons, setShowReasons] = useState(false)
  const meta = [data.occasion && `Dịp: ${data.occasion}`, data.seasons.length > 0 && `Mùa: ${data.seasons.join(", ")}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <article aria-label={`Bộ đồ ${data.title}`} className="space-y-3 rounded-2xl border border-border bg-white p-4">
      <div>
        <h3 className="text-sm font-bold">{data.title}</h3>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>

      <ul>
        {data.items.map((item) => (
          <li key={item.slug} className="flex gap-3 border-t border-border py-3">
            <Link
              href={`/products/${item.slug}`}
              aria-label={`Xem ${item.name}`}
              className="relative block h-14 w-11 shrink-0 overflow-hidden rounded-md bg-secondary"
            >
              {item.image ? (
                <Image src={item.image.url} alt={item.image.alt} fill sizes="44px" className="object-cover" />
              ) : (
                <ImageIcon className="absolute inset-0 m-auto size-5 text-subtle-foreground" />
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{SLOT_LABEL[item.slot]}</p>
              <Link href={`/products/${item.slug}`} className="line-clamp-2 text-label font-bold hover:text-primary">
                {item.name}
              </Link>
              <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
              {showReasons && item.reason && <p className="mt-1 text-xs text-foreground">{item.reason}</p>}
            </div>
            <span className="text-label font-bold whitespace-nowrap">{formatVnd(item.price)}</span>
          </li>
        ))}
      </ul>

      {data.missingSlots.length > 0 && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Chưa có món phù hợp cho: {data.missingSlots.join(", ")}.
        </p>
      )}
      {data.note && <p className="rounded-lg bg-surface px-3 py-2 text-label">{data.note}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Tổng cộng</p>
          <p className="text-base font-bold text-primary">{formatVnd(data.totalPrice)}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" aria-pressed={showReasons} onClick={() => setShowReasons((v) => !v)}>
            {showReasons ? "Ẩn lý do" : "Xem từng món"}
          </Button>
          {onAddAll && (
            <Button type="button" size="sm" onClick={onAddAll}>
              Thêm cả bộ
            </Button>
          )}
        </div>
      </div>

      {data.knowledgeSources.length > 0 && (
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3 shrink-0" />
          Nguồn: {data.knowledgeSources.join(", ")}. Giá và tồn kho cập nhật lúc này.
        </p>
      )}
    </article>
  )
}
