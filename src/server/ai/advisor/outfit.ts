/*
 * Mix & Match (docs/ai/03-rag-advisor.md mục 4): chọn các món phối thành một bộ. HÀM THUẦN, không gọi DB hay LLM.
 *
 * Khác thiết kế ban đầu ("LLM chọn trong tập ứng viên"): code chọn hết, LLM chỉ diễn đạt. Lý do (đo ở docs/ai/04 mục 7): model 4B bịa
 * điều kiện, bịa tên sản phẩm và hay bỏ qua tool, nên việc chọn món, tính tổng tiền, kiểm tồn kho đều nằm ở code; lý do từng món cũng
 * do code dựng từ thuộc tính thật (dịp, mùa, phong cách, màu), không có câu nào do model bịa.
 * Chọn bằng tìm kiếm vét cạn trên vài ứng viên tốt nhất mỗi ô (≤ 6 món × ≤ 2 màu mỗi ô): điểm cao nhất, trong ngân sách, kết quả ổn định.
 */
import { sizeMatches } from "../core/size-match"

export type OutfitSlot = "top" | "bottom" | "dress" | "outer" | "accessory"
export type OutfitGender = "men" | "women" | "unisex"

export interface OutfitCandidate {
  id: string
  name: string
  slug: string
  slot: OutfitSlot
  style: string
  occasion: string[]
  season: string[]
  /** Giá hiển thị (VND), tính vào tổng. */
  price: number
  image: { url: string; alt: string } | null
  /** Các màu còn hàng, kèm các size còn hàng của màu đó. Chỉ có biến thể còn hàng. */
  colors: { name: string; sizes: string[] }[]
}

export interface OutfitRequest {
  gender: OutfitGender
  occasions: string[]
  seasons: string[]
  /** Tổng ngân sách cho cả bộ (VND). */
  budget?: number
  /** Size khách nói (vd "M"): chỉ chọn màu còn size đó. */
  size?: string
  /** Sản phẩm khách đã chọn sẵn: nằm cố định trong bộ, các món khác phối quanh nó. */
  anchor?: OutfitCandidate
}

export interface OutfitPick {
  slot: OutfitSlot
  candidate: OutfitCandidate
  color: string
  /** Lý do do code dựng từ thuộc tính thật. */
  reason: string
}

export interface OutfitPlan {
  picks: OutfitPick[]
  /** Tổng tiền do code cộng, không lấy từ model. */
  totalPrice: number
  /** Ô cần có theo quy tắc phối nhưng không có món hợp lệ. */
  missingSlots: OutfitSlot[]
}

export type OutfitResult = { ok: true; plan: OutfitPlan } | { ok: false; reason: "no_items" | "over_budget" }

export const SLOT_LABEL: Record<OutfitSlot, string> = { top: "áo", bottom: "quần hoặc chân váy", dress: "váy đầm", outer: "áo khoác", accessory: "phụ kiện" }

/** Ô của một danh mục lá (null: không dùng để phối, vd danh mục lạ). */
export function slotOf(categorySlug: string): OutfitSlot | null {
  if (categorySlug === "vay-dam") return "dress"
  if (categorySlug === "phu-kien") return "accessory"
  if (categorySlug.startsWith("ao-khoac-") || categorySlug.startsWith("vest-")) return "outer"
  if (categorySlug.startsWith("ao-")) return "top"
  if (categorySlug.startsWith("quan-")) return "bottom"
  return null
}

/** Danh mục lá dùng cho từng ô (khớp seed `prisma/seed-data/categories.ts`). */
export const SLOT_CATEGORIES: Record<OutfitSlot, string[]> = {
  top: ["ao-thun-nam", "ao-thun-nu", "ao-thun-unisex", "ao-so-mi-nam", "ao-so-mi-nu", "ao-so-mi-unisex"],
  bottom: ["quan-jeans-nam", "quan-jeans-nu", "quan-tay-kaki-nam", "quan-tay-kaki-nu", "quan-unisex"],
  dress: ["vay-dam"],
  outer: ["ao-khoac-nam", "ao-khoac-nu", "ao-khoac-unisex", "vest-du-tiec-nam"],
  accessory: ["phu-kien"],
}

