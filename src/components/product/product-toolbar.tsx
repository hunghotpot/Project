"use client"

import { useState } from "react"
import { SlidersHorizontalIcon, XIcon } from "lucide-react"
import { ProductFilterPanel } from "@/components/product/product-filter-panel"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useProductFilters } from "@/hooks/use-product-filters"
import { PRODUCT_SORTS, type ProductSort } from "@/lib/validators/product-filter"
import type { ProductFacets } from "@/types/catalog"

const SORT_LABEL: Record<ProductSort, string> = {
  newest: "Mới nhất",
  popular: "Phổ biến",
  price_asc: "Giá tăng dần",
  price_desc: "Giá giảm dần",
}
const SORT_ITEMS = PRODUCT_SORTS.map((value) => ({ value, label: SORT_LABEL[value] }))

export function SortSelect() {
  const { filters, update } = useProductFilters()
  return (
    <Select
      items={SORT_ITEMS}
      value={filters.sort}
      onValueChange={(v) => update({ sort: v as ProductSort })}
    >
      <SelectTrigger size="sm" aria-label="Sắp xếp" className="w-44 rounded-full bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_ITEMS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Mobile/tablet: bộ lọc nằm trong Sheet (desktop dùng sidebar).
export function MobileFilterSheet({ facets }: { facets: ProductFacets }) {
  const [open, setOpen] = useState(false)
  const { activeCount, clearAll } = useProductFilters()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="secondary" size="default" className="lg:hidden" aria-label="Mở bộ lọc" />}
      >
        <SlidersHorizontalIcon /> Bộ lọc{activeCount > 0 && ` (${activeCount})`}
      </SheetTrigger>
      <SheetContent side="left" className="gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Bộ lọc</SheetTitle>
          <SheetDescription className="sr-only">Lọc sản phẩm theo giá, size, màu và nhiều tiêu chí khác</SheetDescription>
        </SheetHeader>
        <div className="flex-1 px-6 pb-6">
          <ProductFilterPanel facets={facets} idPrefix="m" />
        </div>
        <SheetFooter className="sticky bottom-0 flex-row gap-3 border-t border-border bg-popover p-4">
          <Button variant="secondary" shape="rounded" className="flex-1" onClick={clearAll} disabled={activeCount === 0}>
            <XIcon /> Xoá lọc
          </Button>
          <Button variant="dark" shape="rounded" className="flex-1" onClick={() => setOpen(false)}>
            Xem kết quả
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

