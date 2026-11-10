"use client"

import { useState } from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProductFilters } from "@/hooks/use-product-filters"
import { formatVnd, GENDER_LABEL, STYLE_LABEL } from "@/lib/format"
import type { FilterListKey } from "@/lib/validators/product-filter"
import type { FacetValue, ProductFacets } from "@/types/catalog"

const COLLAPSED_COUNT = 6

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="group border-b border-border py-5 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold uppercase [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

// Giá trị đang chọn nhưng không còn trong facet (đếm = 0) vẫn phải hiện để người dùng bỏ chọn được.
function withSelected(values: FacetValue[], selected: string[]): FacetValue[] {
  const known = new Set(values.map((v) => v.value))
  return [...values, ...selected.filter((s) => !known.has(s)).map((value) => ({ value, count: 0 }))]
}

function CheckList({
  idPrefix,
  filterKey,
  values,
  label = (v) => v,
}: {
  idPrefix: string
  filterKey: FilterListKey
  values: FacetValue[]
  label?: (v: string) => string
}) {
  const { filters, toggle } = useProductFilters()
  const [expanded, setExpanded] = useState(false)
  const selected = filters[filterKey]
  const all = withSelected(values, selected)
  // Khi thu gọn: top N theo số lượng + mọi mục đang chọn.
  const shown = expanded ? all : all.filter((v, i) => i < COLLAPSED_COUNT || selected.includes(v.value))

  return (
    <div className="flex flex-col gap-3">
      {shown.map((v) => {
        const id = `${idPrefix}-${filterKey}-${v.value}`
        return (
          <div key={v.value} className="flex items-center gap-2.5">
            <Checkbox id={id} checked={selected.includes(v.value)} onCheckedChange={() => toggle(filterKey, v.value)} />
            <Label htmlFor={id} className="flex-1 font-normal">
              {label(v.value)}
            </Label>
            <span className="text-xs text-subtle-foreground">{v.count}</span>
          </div>
        )
      })}
      {all.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-start text-xs font-bold text-primary hover:underline"
        >
          {expanded ? "Thu gọn" : `Xem thêm (${all.length - shown.length})`}
        </button>
      )}
    </div>
  )
}

function PriceRange({ range }: { range: ProductFacets["price"] }) {
  const { filters, update } = useProductFilters()
  // key ở nơi gọi: khi URL đổi (vd. xoá chip giá) ô nhập được khởi tạo lại.
  const [min, setMin] = useState(filters.minPrice?.toString() ?? "")
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? "")

  function apply(e: React.FormEvent) {
    e.preventDefault()
    update({ minPrice: min === "" ? undefined : Number(min), maxPrice: max === "" ? undefined : Number(max) })
  }

  return (
    <form onSubmit={apply} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          type="number"
          inputMode="numeric"
          min={0}
          step={10000}
          aria-label="Giá từ"
          placeholder={range ? String(range.min) : "Từ"}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          className="px-3"
        />
        <span aria-hidden className="text-muted-foreground">–</span>
        <Input
          size="sm"
          type="number"
          inputMode="numeric"
          min={0}
          step={10000}
          aria-label="Giá đến"
          placeholder={range ? String(range.max) : "Đến"}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          className="px-3"
        />
      </div>
      {range && (
        <p className="text-xs text-muted-foreground">
          Từ {formatVnd(range.min)} đến {formatVnd(range.max)}
        </p>
      )}
      <Button type="submit" variant="dark" size="sm" shape="rounded" className="self-start">
        Áp dụng
      </Button>
    </form>
  )
}

export function ProductFilterPanel({ facets, idPrefix }: { facets: ProductFacets; idPrefix: string }) {
  const { filters, update, toggle } = useProductFilters()

  return (
    <div>
      <div className="flex items-center gap-2.5 border-b border-border pb-5">
        <Checkbox
          id={`${idPrefix}-inStock`}
          checked={!!filters.inStock}
          onCheckedChange={(v) => update({ inStock: v ? true : undefined })}
        />
        <Label htmlFor={`${idPrefix}-inStock`}>Chỉ hiện sản phẩm còn hàng</Label>
      </div>

      {facets.genders.length > 0 && (
        <Group title="Giới tính">
          <div className="flex flex-wrap gap-2">
            {withSelected(facets.genders, filters.gender ? [filters.gender] : []).map((g) => {
              const active = filters.gender === g.value
              return (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ gender: active ? undefined : (g.value as "men" | "women" | "unisex") })}
                  className={chipClass(active)}
                >
                  {GENDER_LABEL[g.value.toUpperCase() as keyof typeof GENDER_LABEL]}{" "}
                  <span className="font-normal opacity-70">({g.count})</span>
                </button>
              )
            })}
          </div>
        </Group>
      )}

      <Group title="Khoảng giá">
        <PriceRange key={`${filters.minPrice}-${filters.maxPrice}`} range={facets.price} />
      </Group>

      {facets.sizes.length > 0 && (
        <Group title="Kích cỡ">
          <div className="flex flex-wrap gap-2">
            {withSelected(facets.sizes, filters.size).map((s) => {
              const active = filters.size.includes(s.value)
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={active}
                  disabled={s.count === 0 && !active}
                  title={`${s.count} sản phẩm`}
                  onClick={() => toggle("size", s.value)}
                  className={cn(chipClass(active), "min-w-11 justify-center")}
                >
                  {s.value}
                </button>
              )
            })}
          </div>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Màu sắc">
          <div className="flex flex-col gap-1">
            {withSelected(facets.colors, filters.color).map((c) => {
              const active = filters.color.includes(c.value)
              const hex = "hex" in c ? (c as { hex: string }).hex : "#cccccc"
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={active}
                  disabled={c.count === 0 && !active}
                  onClick={() => toggle("color", c.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-label transition-colors hover:bg-secondary disabled:opacity-40",
                    active && "bg-secondary font-bold"
                  )}
                >
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded-full border border-border-strong"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="flex-1">{c.value}</span>
                  <span className="text-xs text-subtle-foreground">{c.count}</span>
                </button>
              )
            })}
          </div>
        </Group>
      )}

      {facets.materials.length > 0 && (
        <Group title="Chất liệu">
          <CheckList idPrefix={idPrefix} filterKey="material" values={facets.materials} />
        </Group>
      )}
      {facets.styles.length > 0 && (
        <Group title="Phong cách">
          <CheckList idPrefix={idPrefix} filterKey="style" values={facets.styles} label={(v) => STYLE_LABEL[v] ?? v} />
        </Group>
      )}
      {facets.occasions.length > 0 && (
        <Group title="Dịp mặc">
          <CheckList idPrefix={idPrefix} filterKey="occasion" values={facets.occasions} />
        </Group>
      )}
    </div>
  )
}

function chipClass(active: boolean) {
  return cn(
    "inline-flex h-9 items-center rounded-md border px-3 text-label font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
    active ? "border-ink bg-ink text-white" : "border-border-strong bg-white hover:border-ink"
  )
}
