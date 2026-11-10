import "server-only"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { sectionLimitSchema } from "@/lib/validators/catalog"
import {
  productFilterSchema,
  type ProductFilterInput,
  type ProductFilters,
} from "@/lib/validators/product-filter"
import { sizeRank } from "@/lib/product-variants"
import type {
  CategoryCardData,
  CategoryDetail,
  FacetValue,
  NavCategory,
  ProductCardData,
  ProductDetail,
  SizeChartRow,
  ProductFacets,
  ProductListResult,
} from "@/types/catalog"

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  gender: true,
  basePrice: true,
  category: { select: { name: true } },
  images: {
    orderBy: { position: "asc" },
    take: 2,
    select: { url: true, alt: true },
  },
  variants: { select: { stock: true, color: true, colorHex: true } },
} satisfies Prisma.ProductSelect

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>

function uniqueColors(variants: { color: string; colorHex: string }[]) {
  const seen = new Map<string, string>()
  for (const v of variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex)
  return [...seen].map(([name, hex]) => ({ name, hex }))
}

function toProductCard(p: ProductCardRow): ProductCardData {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryName: p.category.name,
    gender: p.gender,
    price: p.basePrice,
    image: p.images[0] ?? null,
    hoverImage: p.images[1] ?? null,
    colors: uniqueColors(p.variants),
    inStock: p.variants.some((v) => v.stock > 0),
  }
}

/** Category gốc + con, dùng cho menu header / footer. */
export async function getNavCategories(): Promise<NavCategory[]> {
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      children: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true },
      },
    },
  })
}

/** Category có sản phẩm trực tiếp, kèm ảnh bìa lấy từ sản phẩm mới nhất. */
export async function getHomeCategories(): Promise<CategoryCardData[]> {
  const rows = await db.category.findMany({
    where: { products: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: { where: { isActive: true } } } },
      products: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { url: true, alt: true },
          },
        },
      },
    },
  })

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c._count.products,
    cover: c.products[0]?.images[0] ?? null,
  }))
}

export async function getNewProducts(limit = 8): Promise<ProductCardData[]> {
  const take = sectionLimitSchema.parse(limit)
  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take,
    select: productCardSelect,
  })
  return rows.map(toProductCard)
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  const take = sectionLimitSchema.parse(limit)
  const rows = await db.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take,
    select: productCardSelect,
  })
  return rows.map(toProductCard)
}


export async function getCategoryBySlug(slug: string): Promise<CategoryDetail | null> {
  return db.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parent: { select: { name: true, slug: true } },
      children: { orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } },
    },
  })
}

/* ─────────────────────────── Product listing ─────────────────────────── */

// Một "chiều" lọc. Khi đếm facet của chiều nào thì bỏ riêng bộ lọc của chiều đó
// (disjunctive facet: chọn Size M vẫn thấy số lượng của L, XL để chọn thêm).
type Dim = "size" | "color" | "material" | "style" | "occasion" | "gender" | "price"

interface Scope {
  /** null = không lọc category; [] = category không tồn tại → kết quả rỗng. */
  categoryIds: string[] | null
  /** null = không có từ khoá. */
  searchIds: string[] | null
}

const GENDER_ENUM = { men: "MEN", women: "WOMEN", unisex: "UNISEX" } as const

function variantWhere(f: ProductFilters, omit?: Dim): Prisma.ProductVariantWhereInput {
  const v: Prisma.ProductVariantWhereInput = {}
  if (omit !== "size" && f.size.length) v.size = { in: f.size }
  if (omit !== "color" && f.color.length) v.color = { in: f.color }
  if (f.inStock) v.stock = { gt: 0 }
  return v
}