// Dịp nên mặc váy đầm (nữ) thay vì áo + quần; dịp trang trọng nên có áo khoác.
const DRESS_OCCASIONS = ["dự tiệc", "hẹn hò", "dự đám cưới", "dự sự kiện", "đi nghe nhạc", "chụp ảnh", "dịp Tết"]
const FORMAL_OCCASIONS = ["đi họp", "đi phỏng vấn", "dự đám cưới", "dự tiệc", "dự sự kiện"]
const COLD_SEASONS = ["đông", "thu"]

const NEUTRALS = new Set(["Trắng", "Đen", "Xám", "Xanh navy", "Be", "Kem", "Nâu", "Nâu bò", "Camel", "Kaki"])
// Hai nhóm phong cách: các món cùng nhóm phối với nhau hợp hơn.
const DRESSY = new Set(["formal", "smart-casual", "elegant", "minimalist"])

export const isNeutral = (color: string) => NEUTRALS.has(color)

const TOP_K = 6
const MAX_COLORS = 2
const MAX_ITEMS = 5

/** Các ô của bộ đồ theo giới tính, dịp, mùa và món đã chọn sẵn. `required`: ô bắt buộc; `wanted`: ô nên có nếu có món. */
export function planSlots(req: OutfitRequest, available: Set<OutfitSlot>): { required: OutfitSlot[]; wanted: OutfitSlot[] } {
  const anchorSlot = req.anchor?.slot
  let useDress: boolean
  if (anchorSlot === "dress") useDress = true
  else if (anchorSlot === "top" || anchorSlot === "bottom") useDress = false
  else useDress = req.gender === "women" && available.has("dress") && req.occasions.some((o) => DRESS_OCCASIONS.includes(o))

  const required: OutfitSlot[] = useDress ? ["dress"] : ["top", "bottom"]
  const wanted: OutfitSlot[] = []
  const formal = req.occasions.some((o) => FORMAL_OCCASIONS.includes(o))
  const cold = req.seasons.some((s) => COLD_SEASONS.includes(s))
  if (anchorSlot === "outer" || cold || formal) wanted.push("outer")
  wanted.push("accessory")
  return { required, wanted }
}

interface Option {
  candidate: OutfitCandidate
  color: string
  base: number
}

function baseScore(c: OutfitCandidate, req: OutfitRequest): number {
  let score = 0
  if (req.occasions.some((o) => c.occasion.includes(o))) score += 3
  if (req.seasons.some((s) => c.season.includes(s))) score += 1.5
  return score
}

/** Các lựa chọn (món × màu) của một ô: lọc theo size khách nói, giữ TOP_K món điểm cao nhất, mỗi món vài màu (ưu tiên trung tính). */
function optionsFor(candidates: OutfitCandidate[], req: OutfitRequest): Option[] {
  const usable = candidates
    .map((c) => {
      const colors = req.size ? c.colors.filter((col) => col.sizes.some((sz) => sizeMatches(sz, req.size!))) : c.colors
      return { c, colors, base: baseScore(c, req) }
    })
    .filter((u) => u.colors.length > 0)
    .sort((x, y) => y.base - x.base || x.c.price - y.c.price || x.c.id.localeCompare(y.c.id))
    .slice(0, TOP_K)
  return usable.flatMap(({ c, colors, base }) =>
    [...colors]
      .sort((x, y) => Number(isNeutral(y.name)) - Number(isNeutral(x.name)) || x.name.localeCompare(y.name))
      .slice(0, MAX_COLORS)
      .map((col) => ({ candidate: c, color: col.name, base })),
  )
}

/** Điểm hài hoà của cả bộ: cùng nhóm phong cách, màu (nhiều nhất một màu nổi, không trùng màu nổi giữa hai món). */
function harmony(picks: Option[]): number {
  let score = 0
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const a = picks[i].candidate.style
      const b = picks[j].candidate.style
      if (a === b) score += 1
      else if (DRESSY.has(a) === DRESSY.has(b)) score += 0.5
      if (picks[i].color === picks[j].color && !isNeutral(picks[i].color)) score -= 1
    }
  }
  const accents = picks.filter((p) => !isNeutral(p.color)).length
  if (accents > 1) score -= 2 * (accents - 1)
  return score
}

