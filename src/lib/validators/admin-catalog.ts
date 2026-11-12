import { z } from "zod"
import { Gender } from "@prisma/client"
import { STYLE_LABEL } from "@/lib/format"
import { ALL_YEAR, OCCASIONS, type Season } from "../../../prisma/seed-data/vocab"

/*
 * Validator cho Admin: Sản phẩm / Tồn kho / Danh mục / Bảng size.
 * Các lựa chọn trong form KHÔNG cho nhập tự do:
 * - occasion: đúng 23 giá trị đóng của OCCASIONS (nguồn: prisma/seed-data/vocab.ts, không sao chép).
 * - season: bốn mùa của ALL_YEAR (cùng nguồn).
 * - gender: enum Gender của Prisma.
 * - style: các khoá của STYLE_LABEL (src/lib/format.ts); đây cũng là tập style đang dùng trong dữ liệu seed
 *   (test admin-catalog.integration.test.ts kiểm tra mọi style trong seed đều nằm trong tập này).
 */

export const ADMIN_OCCASIONS = OCCASIONS
export const ADMIN_SEASONS = ALL_YEAR as [Season, ...Season[]]
export const ADMIN_GENDERS = Object.values(Gender) as [Gender, ...Gender[]]
export const ADMIN_STYLES = Object.keys(STYLE_LABEL) as [string, ...string[]]

export const MAX_PRODUCT_IMAGES = 4
export const MAX_PRODUCT_VARIANTS = 100
export const DEFAULT_ADMIN_PAGE_SIZE = 10
export const MAX_ADMIN_PAGE_SIZE = 50
export const MAX_STOCK = 1_000_000
export const MAX_PRICE = 100_000_000

/* ─────────────────────────── Hàm thuần ─────────────────────────── */

/** "Áo thun Nam #1" → "ao-thun-nam-1" (bỏ dấu, đ → d). Rỗng nếu không còn ký tự hợp lệ. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")
}

/** SKU biến thể khi Admin chỉ nhập một SKU chung (Figma): `${tiền tố}-${MÀU}-${SIZE}`, ví dụ TEE-001-DEN-M. */
export function buildVariantSku(skuPrefix: string, color: string, size: string): string {
  const part = (s: string) => slugify(s).toUpperCase() || "X"
  return `${skuPrefix.trim().toUpperCase()}-${part(color)}-${part(size)}`
}

/* ─────────────────────────── Thành phần dùng chung ─────────────────────────── */

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

const trimmed = (label: string, max: number, min = 1) =>
  z
    .string({ error: `${label} không hợp lệ` })
    .trim()
    .min(min, `${label} không được để trống`)
    .max(max, `${label} tối đa ${max} ký tự`)

const idSchema = (label: string) => trimmed(label, 64)

