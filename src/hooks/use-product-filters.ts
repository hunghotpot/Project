"use client"

import { useCallback, useEffect, useMemo, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatVnd, GENDER_LABEL, STYLE_LABEL } from "@/lib/format"
import {
  FILTER_LIST_KEYS,
  parseProductFilters,
  serializeProductFilters,
  type FilterListKey,
  type ProductFilters,
} from "@/lib/validators/product-filter"
import { useFilterPending } from "@/stores/product-filter-pending"

/*
 * Nguồn sự thật DUY NHẤT của bộ lọc là URL (searchParams). Hook này đọc URL → ProductFilters
 * và mọi thay đổi đều là router.push tới URL mới, nên share link, back/forward đều đúng.
 * Sau này AI điều khiển bộ lọc bằng cách gọi đúng các hàm update/toggle/... ở đây.
 *
 * Trang /categories/[slug]: category nằm trên path nên URL query không có `category` — hook không cần biết.
 */

export interface FilterChip {
  id: string
  label: string
  remove: () => void
}

export function useProductFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const setPending = useFilterPending((s) => s.setPending)
  useEffect(() => setPending(isPending), [isPending, setPending])

  const filters = useMemo<ProductFilters>(
    () => parseProductFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const push = useCallback(
    (next: ProductFilters) => {
      const qs = serializeProductFilters(next).toString()
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
    },
    [router, pathname]
  )

  /** Đổi bất kỳ filter nào; trừ khi patch có page thì luôn quay về trang 1. */
  const update = useCallback(
    (patch: Partial<ProductFilters>) => push({ ...filters, page: 1, ...patch }),
    [filters, push]
  )

  const toggle = useCallback(
    (key: FilterListKey, value: string) => {
      const current = filters[key]
      update({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] })
    },
    [filters, update]
  )

  const clearAll = useCallback(
    () =>
      push({
        ...filters,
        q: undefined,
        category: undefined,
        size: [],
        color: [],
        material: [],
        style: [],
        occasion: [],
        gender: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        inStock: undefined,
        page: 1,
      }),
    [filters, push]
  )

  const chips = useMemo<FilterChip[]>(() => {
    const out: FilterChip[] = []
    const add = (id: string, label: string, patch: Partial<ProductFilters>) =>
      out.push({ id, label, remove: () => update(patch) })

    if (filters.q) add("q", `Từ khoá: ${filters.q}`, { q: undefined })
    if (filters.category) add("category", `Danh mục: ${filters.category}`, { category: undefined })
    if (filters.gender) add("gender", `Giới tính: ${GENDER_LABEL[filters.gender.toUpperCase() as keyof typeof GENDER_LABEL]}`, { gender: undefined })
    for (const key of FILTER_LIST_KEYS) {
      for (const v of filters[key]) {
        const text = key === "style" ? (STYLE_LABEL[v] ?? v) : v
        const prefix = { size: "Size", color: "Màu", material: "Chất liệu", style: "Phong cách", occasion: "Dịp" }[key]
        add(`${key}:${v}`, `${prefix}: ${text}`, { [key]: filters[key].filter((x) => x !== v) })
      }
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const { minPrice: min, maxPrice: max } = filters
      const label =
        min !== undefined && max !== undefined
          ? `${formatVnd(min)} – ${formatVnd(max)}`
          : min !== undefined
            ? `Từ ${formatVnd(min)}`
            : `Đến ${formatVnd(max!)}`
      add("price", label, { minPrice: undefined, maxPrice: undefined })
    }
    if (filters.inStock) add("inStock", "Còn hàng", { inStock: undefined })
    return out
  }, [filters, update])

  return { filters, update, toggle, clearAll, chips, activeCount: chips.length }
}


