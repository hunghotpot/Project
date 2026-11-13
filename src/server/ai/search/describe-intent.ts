import { formatVnd, STYLE_LABEL } from "@/lib/format"
import type { SearchIntent } from "./intent"

/** Một điều kiện trợ lý đã hiểu từ câu tìm kiếm, để hiển thị cho khách. `soft`: chỉ ưu tiên xếp hạng, không loại sản phẩm. */
export interface IntentChip {
  label: string
  soft: boolean
}

function genderLabel(genders: NonNullable<SearchIntent["hard"]["genders"]>): string {
  if (genders.includes("MEN")) return "Nam (gồm unisex)"
  if (genders.includes("WOMEN")) return "Nữ (gồm unisex)"
  return "Unisex"
}

/** "dưới 500k" được lưu là maxPrice 499.999: hiển thị lại "Dưới 500.000 đ" cho khớp lời khách. */
function priceLabel(min?: number, max?: number): string | undefined {
  if (min !== undefined && max !== undefined) return `${formatVnd(min)} – ${formatVnd(max)}`
  if (max !== undefined) return (max + 1) % 1000 === 0 ? `Dưới ${formatVnd(max + 1)}` : `Tối đa ${formatVnd(max)}`
  if (min !== undefined) return (min - 1) % 1000 === 0 ? `Trên ${formatVnd(min - 1)}` : `Từ ${formatVnd(min)}`
  return undefined
}

export function describeIntent(intent: SearchIntent): IntentChip[] {
  const { hard, soft } = intent
  const chips: IntentChip[] = []
  const add = (label: string | undefined, isSoft = false) => {
    if (label) chips.push({ label, soft: isSoft })
  }

  if (hard.genders) add(genderLabel(hard.genders))
  add(intent.categoryLabel)
  add(priceLabel(hard.minPrice, hard.maxPrice))
  if (hard.sizes.length) add(`Size ${hard.sizes.join(", ")}`)
  if (hard.colors.length) add(`Màu ${hard.colors.join(", ")}`)
  if (soft.occasion.length) add(`Dịp: ${soft.occasion.join(", ")}`, true)
  if (soft.season.length) add(`Mùa: ${soft.season.join(", ")}`, true)
  if (soft.style.length) add(`Phong cách: ${soft.style.map((s) => STYLE_LABEL[s] ?? s).join(", ")}`, true)
  return chips
}
