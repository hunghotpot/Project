/*
 * Phân tích giá viết tay trong câu tìm kiếm tiếng Việt ("dưới 500k", "1tr2", "từ 200 đến 500k", "2 củ rưỡi")
 * thành khoảng giá VND (docs/ai/02-semantic-search.md mục 4). Hàm thuần, chạy được cả server lẫn client.
 *
 * Giá chỉ lấy từ đây, KHÔNG lấy từ LLM: model nhỏ hay bịa minPrice/maxPrice khi câu không nêu giá.
 * Quy ước: "dưới/nhỏ hơn/rẻ hơn" loại trừ mốc (max = mốc - 1), "không quá/tối đa" bao gồm mốc; "trên/lớn hơn" loại trừ
 * (min = mốc + 1), "từ/tối thiểu/trở lên" bao gồm. Số tiền không kèm từ chỉ hướng ("áo 500k", "tầm 500k") hiểu là
 * khoảng ±20%. Hai điều kiện mâu thuẫn ("dưới 100k trên 200k") thì bỏ cả hai.
 */

export interface PriceRange {
  minPrice?: number
  maxPrice?: number
}

const MIN_MONEY = 1_000
const MAX_MONEY = 100_000_000
/** Số không kèm đơn vị chỉ coi là tiền khi đủ lớn ("500000"), để không nhầm với size, năm, số lượng. */
const MIN_UNITLESS_MONEY = 10_000
const AROUND_RATIO = 0.2

const UNIT_MULTIPLIER: Record<string, number> = {
  trieu: 1_000_000,
  tr: 1_000_000,
  cu: 1_000_000,
  nghin: 1_000,
  ngan: 1_000,
  k: 1_000,
  chai: 100_000,
  lit: 100_000,
}
const PLAIN_UNITS = new Set(["vnd", "dong", "d"])
const MILLION_UNITS = new Set(["trieu", "tr", "cu"])

type Cue = "lt" | "lte" | "gt" | "gte" | "around"

/** Thứ tự quan trọng: khi hai cụm kết thúc cùng chỗ ("nhỏ hơn" và "hơn") cụm đứng trước thắng. */
const CUES: [RegExp, Cue][] = [
  [/\b(?:duoi|nho hon|re hon|thap hon|it hon|kem)\b/g, "lt"],
  [/\b(?:khong qua|ko qua|toi da|khong vuot qua|max|budget|ngan sach)\b/g, "lte"],
  [/\b(?:tren|lon hon|dat hon|cao hon|hon)\b/g, "gt"],
  [/\b(?:toi thieu|it nhat|min|tu)\b/g, "gte"],
  [/\b(?:khoang|tam|xap xi|quanh|gan|chung)\b/g, "around"],
]
const AFTER_GTE = /^\s*(?:tro len|do len|tro ra)\b/
const AFTER_LTE = /^\s*(?:tro xuong|do xuong|tro lai|do lai)\b/

function normalize(query: string): string {
  return query
    .toLowerCase()
    .replace(/<=|≤|=</g, " toi da ")
    .replace(/>=|≥|=>/g, " toi thieu ")
    .replace(/</g, " duoi ")
    .replace(/>/g, " tren ")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/[–—~]/g, "-")
    .replace(/\bnua\s+(trieu|cu)\b/g, "0.5 $1")
    .replace(/[^a-z0-9.,\- ]/g, " ")
}

interface Token {
  start: number
  end: number
  num: string
  unit?: string
  /** Chữ số ngay sau "tr"/"triệu"/"củ": "1tr2" = 1,2 triệu, "1tr25" = 1,25 triệu. */
  suffix?: string
  half: boolean
}

const TOKEN =
  /(?<![a-z0-9.,])(\d+(?:[.,]\d+)*)(?:\s*(trieu|tr|cu)(?![a-z])(?:\s+(ruoi)(?![a-z])|(\d{1,3})(?!\d))?|\s*(nghin|ngan|chai|lit|k|vnd|dong|d)(?![a-z]))?/g

function findTokens(text: string): Token[] {
  return [...text.matchAll(TOKEN)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    num: m[1],
    unit: m[2] ?? m[5],
    suffix: m[4],
    half: m[3] === "ruoi",
  }))
}