function productWhere(f: ProductFilters, scope: Scope, omit?: Dim): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }]
  if (scope.categoryIds) and.push({ categoryId: { in: scope.categoryIds } })
  if (scope.searchIds) and.push({ id: { in: scope.searchIds } })
  if (omit !== "gender" && f.gender) and.push({ gender: GENDER_ENUM[f.gender] })
  if (omit !== "material" && f.material.length) and.push({ material: { in: f.material } })
  if (omit !== "style" && f.style.length) and.push({ style: { in: f.style } })
  if (omit !== "occasion" && f.occasion.length) and.push({ occasion: { hasSome: f.occasion } })
  if (omit !== "price" && (f.minPrice !== undefined || f.maxPrice !== undefined)) {
    and.push({ basePrice: { gte: f.minPrice, lte: f.maxPrice } })
  }
  // Size + màu + còn hàng phải khớp trên CÙNG một biến thể (có size M màu Đen còn hàng).
  const vw = variantWhere(f, omit)
  if (Object.keys(vw).length) and.push({ variants: { some: vw } })
  return { AND: and }
}

function orderBy(sort: ProductFilters["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ basePrice: "asc" }, { id: "asc" }]
    case "price_desc":
      return [{ basePrice: "desc" }, { id: "asc" }]
    // Chưa có dữ liệu bán hàng: "nổi bật" làm tín hiệu thay thế. Đổi sang số lượng bán khi có OrderService.
    case "popular":
      return [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }]
    default:
      return [{ createdAt: "desc" }, { id: "asc" }]
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

/** Tìm không dấu bằng extension `unaccent`; mỗi từ phải xuất hiện trong tên / thương hiệu / tag / tên category. */
async function searchProductIds(q: string): Promise<string[]> {
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 8)
  const conds = tokens.map(
    (t) =>
      Prisma.sql`unaccent(lower(p."name" || ' ' || p."brand" || ' ' || array_to_string(p."tags", ' ') || ' ' || c."name")) LIKE unaccent(lower(${`%${escapeLike(t)}%`}))`
  )
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p."id" FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."isActive" = true AND ${Prisma.join(conds, " AND ")}`
  return rows.map((r) => r.id)
}

async function resolveScope(f: ProductFilters): Promise<Scope> {
  const [categoryIds, searchIds] = await Promise.all([
    f.category
      ? db.category
          .findUnique({ where: { slug: f.category }, select: { id: true, children: { select: { id: true } } } })
          .then((c) => (c ? [c.id, ...c.children.map((x) => x.id)] : []))
      : null,
    f.q ? searchProductIds(f.q) : null,
  ])
  return { categoryIds, searchIds }
}

const byCountDesc = (a: FacetValue, b: FacetValue) => b.count - a.count || a.value.localeCompare(b.value, "vi")

function tally<T>(rows: T[], key: (r: T) => string): FacetValue[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
  return [...m].map(([value, count]) => ({ value, count }))
}

async function loadFacets(f: ProductFilters, scope: Scope): Promise<ProductFacets> {
  const [sizeRows, colorRows, materials, styles, genders, occasionRows, price] = await Promise.all([
    // distinct (product, size): mỗi sản phẩm chỉ đếm 1 lần dù có nhiều màu cùng size.
    db.productVariant.findMany({
      where: { ...variantWhere(f, "size"), product: productWhere(f, scope, "size") },
      select: { size: true },
      distinct: ["productId", "size"],
    }),
    db.productVariant.findMany({
      where: { ...variantWhere(f, "color"), product: productWhere(f, scope, "color") },
      select: { color: true, colorHex: true },
      distinct: ["productId", "color"],
    }),
    db.product.groupBy({ by: ["material"], where: productWhere(f, scope, "material"), _count: { _all: true } }),
    db.product.groupBy({ by: ["style"], where: productWhere(f, scope, "style"), _count: { _all: true } }),
    db.product.groupBy({ by: ["gender"], where: productWhere(f, scope, "gender"), _count: { _all: true } }),
    // occasion là mảng text → đếm phía JS (chỉ kéo đúng 1 cột).
    db.product.findMany({ where: productWhere(f, scope, "occasion"), select: { occasion: true } }),
    db.product.aggregate({
      where: productWhere(f, scope, "price"),
      _min: { basePrice: true },
      _max: { basePrice: true },
    }),
  ])

  const hexByColor = new Map(colorRows.map((r) => [r.color, r.colorHex]))
  return {
    sizes: tally(sizeRows, (r) => r.size).sort((a, b) => sizeRank(a.value) - sizeRank(b.value)),
    colors: tally(colorRows, (r) => r.color)
      .sort(byCountDesc)
      .map((c) => ({ ...c, hex: hexByColor.get(c.value) ?? "#cccccc" })),
    materials: materials.map((m) => ({ value: m.material, count: m._count._all })).sort(byCountDesc),
    styles: styles.map((s) => ({ value: s.style, count: s._count._all })).sort(byCountDesc),
    genders: genders.map((g) => ({ value: g.gender.toLowerCase(), count: g._count._all })).sort(byCountDesc),
    occasions: tally(occasionRows.flatMap((r) => r.occasion), (o) => o).sort(byCountDesc),
    price:
      price._min.basePrice !== null && price._max.basePrice !== null
        ? { min: price._min.basePrice, max: price._max.basePrice }
        : null,
  }
}

/**
 * Danh sách sản phẩm + tổng số + facet. Không N+1: Prisma nạp images/variants bằng 1 query IN cho cả trang,
 * facet chạy song song bằng các query gộp (groupBy / distinct), không query theo từng sản phẩm.
 */
export async function listProducts(input: ProductFilterInput = {}): Promise<ProductListResult> {
  const f = productFilterSchema.parse(input)
  const scope = await resolveScope(f)
  const where = productWhere(f, scope)

  const [rows, total, facets] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: orderBy(f.sort),
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: productCardSelect,
    }),
    db.product.count({ where }),
    loadFacets(f, scope),
  ])

  return {
    items: rows.map(toProductCard),
    total,
    page: f.page,
    pageSize: f.pageSize,
    pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
    facets,
  }
}



/* ─────────────────────────── Product detail ─────────────────────────── */

/** null nếu slug không tồn tại hoặc sản phẩm isActive = false (trang trả 404). */
export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const p = await db.product.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      brand: true,
      material: true,
      style: true,
      occasion: true,
      tags: true,
      gender: true,
      categoryId: true,
      category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      images: { orderBy: { position: "asc" }, select: { url: true, alt: true } },
      variants: {
        select: { id: true, sku: true, size: true, color: true, colorHex: true, price: true, stock: true },
      },
    },
  })
  if (!p) return null

  // Bảng size riêng của brand thắng bảng chung (brand = null).
  const charts = await db.sizeChart.findMany({
    where: { categoryId: p.categoryId, OR: [{ brand: p.brand }, { brand: null }] },
    select: {
      brand: true,
      size: true,
      chest: true,
      waist: true,
      hip: true,
      heightMin: true,
      heightMax: true,
      weightMin: true,
      weightMax: true,
    },
  })
  const rows = charts.some((c) => c.brand !== null) ? charts.filter((c) => c.brand !== null) : charts
  const sizeChart: SizeChartRow[] = rows
    .map((c) => ({
      size: c.size,
      chest: c.chest,
      waist: c.waist,
      hip: c.hip,
      heightMin: c.heightMin,
      heightMax: c.heightMax,
      weightMin: c.weightMin,
      weightMax: c.weightMax,
    }))
    .sort((a, b) => sizeRank(a.size) - sizeRank(b.size))

  return { ...p, variants: p.variants.sort((a, b) => sizeRank(a.size) - sizeRank(b.size)), sizeChart }
}

/** Cùng category hoặc cùng style; cùng cả hai xếp trước, cùng category xếp trước cùng style. 1 query. */
export async function getRelatedProducts(
  product: Pick<ProductDetail, "id" | "categoryId" | "style">,
  limit = 4
): Promise<ProductCardData[]> {
  const take = sectionLimitSchema.parse(limit)
  const rows = await db.product.findMany({
    where: {
      isActive: true,
      id: { not: product.id },
      OR: [{ categoryId: product.categoryId }, { style: product.style }],
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: 48,
    select: { ...productCardSelect, categoryId: true, style: true },
  })
  const score = (r: (typeof rows)[number]) =>
    (r.categoryId === product.categoryId ? 2 : 0) + (r.style === product.style ? 1 : 0)
  // sort ổn định: trong cùng điểm giữ thứ tự nổi bật/mới nhất của query.
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => score(b.r) - score(a.r) || a.i - b.i)
    .slice(0, take)
    .map(({ r }) => toProductCard(r))
}


