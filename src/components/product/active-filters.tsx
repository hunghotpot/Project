"use client"

import { XIcon } from "lucide-react"
import { useProductFilters } from "@/hooks/use-product-filters"

export function ActiveFilters() {
  const { chips, clearAll } = useProductFilters()
  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Bộ lọc đang áp dụng">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={c.remove}
          aria-label={`Bỏ lọc ${c.label}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-bold transition-colors hover:bg-border"
        >
          {c.label}
          <XIcon className="size-3" />
        </button>
      ))}
      <button type="button" onClick={clearAll} className="px-2 text-xs font-bold text-primary hover:underline">
        Xoá tất cả
      </button>
    </div>
  )
}