const moneySchema = (label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên (VND)`)
    .min(0, `${label} không được âm`)
    .max(MAX_PRICE, `${label} quá lớn`)

const stockSchema = z
  .number({ error: "Tồn kho phải là số" })
  .int("Tồn kho phải là số nguyên")
  .min(0, "Tồn kho không được âm")
  .max(MAX_STOCK, "Tồn kho quá lớn")

export const adminContextSchema = z.object({ userId: idSchema("Mã quản trị viên") })
export type AdminContext = z.input<typeof adminContextSchema>

export const adminIdSchema = idSchema("Mã")

/* ─────────────────────────── Danh sách sản phẩm (bộ lọc nằm trong URL nên lỏng) ─────────────────────────── */

export const ADMIN_STOCK_STATUSES = ["IN_STOCK", "LOW", "OUT"] as const

const optionalText = (max: number) =>
  z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).trim() : undefined), z.string().max(max).optional())
    .transform((v) => v || undefined)
    .catch(undefined)

export const adminProductFilterSchema = z.object({
  /** Tìm theo tên, SKU hoặc tag (không phân biệt dấu); mỗi từ phải khớp. */
  q: optionalText(100),
  categoryId: optionalText(64),
  /** Slug danh mục; danh mục gốc gồm cả sản phẩm của danh mục con. Bỏ qua nếu đã có categoryId. */
  categorySlug: optionalText(100),
  stockStatus: z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).toUpperCase() : v), z.enum(ADMIN_STOCK_STATUSES).optional())
    .catch(undefined),
  isActive: z
    .preprocess((v) => {
      const x = first(v)
      return x === "true" || x === true ? true : x === "false" || x === false ? false : undefined
    }, z.boolean().optional())
    .catch(undefined),
  page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
  pageSize: z.preprocess(first, z.coerce.number().int().min(1).max(MAX_ADMIN_PAGE_SIZE)).catch(DEFAULT_ADMIN_PAGE_SIZE),
})
export type AdminProductFilters = z.output<typeof adminProductFilterSchema>
export type AdminProductFilterInput = Partial<Record<keyof AdminProductFilters, unknown>>

export const lowStockLimitSchema = z.number().int().min(1).max(100).default(10)

/* ─────────────────────────── Sản phẩm ─────────────────────────── */

export const variantInputSchema = z.object({
  /** Có id = sửa biến thể đó (chỉ updateProduct); không có = thêm mới. */
  id: idSchema("Mã biến thể").optional(),
  /** Bỏ trống thì sinh từ `skuPrefix` của sản phẩm (buildVariantSku). */
  sku: z
    .string({ error: "SKU không hợp lệ" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, "SKU gồm 2-40 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới")
    .optional(),
  size: trimmed("Size", 20),
  color: trimmed("Tên màu", 40),
  colorHex: z.string({ error: "Mã màu không hợp lệ" }).trim().regex(/^#[0-9a-fA-F]{6}$/, "Mã màu phải dạng #RRGGBB"),
  /** Bỏ trống thì lấy bằng `basePrice` của sản phẩm. */
  price: moneySchema("Giá biến thể").optional(),
  stock: stockSchema,
})
export type VariantInput = z.input<typeof variantInputSchema>

/** Service chỉ nhận URL/đường dẫn; việc lưu file vào public/uploads làm ở tầng UI. */
export const imageInputSchema = z.object({
  url: z
    .string({ error: "Đường dẫn ảnh không hợp lệ" })
    .trim()
    .min(1, "Đường dẫn ảnh không được để trống")
    .max(500, "Đường dẫn ảnh quá dài")
    .refine((u) => /^https?:\/\/\S+$/i.test(u) || /^\/(?!\/)\S*$/.test(u), "Ảnh phải là URL http(s) hoặc đường dẫn bắt đầu bằng /"),
  alt: z.string().trim().max(200, "Mô tả ảnh tối đa 200 ký tự").optional(),
})
export type ImageInput = z.input<typeof imageInputSchema>

const tagsSchema = z
  .array(trimmed("Tag", 40))
  .max(20, "Tối đa 20 tag")
  .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))])

const productBase = z.object({
  name: trimmed("Tên sản phẩm", 200, 2),
  /** Bỏ trống thì tự sinh từ tên (thêm hậu tố -2, -3… nếu trùng). Khi sửa, bỏ trống = giữ slug cũ. */
  slug: z
    .string()
    .trim()
    .max(100, "Slug tối đa 100 ký tự")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang")
    .optional(),
  /** Tiền tố để sinh SKU cho biến thể không có `sku` riêng (ô "SKU" của Figma). */
  skuPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{0,29}$/, "Mã SKU chung gồm 1-30 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới")
    .optional(),
  description: trimmed("Mô tả", 5000),
  brand: trimmed("Thương hiệu", 80),
  material: trimmed("Chất liệu", 120),
  style: z.enum(ADMIN_STYLES, { error: "Phong cách không hợp lệ" }),
  occasion: z.array(z.enum(ADMIN_OCCASIONS, { error: "Dịp mặc không hợp lệ" })).max(ADMIN_OCCASIONS.length).transform((a) => [...new Set(a)]),
  season: z.array(z.enum(ADMIN_SEASONS, { error: "Mùa không hợp lệ" })).max(4).transform((a) => [...new Set(a)]),
  gender: z.enum(ADMIN_GENDERS, { error: "Giới tính không hợp lệ" }),
  tags: tagsSchema.default([]),
  basePrice: moneySchema("Giá bán"),
  isActive: z.boolean({ error: "Trạng thái hiển thị không hợp lệ" }).default(true),
  isFeatured: z.boolean().default(false),
  categoryId: idSchema("Danh mục"),
  images: z.array(imageInputSchema).max(MAX_PRODUCT_IMAGES, `Tối đa ${MAX_PRODUCT_IMAGES} ảnh`).default([]),
  variants: z
    .array(variantInputSchema)
    .min(1, "Cần ít nhất một biến thể (size/màu)")
    .max(MAX_PRODUCT_VARIANTS, `Tối đa ${MAX_PRODUCT_VARIANTS} biến thể`),
})

/** Kiểm tra chéo giữa các biến thể: trùng (size,màu), trùng SKU, cùng màu khác mã màu, thiếu SKU. */
function checkVariants(
  p: { skuPrefix?: string; variants: { id?: string; sku?: string; size: string; color: string; colorHex: string }[] },
  ctx: z.RefinementCtx
) {
  const combos = new Set<string>()
  const skus = new Set<string>()
  const ids = new Set<string>()
  const hexByColor = new Map<string, string>()
  p.variants.forEach((v, i) => {
    const add = (message: string, key: string) => ctx.addIssue({ code: "custom", message, path: ["variants", i, key] })
    const combo = `${v.size.toLowerCase()}|${v.color.toLowerCase()}`
    if (combos.has(combo)) add(`Trùng biến thể ${v.color} / ${v.size}`, "size")
    combos.add(combo)

    const sku = v.sku ?? (p.skuPrefix ? buildVariantSku(p.skuPrefix, v.color, v.size) : undefined)
    if (!sku) add("Cần nhập SKU cho biến thể hoặc mã SKU chung của sản phẩm", "sku")
    else {
      if (skus.has(sku)) add(`Trùng SKU ${sku} trong cùng sản phẩm`, "sku")
      skus.add(sku)
    }

    if (v.id) {
      if (ids.has(v.id)) add("Biến thể bị lặp", "id")
      ids.add(v.id)
    }

    const key = v.color.toLowerCase()
    const hex = v.colorHex.toLowerCase()
    const seen = hexByColor.get(key)
    if (seen && seen !== hex) add(`Màu ${v.color} đang có hai mã màu khác nhau`, "colorHex")
    hexByColor.set(key, hex)
  })
}

export const createProductSchema = productBase
  .extend({
    variants: variantInputSchema
      .omit({ id: true })
      .array()
      .min(1, "Cần ít nhất một biến thể (size/màu)")
      .max(MAX_PRODUCT_VARIANTS, `Tối đa ${MAX_PRODUCT_VARIANTS} biến thể`),
  })
  .superRefine(checkVariants)
export type CreateProductInput = z.input<typeof createProductSchema>

/** Sửa = gửi lại toàn bộ form: biến thể có id được sửa, không id được thêm, biến thể cũ vắng mặt bị xoá; ảnh được thay cả danh sách. */
export const updateProductSchema = productBase.superRefine(checkVariants)
export type UpdateProductInput = z.input<typeof updateProductSchema>

/** Biến thể sau khi đã điền SKU và giá mặc định. */
export function resolveVariants<T extends { sku?: string; size: string; color: string; price?: number }>(
  variants: T[],
  skuPrefix: string | undefined,
  basePrice: number
): (Omit<T, "sku" | "price"> & { sku: string; price: number })[] {
  return variants.map((v) => ({
    ...v,
    sku: v.sku ?? buildVariantSku(skuPrefix ?? "", v.color, v.size),
    price: v.price ?? basePrice,
  }))
}

/* ─────────────────────────── Tồn kho ─────────────────────────── */

/** Nút "Nhập": `delta` (cộng/trừ, không để tồn âm) hoặc `newStock` (đặt lại, kiểm kê). Đúng một trong hai. */
export const adjustStockSchema = z
  .object({
    delta: z
      .number({ error: "Số lượng nhập phải là số" })
      .int("Số lượng nhập phải là số nguyên")
      .min(-MAX_STOCK)
      .max(MAX_STOCK)
      .refine((n) => n !== 0, "Số lượng nhập phải khác 0")
      .optional(),
    newStock: stockSchema.optional(),
  })
  .refine((v) => (v.delta === undefined) !== (v.newStock === undefined), "Chỉ nhập một trong hai: số lượng thêm hoặc tồn kho mới")
export type AdjustStockInput = z.input<typeof adjustStockSchema>

/* ─────────────────────────── Danh mục ─────────────────────────── */

export const createCategorySchema = z.object({
  name: trimmed("Tên danh mục", 80, 2),
  description: z
    .string()
    .trim()
    .max(500, "Mô tả tối đa 500 ký tự")
    .optional()
    .transform((v) => v || null),
  /** null/bỏ trống = danh mục gốc. Cây tối đa 2 cấp. */
  parentId: idSchema("Danh mục cha")
    .nullish()
    .transform((v) => v ?? null),
})
export type CreateCategoryInput = z.input<typeof createCategorySchema>

/** Slug được giữ nguyên khi đổi tên (tránh gãy URL/liên kết); chỉ các trường có mặt mới được cập nhật. */
export const updateCategorySchema = z
  .object({
    name: trimmed("Tên danh mục", 80, 2),
    description: z.string().trim().max(500, "Mô tả tối đa 500 ký tự").nullable(),
    parentId: idSchema("Danh mục cha").nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Không có thay đổi nào")
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>

/* ─────────────────────────── Bảng size ─────────────────────────── */

const cm = (label: string, min: number, max: number) =>
  z.number({ error: `${label} phải là số` }).int(`${label} phải là số nguyên`).min(min, `${label} tối thiểu ${min}`).max(max, `${label} tối đa ${max}`)

export const sizeChartRowSchema = z
  .object({
    size: trimmed("Size", 20),
    /** Vòng ngực (cm); bỏ trống với quần. */
    chest: cm("Vòng ngực", 40, 200).nullish().transform((v) => v ?? null),
    waist: cm("Vòng eo", 40, 200),
    hip: cm("Vòng mông", 40, 220),
    heightMin: cm("Chiều cao tối thiểu", 100, 230),
    heightMax: cm("Chiều cao tối đa", 100, 230),
    weightMin: cm("Cân nặng tối thiểu", 10, 250),
    weightMax: cm("Cân nặng tối đa", 10, 250),
  })
  .superRefine((r, ctx) => {
    if (r.heightMin > r.heightMax) ctx.addIssue({ code: "custom", path: ["heightMax"], message: `Size ${r.size}: chiều cao tối thiểu phải ≤ tối đa` })
    if (r.weightMin > r.weightMax) ctx.addIssue({ code: "custom", path: ["weightMax"], message: `Size ${r.size}: cân nặng tối thiểu phải ≤ tối đa` })
  })
export type SizeChartRowInput = z.input<typeof sizeChartRowSchema>

export const sizeChartBrandSchema = z
  .string()
  .trim()
  .max(80, "Thương hiệu tối đa 80 ký tự")
  .nullish()
  .transform((v) => v || null)

export const replaceSizeChartSchema = z
  .array(sizeChartRowSchema)
  .min(1, "Bảng size cần ít nhất một dòng (muốn xoá hết hãy dùng chức năng xoá)")
  .max(30, "Tối đa 30 dòng")
  .superRefine((rows, ctx) => {
    const seen = new Set<string>()
    rows.forEach((r, i) => {
      const key = r.size.toLowerCase()
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i, "size"], message: `Trùng size ${r.size}` })
      seen.add(key)
    })
  })

export const deleteSizeChartRowsSchema = z.array(idSchema("Mã dòng")).min(1, "Chưa chọn dòng nào").max(100)
