"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "cn"
import { Input } from "@/components/ui/input"

export interface ToolbarFilter {
  value: string
  label: string
}

const SEARCH_DEBOUNCE_MS = 350

/*
 * Thanh công cụ của màn danh sách (Figma): ô tìm kiếm, hàng nút lọc (nút đang chọn nền ink), chỗ đặt nút hành động bên phải.
 * Trạng thái nằm trong URL: ?q= và ?<filterParam>= (mặc định "status"); đổi bộ lọc luôn đưa về trang 1.
 * Trang (server) đọc lại searchParams và tự validate bằng Zod của nó.
 */
export function ListToolbar({
  placeholder,
  filters,
  filterParam = "status",
  allLabel = "Tất cả",
  children,
}: {
  placeholder: string
  filters?: ToolbarFilter[]
  filterParam?: string
  allLabel?: string
  /** Nút hành động bên phải (Xuất file, Thêm mới…). */
  children?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const urlQ = params.get("q") ?? ""
  const current = params.get(filterParam) ?? ""

  const [q, setQ] = useState(urlQ)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Đồng bộ khi URL đổi từ nơi khác (vd ô tìm kiếm ở header chuyển sang ?q=).
  useEffect(() => setQ(urlQ), [urlQ])
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  function navigate(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    next.delete("page")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function onSearch(value: string) {
    setQ(value)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => navigate({ q: value.trim() }), SEARCH_DEBOUNCE_MS)
  }

  const pill = (active: boolean) =>
    cn(
      "h-11 shrink-0 rounded-xl border px-4 text-label font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
      active ? "border-ink bg-ink text-white" : "border-border bg-card text-sidebar-foreground hover:bg-secondary"
    )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        role="search"
        className="min-w-56 flex-1 basis-60"
        onSubmit={(e) => {
          e.preventDefault()
          if (timer.current) clearTimeout(timer.current)
          navigate({ q: q.trim() })
        }}
      >
        <Input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 bg-card"
        />
      </form>

      {filters && filters.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
          <button type="button" aria-pressed={current === ""} className={pill(current === "")} onClick={() => navigate({ [filterParam]: "" })}>
            {allLabel}
          </button>
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={current === f.value}
              className={pill(current === f.value)}
              onClick={() => navigate({ [filterParam]: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {children && <div className="flex flex-wrap items-center gap-3 sm:ml-auto">{children}</div>}
    </div>
  )
}
