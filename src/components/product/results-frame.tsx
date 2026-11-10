"use client"

import { cn } from "cn"
import { useFilterPending } from "@/stores/product-filter-pending"

// Làm mờ lưới cũ trong lúc đổi bộ lọc (Next giữ UI cũ tới khi RSC mới về).
export function ResultsFrame({ children }: { children: React.ReactNode }) {
  const pending = useFilterPending((s) => s.pending)
  return (
    <div aria-busy={pending} className={cn("transition-opacity", pending && "pointer-events-none opacity-50")}>
      {children}
    </div>
  )
}
