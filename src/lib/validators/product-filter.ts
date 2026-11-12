import { z } from "zod"

/*
 * MỘT schema duy nhất cho bộ lọc sản phẩm: parse URL (searchParams) và gọi catalog.service.
 * - Lỏng với URL: giá trị sai không làm hỏng trang, chỉ rơi về mặc định (.catch).
 * - Idempotent: parse(output) cho ra đúng output, nên service có thể parse lại input từ AI/tool-calling.
 * - Mảng nhận cả dạng lặp key (?size=M&size=L) lẫn phân tách dấu phẩy (?size=M,L).
 */

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "popular"] as const
export type ProductSort = (typeof PRODUCT_SORTS)[number]

export const PRODUCT_GENDERS = ["men", "women", "unisex"] as const
export type ProductGender = (typeof PRODUCT_GENDERS)[number]

export const DEFAULT_PAGE_SIZE = 12
export const MAX_PAGE_SIZE = 48

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

const listParam = z
  .preprocess((v) => {
    const items = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]
    const flat = items
      .flatMap((x) => (typeof x === "string" ? x.split(",") : []))
      .map((s) => s.trim())
      .filter(Boolean)
    return [...new Set(flat)]
  }, z.array(z.string().max(60)).max(20))
  .catch([])

const priceParam = z
  .preprocess(
    (v) => (first(v) === "" || first(v) == null ? undefined : first(v)),
    z.coerce.number().int().min(0).max(100_000_000).optional()
  )
  .catch(undefined)

const textParam = (max: number) =>
  z
    .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).trim() : undefined), z.string().max(max).optional())
    .transform((v) => v || undefined)
    .catch(undefined)

export const productFilterSchema = z
  .object({
    /** Từ khoá tìm kiếm (không phân biệt dấu). */
    q: textParam(100),
    /** Slug category; category cha bao gồm cả sản phẩm của category con. */
    category: textParam(100),
    size: listParam,
    color: listParam,
    material: listParam,
    style: listParam,
    occasion: listParam,
    /** Mùa (xuân | hè | thu | đông); khớp khi sản phẩm có ít nhất một mùa trùng. */
    season: listParam,
    gender: z
      .preprocess((v) => (typeof first(v) === "string" ? (first(v) as string).toLowerCase() : v), z.enum(PRODUCT_GENDERS).optional())
      .catch(undefined),
    minPrice: priceParam,
    maxPrice: priceParam,
    inStock: z
      .preprocess((v) => (["1", "true", true].includes(first(v) as string | boolean) ? true : undefined), z.literal(true).optional())
      .catch(undefined),
    sort: z.preprocess(first, z.enum(PRODUCT_SORTS)).catch("newest"),
    page: z.preprocess(first, z.coerce.number().int().min(1).max(10_000)).catch(1),
    pageSize: z
      .preprocess(first, z.coerce.number().int().min(1).max(MAX_PAGE_SIZE))
      .catch(DEFAULT_PAGE_SIZE),
  })
  .transform((f) => {
    // minPrice > maxPrice: đảo lại thay vì trả về danh sách rỗng khó hiểu.
    if (f.minPrice !== undefined && f.maxPrice !== undefined && f.minPrice > f.maxPrice) {
      return { ...f, minPrice: f.maxPrice, maxPrice: f.minPrice }
    }
    return f
  })

export type ProductFilters = z.output<typeof productFilterSchema>
/** Input cho service: bất kỳ tập con nào của filter, phần còn lại lấy mặc định. */
export type ProductFilterInput = Partial<ProductFilters>

export type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>

/** URLSearchParams / searchParams của Next → ProductFilters. */
export function parseProductFilters(input: SearchParamsLike): ProductFilters {
  const raw: Record<string, string | string[] | undefined> = {}
  if (input instanceof URLSearchParams) {
    for (const key of new Set(input.keys())) raw[key] = input.getAll(key)
  } else {
    Object.assign(raw, input)
  }
  return productFilterSchema.parse(raw)
}

export const FILTER_LIST_KEYS = ["size", "color", "material", "style", "occasion", "season"] as const
export type FilterListKey = (typeof FILTER_LIST_KEYS)[number]

/** ProductFilters → URLSearchParams, bỏ giá trị mặc định để URL ngắn gọn. */
export function serializeProductFilters(
  f: ProductFilters,
  opts: { omitCategory?: boolean } = {}
): URLSearchParams {
  const sp = new URLSearchParams()
  if (f.q) sp.set("q", f.q)
  if (f.category && !opts.omitCategory) sp.set("category", f.category)
  for (const key of FILTER_LIST_KEYS) for (const v of f[key]) sp.append(key, v)
  if (f.gender) sp.set("gender", f.gender)
  if (f.minPrice !== undefined) sp.set("minPrice", String(f.minPrice))
  if (f.maxPrice !== undefined) sp.set("maxPrice", String(f.maxPrice))
  if (f.inStock) sp.set("inStock", "1")
  if (f.sort !== "newest") sp.set("sort", f.sort)
  if (f.page > 1) sp.set("page", String(f.page))
  if (f.pageSize !== DEFAULT_PAGE_SIZE) sp.set("pageSize", String(f.pageSize))
  return sp
}