function reasonFor(p: Option, all: Option[], req: OutfitRequest, isAnchor: boolean): string {
  const parts: string[] = []
  if (isAnchor) parts.push("Sản phẩm bạn đã chọn")
  const occasion = req.occasions.find((o) => p.candidate.occasion.includes(o))
  if (occasion) parts.push(`Hợp dịp ${occasion}`)
  const season = req.seasons.find((s) => p.candidate.season.includes(s))
  if (season) parts.push(`hợp mùa ${season}`)
  if (all.some((o) => o !== p && o.candidate.style === p.candidate.style)) parts.push("cùng phong cách với các món còn lại")
  if (isNeutral(p.color)) parts.push(`màu ${p.color} trung tính dễ phối`)
  const text = parts.join(", ")
  return (text ? text.charAt(0).toUpperCase() + text.slice(1) : `Màu ${p.color}`).slice(0, 200)
}

/**
 * Chọn bộ đồ tốt nhất trong `candidates` (đã lọc cứng: đang bán, còn hàng, hợp giới tính). Kết quả ổn định (cùng đầu vào cho cùng bộ).
 * `ok:false`: không có món nào ("no_items") hoặc có nhưng mọi bộ đều vượt ngân sách ("over_budget").
 */
export function buildOutfit(req: OutfitRequest, candidates: OutfitCandidate[]): OutfitResult {
  const pool = candidates.filter((c) => c.id !== req.anchor?.id)
  const bySlot = new Map<OutfitSlot, OutfitCandidate[]>()
  for (const c of pool) bySlot.set(c.slot, [...(bySlot.get(c.slot) ?? []), c])
  const available = new Set<OutfitSlot>([...bySlot.keys(), ...(req.anchor ? [req.anchor.slot] : [])])

  const { required, wanted } = planSlots(req, available)

  // Mỗi ô: danh sách lựa chọn. Ô của món đã chọn sẵn chỉ có món đó (các màu còn hàng, ưu tiên màu còn size khách nói).
  const slotOptions: { slot: OutfitSlot; options: Option[] }[] = []
  if (req.anchor) {
    const anchorOptions = optionsFor([req.anchor], req)
    const fallback = optionsFor([req.anchor], { ...req, size: undefined })
    slotOptions.push({ slot: req.anchor.slot, options: anchorOptions.length > 0 ? anchorOptions : fallback })
  }
  const missing: OutfitSlot[] = []
  for (const slot of [...required, ...wanted]) {
    if (slot === req.anchor?.slot) continue
    const options = optionsFor(bySlot.get(slot) ?? [], req)
    // Thiếu phụ kiện không đáng báo (món thêm); thiếu áo, quần, váy, áo khoác thì phải nói rõ.
    if (options.length === 0) {
      if (slot !== "accessory") missing.push(slot)
    }
    else slotOptions.push({ slot, options })
  }

  // Bộ cần ít nhất 2 món (hoặc váy đầm kèm một món khác).
  if (slotOptions.length < 2) return { ok: false, reason: "no_items" }

  let best: { picks: Option[]; score: number; total: number } | undefined
  let sawAny = false
  const visit = (index: number, chosen: Option[]) => {
    if (index === slotOptions.length) {
      sawAny = true
      const total = chosen.reduce((sum, o) => sum + o.candidate.price, 0)
      if (req.budget !== undefined && total > req.budget) return
      const score = chosen.reduce((sum, o) => sum + o.base, 0) + harmony(chosen)
      if (!best || score > best.score || (score === best.score && total < best.total)) best = { picks: [...chosen], score, total }
      return
    }
    for (const option of slotOptions[index].options) {
      chosen.push(option)
      visit(index + 1, chosen)
      chosen.pop()
    }
  }
  visit(0, [])

  if (!best) return { ok: false, reason: sawAny ? "over_budget" : "no_items" }
  const chosen = best.picks.slice(0, MAX_ITEMS)
  const picks: OutfitPick[] = chosen.map((o, i) => ({
    slot: slotOptions[i].slot,
    candidate: o.candidate,
    color: o.color,
    reason: reasonFor(o, chosen, req, o.candidate.id === req.anchor?.id),
  }))
  return { ok: true, plan: { picks, totalPrice: picks.reduce((sum, p) => sum + p.candidate.price, 0), missingSlots: missing } }
}
