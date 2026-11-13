import "server-only"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { listProducts } from "@/server/services/catalog.service"
import type { ProductListResult } from "@/types/catalog"
import { embedQuery } from "../core/embedding-cache"
import type { AiConfig } from "../core/env"
import { buildSearchIntent, type SearchIntent } from "./intent"

/*
 * Semantic Search (docs/ai/02-semantic-search.md): lọc cứng bằng SQL ∩ (vector + từ khoá), hợp nhất RRF, cộng điểm điều kiện mềm,
 * nới lỏng khi ít kết quả, luôn có đường lui bằng từ khoá. Kết quả trả về cùng kiểu `ProductListResult` để giao diện lọc dùng lại.
 *
 * Điều kiện cứng không bao giờ bị nới: còn hàng, giới tính, giá khách đã nêu. Chỉ nới size, màu rồi loại sản phẩm (có báo lại).
 * Chỉ trả sản phẩm còn hàng và đang bán.
 */

const RRF_K = 60
/** Điểm cộng mỗi điều kiện mềm khớp (dịp, mùa, phong cách), so với điểm RRF của một hạng ≈ 1/60. */
const SOFT_BOOST = 0.004
const CANDIDATE_LIMIT = 50
const MIN_RESULTS = 3
const COLOR_CACHE_MS = 10 * 60 * 1000

export interface SearchOptions {
  page?: number
  pageSize?: number
  /** Có cấu hình AI thì dùng vector; null/undefined: chỉ tìm bằng từ khoá. */
  config?: AiConfig | null
}

/** Danh sách id đã xếp hạng (chưa nạp thẻ sản phẩm), để trang danh sách tự áp thêm bộ lọc của khách. */
export interface RankedProducts {
  ids: string[]
  intent: SearchIntent
  mode: "semantic" | "keyword"
  /** Điều đã nới để có kết quả, để giao diện báo cho khách. */
  relaxed: string[]
  /** Chỉ có khi có cấu hình AI nhưng vector không dùng được (lỗi hoặc quá hạn); không có cấu hình thì không phải sự cố nên không có thông báo. */
  notice?: string
}

export interface SearchResult extends Omit<RankedProducts, "ids"> {
  result: ProductListResult
}

let colorCache: { at: number; colors: string[] } | undefined

/** Tên màu thật của kho, dùng làm từ vựng cho bước hiểu câu. */
async function loadColorVocabulary(): Promise<string[]> {
  if (colorCache && Date.now() - colorCache.at < COLOR_CACHE_MS) return colorCache.colors
  const rows = await db.productVariant.findMany({ distinct: ["color"], select: { color: true } })
  colorCache = { at: Date.now(), colors: rows.map((r) => r.color) }
  return colorCache.colors
}

interface Relax {
  size: boolean
  color: boolean
  category: boolean
}

function hardConditions(intent: SearchIntent, relax: Relax): Prisma.Sql[] {
  const h = intent.hard
  const where = [Prisma.sql`p."isActive" = true`]
  if (h.genders) where.push(Prisma.sql`p."gender"::text IN (${Prisma.join(h.genders)})`)
  if (h.categoryLeaves && !relax.category) {
    where.push(Prisma.sql`p."categoryId" IN (SELECT "id" FROM "Category" WHERE "slug" IN (${Prisma.join(h.categoryLeaves)}))`)
  }
  if (h.minPrice !== undefined) where.push(Prisma.sql`p."basePrice" >= ${h.minPrice}`)
  if (h.maxPrice !== undefined) where.push(Prisma.sql`p."basePrice" <= ${h.maxPrice}`)
  // Luôn cần một biến thể còn hàng; size và màu (nếu chưa nới) phải khớp trên CÙNG biến thể đó.
  const variant = [Prisma.sql`v."stock" > 0`]
  if (h.sizes.length && !relax.size) variant.push(Prisma.sql`v."size" IN (${Prisma.join(h.sizes)})`)
  if (h.colors.length && !relax.color) variant.push(Prisma.sql`v."color" IN (${Prisma.join(h.colors)})`)
  where.push(Prisma.sql`EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id" AND ${Prisma.join(variant, " AND ")})`)
  return where
}

async function semanticRank(vector: number[], where: Prisma.Sql[]): Promise<string[]> {
  const literal = `[${vector.join(",")}]`
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p."id" FROM "Product" p JOIN "ProductEmbedding" e ON e."productId" = p."id"
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY e."embedding" <=> ${literal}::vector, p."id"
    LIMIT ${CANDIDATE_LIMIT}`
  return rows.map((r) => r.id)
}

async function keywordRank(keywords: string[], where: Prisma.Sql[]): Promise<string[]> {
  if (!keywords.length) return []
  // concat_ws bỏ qua giá trị NULL: sản phẩm không có tag (tags NULL) vẫn tìm được theo tên.
  const haystack = Prisma.sql`unaccent(lower(concat_ws(' ', p."name", p."brand", array_to_string(p."tags", ' '), c."name")))`
  // Khớp nguyên từ (\m…\M): "ho" không được khớp "khoác". Từ khoá đã là chữ và số không dấu nên không cần escape.
  const matches = keywords.map((k) => Prisma.sql`${haystack} ~ ${`\\m${k}\\M`}`)
  const score = Prisma.join(matches.map((m) => Prisma.sql`(CASE WHEN ${m} THEN 1 ELSE 0 END)`), " + ")
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p."id" FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
    WHERE ${Prisma.join(where, " AND ")} AND (${Prisma.join(matches, " OR ")})
    ORDER BY (${score}) DESC, p."createdAt" DESC, p."id"
    LIMIT ${CANDIDATE_LIMIT}`
  return rows.map((r) => r.id)
}

