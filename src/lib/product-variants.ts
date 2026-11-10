/*
 * Logic chọn biến thể (màu × size), thuần hàm để test được và dùng chung server/client.
 * Chỉ cho chọn tổ hợp có tồn tại và còn hàng; mọi lựa chọn mâu thuẫn bị bỏ.
 */

export interface VariantLike {
  id: string
  size: string
  color: string
  colorHex: string
  price: number
  stock: number
}

export interface Selection {
  color?: string
  size?: string
}

/** available: chọn được · soldout: tổ hợp có nhưng hết hàng (mờ + gạch) · unavailable: tổ hợp không tồn tại (mờ). */
export type OptionState = "available" | "soldout" | "unavailable"
export type Axis = "color" | "size"

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]

/** Thứ tự size: chữ (S<M<L...) → số tăng dần → "Free size". */
export function sizeRank(size: string): number {
  const i = SIZE_ORDER.indexOf(size.toUpperCase())
  if (i >= 0) return i
  const n = Number(size)
  if (!Number.isNaN(n)) return 100 + n
  return 1000
}

export function listColors(variants: VariantLike[]): { name: string; hex: string }[] {
  const seen = new Map<string, string>()
  for (const v of variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex)
  return [...seen].map(([name, hex]) => ({ name, hex }))
}

export function listSizes(variants: VariantLike[]): string[] {
  return [...new Set(variants.map((v) => v.size))].sort((a, b) => sizeRank(a) - sizeRank(b))
}

export function findVariant<T extends VariantLike>(variants: T[], sel: Selection): T | undefined {
  if (!sel.color || !sel.size) return undefined
  return variants.find((v) => v.color === sel.color && v.size === sel.size)
}

export function optionState(variants: VariantLike[], sel: Selection, axis: Axis, value: string): OptionState {
  const other: Axis = axis === "color" ? "size" : "color"
  const candidates = variants.filter((v) => v[axis] === value && (!sel[other] || v[other] === sel[other]))
  if (candidates.length === 0) return "unavailable"
  return candidates.some((v) => v.stock > 0) ? "available" : "soldout"
}

/**
 * Chọn một giá trị. Trạng thái mỗi option đã xét theo trục còn lại, nên option không hợp lệ bị từ chối
 * (trả nguyên selection) và lựa chọn kết quả luôn là một tổ hợp tồn tại, còn hàng.
 */
export function select(variants: VariantLike[], sel: Selection, axis: Axis, value: string): Selection {
  if (optionState(variants, sel, axis, value) !== "available") return sel
  return { ...sel, [axis]: value }
}

/** Chỉ có đúng 1 màu / 1 size còn hàng thì chọn sẵn. */
export function initialSelection(variants: VariantLike[]): Selection {
  const sel: Selection = {}
  const colors = listColors(variants)
  const sizes = listSizes(variants)
  if (colors.length === 1) sel.color = colors[0].name
  if (sizes.length === 1) sel.size = sizes[0]
  return sel
}

/** Khoảng giá của các biến thể khớp lựa chọn hiện tại (chưa chọn gì = cả sản phẩm). */
export function priceRange(variants: VariantLike[], sel: Selection): { min: number; max: number } {
  const exact = findVariant(variants, sel)
  if (exact) return { min: exact.price, max: exact.price }
  const pool = variants.filter(
    (v) => (!sel.color || v.color === sel.color) && (!sel.size || v.size === sel.size)
  )
  const prices = (pool.length ? pool : variants).map((v) => v.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

/** Ảnh gắn màu (nếu có) của màu đang chọn đứng đầu; ảnh chung (color = null) luôn giữ. Không có ảnh theo màu → giữ nguyên. */
export function imagesForColor<T extends { color?: string | null }>(images: T[], color?: string): T[] {
  if (!color) return images
  const forColor = images.filter((i) => i.color === color)
  if (forColor.length === 0) return images
  return [...forColor, ...images.filter((i) => !i.color)]
}

