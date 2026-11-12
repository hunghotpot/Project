"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ALL = "all"

/** Lọc theo danh mục (?categoryId=): chọn danh mục gốc thì gồm cả sản phẩm của danh mục con (service lo). Đổi lọc luôn về trang 1. */
export function CategoryFilter({ categories }: { categories: { id: string; name: string; depth: 0 | 1 }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("categoryId") ?? ALL
  const items = [{ value: ALL, label: "Tất cả danh mục" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]

  function onChange(value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (!value || value === ALL) next.delete("categoryId")
    else next.set("categoryId", value)
    next.delete("page")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <Select items={items} value={current} onValueChange={onChange}>
      <SelectTrigger aria-label="Lọc theo danh mục" className="h-11 w-52 bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id} className={c.depth ? "pl-6" : "font-bold"}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
