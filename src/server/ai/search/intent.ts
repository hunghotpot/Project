import { parsePriceRange } from "@/lib/ai/vi-price"
import { findSynonymHints, type SynonymHint, type SynonymSeason } from "@/lib/ai/vi-synonyms"

/*
 * Hiểu câu tìm kiếm bằng CODE (từ điển lóng + hàm giá + từ vựng thật của kho), không gọi LLM.
 * Đo thực tế: model 4B bịa giá, chọn sai danh mục và giới tính khi trích bộ lọc, nên mọi điều kiện CỨNG (giá, giới tính, danh mục,
 * size, màu) chỉ đến từ đây; điều kiện MỀM (dịp, mùa, phong cách) chỉ cộng điểm xếp hạng (docs/ai/02-semantic-search.md mục 3.1).
 */

export type GenderEnum = "MEN" | "WOMEN" | "UNISEX"

/** Nhóm sản phẩm (khoá của từ điển) → slug category lá. Khớp `PRODUCT_GROUPS` trong prisma/seed-data/categories.ts (có test). */
export const CATEGORY_GROUP_LEAVES: Record<string, string[]> = {
  "ao-thun": ["ao-thun-nam", "ao-thun-nu", "ao-thun-unisex"],
  "ao-so-mi": ["ao-so-mi-nam", "ao-so-mi-nu", "ao-so-mi-unisex"],
  "ao-khoac": ["ao-khoac-nam", "ao-khoac-nu", "ao-khoac-unisex"],
  "quan-jeans": ["quan-jeans-nam", "quan-jeans-nu", "quan-unisex"],
  "quan-tay-kaki": ["quan-tay-kaki-nam", "quan-tay-kaki-nu", "quan-unisex"],
  "vay-dam": ["vay-dam"],
  "vest-du-tiec-nam": ["vest-du-tiec-nam"],
  "phu-kien": ["phu-kien"],
}

/** Tên hiển thị cho khách của từng nhóm sản phẩm (cùng khoá với CATEGORY_GROUP_LEAVES). */
export const CATEGORY_GROUP_LABELS: Record<string, string> = {
  "ao-thun": "Áo thun",
  "ao-so-mi": "Áo sơ mi",
  "ao-khoac": "Áo khoác",
  "quan-jeans": "Quần jeans",
  "quan-tay-kaki": "Quần tây & kaki",
  "vay-dam": "Váy đầm",
  "vest-du-tiec-nam": "Vest & đồ dự tiệc nam",
  "phu-kien": "Phụ kiện",
}

export const MAX_QUERY_CHARS = 200

export interface SearchIntent {
  /** Câu đã chuẩn hoá (bỏ ký tự điều khiển, gộp khoảng trắng, cắt độ dài). */
  query: string
  /** Tên nhóm sản phẩm đã nhận ra (để hiển thị), khi có `hard.categoryLeaves`. */
  categoryLabel?: string
  /** Văn bản đem embed: câu gốc kèm các cụm ý nghĩa từ từ điển. */
  semanticText: string
  /** Từ khoá không dấu cho tìm LIKE (bỏ từ đệm, số và từ chỉ giá). */
  keywords: string[]
  hard: {
    /** null = không giới hạn giới tính. "Nam"/"nữ" luôn gồm cả UNISEX. */
    genders: GenderEnum[] | null
    /** Slug category lá; null = không giới hạn. */
    categoryLeaves: string[] | null
    minPrice?: number
    maxPrice?: number
    sizes: string[]
    colors: string[]
  }
  soft: { occasion: string[]; season: SynonymSeason[]; style: string[] }
  sort?: NonNullable<SynonymHint["sort"]>
  /** Khách muốn nhiều món phối cùng nhau (Mix & Match). */
  outfit: boolean
  outOfScope?: string
}

const STOPWORDS = new Set(
  (
    "do cho di mac gi va co la cua toi nay nhung mot cac hay can tim minh ban muon nen the nao " +
    "con hang size duoi tren khoang tam toi thieu da den tu khong qua nguoi voi o khi nhu rat hon bo"
  ).split(" "),
)
const MONEY_WORDS = new Set(["k", "tr", "trieu", "nghin", "ngan", "cu", "chai", "lit", "vnd", "dong", "d"])

const GENDERS: Record<"men" | "women" | "unisex", GenderEnum[]> = {
  men: ["MEN", "UNISEX"],
  women: ["WOMEN", "UNISEX"],
  unisex: ["UNISEX"],
}

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const fold = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim()

function normalizeQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_CHARS)
}

/**
 * Tên màu của kho xuất hiện trong câu (khớp nguyên từ; câu có dấu so khớp theo dạng có dấu để "bé" không thành màu "Be").
 * Khi có "Nâu bò" thì bỏ "Nâu": giữ tên màu dài nhất.
 */
function colorsIn(query: string, vocabulary: string[]): string[] {
  const accented = ` ${fold(query)} `
  const unaccented = ` ${plain(query)} `
  const usePlain = accented === unaccented
  const hay = usePlain ? unaccented : accented
  const key = (c: string) => (usePlain ? plain(c) : fold(c))
  const hits = vocabulary.filter((c) => hay.includes(` ${key(c)} `))
  return hits.filter((c) => !hits.some((o) => o !== c && ` ${key(o)} `.includes(` ${key(c)} `)))
}

function sizesIn(query: string): string[] {
  const out = new Set<string>()
  for (const m of plain(query).matchAll(/\b(?:size|sz)\s*(xxxl|xxl|xl|xs|s|m|l|\d{2})\b/g)) out.add(m[1].toUpperCase())
  return [...out]
}

function keywordsOf(query: string): string[] {
  const seen = new Set<string>()
  for (const t of plain(query).split(" ")) {
    if (t.length < 2 || /\d/.test(t) || STOPWORDS.has(t) || MONEY_WORDS.has(t)) continue
    seen.add(t)
  }
  return [...seen].slice(0, 8)
}

const union = <T>(...lists: (T[] | undefined)[]) => [...new Set(lists.flatMap((l) => l ?? []))]

export function buildSearchIntent(rawQuery: string, vocabulary: { colors: string[] }): SearchIntent {
  const query = normalizeQuery(rawQuery)
  const hint = findSynonymHints(query)
  const price = parsePriceRange(query)
  const leaves = hint.category ? CATEGORY_GROUP_LEAVES[hint.category] : undefined
  // Viết dịp và mùa theo đúng cách văn bản sản phẩm được embed ("Dịp mặc: …. Mùa: …") để vector khớp gần hơn.
  const occasion = hint.occasion?.length ? `Dịp mặc: ${hint.occasion.join(", ")}` : undefined
  const season = hint.season?.length ? `Mùa: ${hint.season.join(", ")}` : undefined

  return {
    query,
    categoryLabel: hint.category ? CATEGORY_GROUP_LABELS[hint.category] : undefined,
    semanticText: [query, ...(hint.semantic ?? []), occasion, season].filter(Boolean).join(". "),
    keywords: keywordsOf(query),
    hard: {
      genders: hint.gender ? GENDERS[hint.gender] : null,
      categoryLeaves: leaves ?? null,
      ...price,
      sizes: sizesIn(query),
      colors: union(colorsIn(query, vocabulary.colors), hint.color?.filter((c) => vocabulary.colors.includes(c))),
    },
    soft: { occasion: hint.occasion ?? [], season: hint.season ?? [], style: hint.style ?? [] },
    sort: hint.sort,
    outfit: hint.outfit === true,
    outOfScope: hint.outOfScope,
  }
}