/** Hợp nhất các danh sách xếp hạng bằng RRF rồi cộng điểm điều kiện mềm; trả id theo điểm giảm dần. */
async function fuse(lists: string[][], intent: SearchIntent): Promise<string[]> {
  const score = new Map<string, number>()
  for (const list of lists) list.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (RRF_K + i + 1)))
  if (!score.size) return []

  const attrs = await db.product.findMany({
    where: { id: { in: [...score.keys()] } },
    select: { id: true, occasion: true, season: true, style: true, basePrice: true, createdAt: true, isFeatured: true },
  })
  const { occasion, season, style } = intent.soft
  for (const a of attrs) {
    let boost = 0
    if (occasion.some((o) => a.occasion.includes(o))) boost += SOFT_BOOST
    if (season.some((s) => a.season.includes(s))) boost += SOFT_BOOST
    if (style.includes(a.style)) boost += SOFT_BOOST
    score.set(a.id, (score.get(a.id) ?? 0) + boost)
  }

  const ranked = [...score].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id)
  if (!intent.sort) return ranked

  // Khách nói "rẻ / mới / bán chạy": trong nhóm liên quan nhất thì xếp theo tiêu chí đó.
  const byId = new Map(attrs.map((a) => [a.id, a]))
  const top = ranked.slice(0, 20)
  const key = (id: string) => {
    const a = byId.get(id)
    if (!a) return 0
    if (intent.sort === "price_asc") return a.basePrice
    if (intent.sort === "newest") return -a.createdAt.getTime()
    return a.isFeatured ? -1 : 0
  }
  top.sort((x, y) => key(x) - key(y))
  return [...top, ...ranked.slice(20)]
}

/** Các bước nới lỏng theo thứ tự (chỉ gồm bước thật sự bỏ được điều kiện nào đó). */
function relaxSteps(intent: SearchIntent): { relax: Relax; note: string }[] {
  const h = intent.hard
  const relax: Relax = { size: false, color: false, category: false }
  const steps: { relax: Relax; note: string }[] = []
  if (h.sizes.length) {
    relax.size = true
    steps.push({ relax: { ...relax }, note: `Chưa có size ${h.sizes.join(", ")} còn hàng, đã bỏ điều kiện size` })
  }
  if (h.colors.length) {
    relax.color = true
    steps.push({ relax: { ...relax }, note: `Đã bỏ điều kiện màu ${h.colors.join(", ")}` })
  }
  if (h.categoryLeaves) {
    relax.category = true
    steps.push({ relax: { ...relax }, note: "Đã bỏ điều kiện loại sản phẩm" })
  }
  return steps
}

/**
 * Xếp hạng sản phẩm cho một câu tìm kiếm: trả id theo thứ tự phù hợp giảm dần (tối đa vài chục), kèm ý định đã hiểu.
 * Câu rỗng trả danh sách rỗng.
 */
export async function findRankedProducts(rawQuery: string, options: Pick<SearchOptions, "config"> = {}): Promise<RankedProducts> {
  const { config = null } = options
  const intent = buildSearchIntent(rawQuery, { colors: await loadColorVocabulary() })
  if (!intent.query) return { ids: [], intent, mode: "keyword", relaxed: [] }

  let vector: number[] | undefined
  let notice: string | undefined
  if (config) {
    try {
      vector = await embedQuery(intent.semanticText, config)
    } catch (e) {
      console.error("[ai-search] embedding lỗi, chuyển sang tìm kiếm từ khoá:", e instanceof Error ? e.message : e)
      notice = "Đang dùng tìm kiếm thường vì tìm kiếm thông minh tạm thời không dùng được"
    }
  }

  const rank = async (relax: Relax) => {
    const where = hardConditions(intent, relax)
    const [semantic, keyword] = await Promise.all([vector ? semanticRank(vector, where) : [], keywordRank(intent.keywords, where)])
    return fuse([semantic, keyword], intent)
  }

  let ids = await rank({ size: false, color: false, category: false })
  const relaxed: string[] = []
  if (ids.length < MIN_RESULTS) {
    for (const step of relaxSteps(intent)) {
      ids = await rank(step.relax)
      relaxed.push(step.note)
      if (ids.length >= MIN_RESULTS) break
    }
  }

  return { ids, intent, mode: vector ? "semantic" : "keyword", relaxed, notice }
}

/** Tìm kiếm trọn gói: xếp hạng rồi nạp thẻ sản phẩm theo thứ tự đó (cùng kiểu ProductListResult của giao diện lọc). */
export async function searchProducts(rawQuery: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { page = 1, pageSize = 12, config = null } = options
  const ranked = await findRankedProducts(rawQuery, { config })
  const { ids, ...rest } = ranked
  if (!ranked.intent.query) {
    return { ...rest, result: await listProducts({ page, pageSize, inStock: true }, { includeUnisex: true }) }
  }
  return { ...rest, result: await listProducts({ page, pageSize, inStock: true }, { includeUnisex: true, onlyIds: ids }) }
}