/** Giá trị VND của một token, hoặc null nếu không phải tiền. */
function moneyValue(t: Token): number | null {
  let value: number
  const multiplier = t.unit ? UNIT_MULTIPLIER[t.unit] : undefined
  if (multiplier) {
    // Có đơn vị nhân: dấu , hoặc . là dấu thập phân ("1,5tr"); nhiều dấu thì không hợp lệ.
    if (!/^\d+(?:[.,]\d+)?$/.test(t.num)) return null
    value = parseFloat(t.num.replace(",", ".")) * multiplier
    if (t.unit && MILLION_UNITS.has(t.unit)) {
      if (t.suffix) value += (parseInt(t.suffix, 10) / 10 ** t.suffix.length) * 1_000_000
      else if (t.half) value += 500_000
    }
  } else {
    // Không đơn vị (hoặc đ/vnd): dấu phân cách hàng nghìn, ví dụ 500.000 hoặc 1,200,000.
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(t.num)) value = parseInt(t.num.replace(/[.,]/g, ""), 10)
    else if (/^\d+$/.test(t.num)) value = parseInt(t.num, 10)
    else return null
    if (!t.unit || !PLAIN_UNITS.has(t.unit)) {
      if (value < MIN_UNITLESS_MONEY) return null
    }
  }
  value = Math.round(value)
  return value >= MIN_MONEY && value <= MAX_MONEY ? value : null
}

function cueBefore(text: string, start: number, prevEnd: number): Cue {
  const window = text.slice(Math.max(prevEnd, start - 26), start)
  let best: { cue: Cue; end: number } | undefined
  for (const [re, cue] of CUES) {
    for (const m of window.matchAll(re)) {
      const end = m.index + m[0].length
      if (!best || end > best.end) best = { cue, end }
    }
  }
  return best?.cue ?? "around"
}

function cueFor(text: string, tokens: Token[], i: number): Cue {
  const after = text.slice(tokens[i].end, tokens[i].end + 16)
  if (AFTER_GTE.test(after)) return "gte"
  if (AFTER_LTE.test(after)) return "lte"
  return cueBefore(text, tokens[i].start, i > 0 ? tokens[i - 1].end : 0)
}

const roundThousand = (n: number) => Math.round(n / 1000) * 1000

function toRange(cue: Cue, v: number): PriceRange {
  switch (cue) {
    case "lt":
      return { maxPrice: v - 1 }
    case "lte":
      return { maxPrice: v }
    case "gt":
      return { minPrice: v + 1 }
    case "gte":
      return { minPrice: v }
    case "around":
      return { minPrice: roundThousand(v * (1 - AROUND_RATIO)), maxPrice: roundThousand(v * (1 + AROUND_RATIO)) }
  }
}

/** Đọc khoảng giá từ câu tiếng Việt. Câu không nêu giá trả về `{}`. */
export function parsePriceRange(query: string): PriceRange {
  const text = normalize(query)
  const tokens = findTokens(text)
  const candidates: PriceRange[] = []

  for (let i = 0; i < tokens.length; i++) {
    const next = tokens[i + 1]
    if (next && /^\s*(?:-|den|toi)\s*$/.test(text.slice(tokens[i].end, next.start))) {
      // "300 đến 500k": số đầu chưa có đơn vị thì mượn đơn vị của số sau.
      if (!tokens[i].unit && next.unit && UNIT_MULTIPLIER[next.unit]) tokens[i] = { ...tokens[i], unit: next.unit }
      const lo = moneyValue(tokens[i])
      const hi = moneyValue(next)
      if (lo !== null && hi !== null) {
        candidates.push({ minPrice: Math.min(lo, hi), maxPrice: Math.max(lo, hi) })
        i++
        continue
      }
    }
    const value = moneyValue(tokens[i])
    if (value !== null) candidates.push(toRange(cueFor(text, tokens, i), value))
  }

  let minPrice: number | undefined
  let maxPrice: number | undefined
  for (const c of candidates) {
    if (c.minPrice !== undefined) minPrice = Math.max(minPrice ?? 0, c.minPrice)
    if (c.maxPrice !== undefined) maxPrice = Math.min(maxPrice ?? Infinity, c.maxPrice)
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return {}
  const result: PriceRange = {}
  if (minPrice !== undefined) result.minPrice = minPrice
  if (maxPrice !== undefined) result.maxPrice = maxPrice
  return result
}
