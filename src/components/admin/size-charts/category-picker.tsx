"use client"

import { usePathname, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface PickerOption {
  id: string
  label: string
  hasChart: boolean
}

/** Chọn danh mục lá; lựa chọn nằm trong URL (?categoryId=). */
export function CategoryPicker({ options, value }: { options: PickerOption[]; value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? ""

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label id="size-chart-category-label" className="text-label font-bold">
        Danh mục
      </label>
      <Select value={value} onValueChange={(v) => v && router.replace(`${pathname}?categoryId=${encodeURIComponent(v)}`, { scroll: false })}>
        <SelectTrigger aria-labelledby="size-chart-category-label" className="max-w-sm min-w-64 bg-card">
          <SelectValue>{(v: string) => labelOf(v)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="min-w-72">
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
              {!o.hasChart && <span className="text-xs text-subtle-foreground">· chưa có bảng</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
