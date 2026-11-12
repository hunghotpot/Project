/*
 * Trạng thái và hàm thuần của form thêm/sửa sản phẩm (không phụ thuộc React, không import src/server).
 * Form giữ mọi số dưới dạng chuỗi; `buildPayload` đổi sang dữ liệu gửi cho saveProductAction
 * (server vẫn validate lại bằng createProductSchema/updateProductSchema).
 */

export interface VariantRowState {
  key: string
  /** Có id = biến thể đã tồn tại (sửa tại chỗ). */
  id?: string
  /** SKU của biến thể đã tồn tại: gửi lại để SKU không bị sinh lại từ SKU chung. */
  sku?: string
  size: string
  stock: string
}

export interface ColorGroupState {
  key: string
  color: string
  colorHex: string
  rows: VariantRowState[]
}

export interface ProductFormState {
  name: string
  skuPrefix: string
  categoryId: string
  basePrice: string
  images: string[]
  groups: ColorGroupState[]
  description: string
  tags: string
  occasion: string[]
  season: string[]
  gender: string
  style: string
  material: string
  brand: string
  isActive: boolean
  isFeatured: boolean
}

/** Phần chi tiết sản phẩm mà form cần (cấu trúc con của AdminProductDetail, không có Date để truyền được xuống client). */
export interface ProductDetailInput {
  name: string
  description: string
  brand: string
  material: string
  style: string
  occasion: string[]
  season: string[]
  gender: string
  tags: string[]
  basePrice: number
  isActive: boolean
  isFeatured: boolean
  categoryId: string
  images: { url: string }[]
  variants: { id: string; sku: string; size: string; color: string; colorHex: string; stock: number }[]
}

export interface FormIssue {
  path: (string | number)[]
  message: string
}

let counter = 0
export const newKey = () => `k${++counter}`

export const DEFAULT_COLOR_HEX = "#111827"

export const emptyRow = (): VariantRowState => ({ key: newKey(), size: "", stock: "0" })
export const emptyGroup = (): ColorGroupState => ({ key: newKey(), color: "", colorHex: DEFAULT_COLOR_HEX, rows: [emptyRow()] })

export function emptyForm(brand: string): ProductFormState {
  return {
    name: "",
    skuPrefix: "",
    categoryId: "",
    basePrice: "",
    images: [],
    groups: [emptyGroup()],
    description: "",
    tags: "",
    occasion: [],
    season: [],
    gender: "UNISEX",
    style: "",
    material: "",
    brand,
    isActive: true,
    isFeatured: false,
  }
}

/** Gom biến thể theo màu (giữ thứ tự xuất hiện). */
export function formFromProduct(p: ProductDetailInput): ProductFormState {
  const groups = new Map<string, ColorGroupState>()
  for (const v of p.variants) {
    let g = groups.get(v.color)
    if (!g) groups.set(v.color, (g = { key: newKey(), color: v.color, colorHex: v.colorHex, rows: [] }))
    g.rows.push({ key: newKey(), id: v.id, sku: v.sku, size: v.size, stock: String(v.stock) })
  }
  return {
    name: p.name,
    skuPrefix: "",
    categoryId: p.categoryId,
    basePrice: String(p.basePrice),
    images: p.images.map((i) => i.url),
    groups: groups.size ? [...groups.values()] : [emptyGroup()],
    description: p.description,
    tags: p.tags.join(", "),
    occasion: [...p.occasion],
    season: [...p.season],
    gender: p.gender,
    style: p.style,
    material: p.material,
    brand: p.brand,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
  }
}

/** Số nguyên từ ô nhập; rỗng hoặc không phải số nguyên → null (server sẽ báo "phải là số"). */
export function parseIntField(raw: string): number | null {
  const s = raw.replace(/[.\s,]/g, "")
  if (!/^-?\d+$/.test(s)) return null
  return Number(s)
}

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#+/, "").trim())
    .filter(Boolean)
}

/** Dãy biến thể phẳng theo đúng thứ tự hiển thị: chỉ số trong đây khớp với `variants.<i>` của issues từ server. */
export function flattenVariants(groups: ColorGroupState[]) {
  return groups.flatMap((g) => g.rows.map((r) => ({ group: g, row: r })))
}

export function buildPayload(s: ProductFormState) {
  return {
    name: s.name,
    skuPrefix: s.skuPrefix.trim() || undefined,
    categoryId: s.categoryId,
    basePrice: parseIntField(s.basePrice),
    description: s.description,
    brand: s.brand,
    material: s.material,
    style: s.style,
    occasion: s.occasion,
    season: s.season,
    gender: s.gender,
    tags: parseTags(s.tags),
    isActive: s.isActive,
    isFeatured: s.isFeatured,
    images: s.images.map((url) => ({ url })),
    variants: flattenVariants(s.groups).map(({ group, row }) => ({
      id: row.id,
      sku: row.sku,
      size: row.size,
      color: group.color,
      colorHex: group.colorHex,
      stock: parseIntField(row.stock),
    })),
  }
}

/** Đường dẫn → thông báo đầu tiên của đường dẫn đó, ví dụ "variants.0.sku". */
export function issueMap(issues: FormIssue[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const i of issues) {
    const key = i.path.join(".")
    if (!(key in map)) map[key] = i.message
  }
  return map
}

export const totalStock = (groups: ColorGroupState[]) =>
  flattenVariants(groups).reduce((sum, { row }) => sum + Math.max(0, parseIntField(row.stock) ?? 0), 0)
