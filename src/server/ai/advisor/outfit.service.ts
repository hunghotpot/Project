import "server-only"
import type { Gender } from "@prisma/client"
import { db } from "@/server/db"
import { formatVnd } from "@/lib/format"
import type { OutfitView } from "@/types/assistant"
import type { AiConfig } from "../core/env"
import { buildSearchIntent, type GenderEnum } from "../search/intent"
import { searchKnowledge, type KnowledgeHit } from "./knowledge.service"
import { buildOutfit, SLOT_CATEGORIES, SLOT_LABEL, slotOf, type OutfitCandidate, type OutfitGender } from "./outfit"

/*
 * Mix & Match trọn gói (docs/ai/03-rag-advisor.md mục 4): hiểu yêu cầu bằng code, nạp ứng viên còn hàng từ DB, để `outfit.ts` chọn,
 * dựng thẻ bộ đồ. Không dùng LLM: giới tính, dịp, mùa, ngân sách, size lấy từ chính câu của khách (cùng bộ hiểu câu với tìm kiếm).
 * Chỉ dùng sản phẩm đang bán và còn ít nhất một biến thể còn hàng; hết hàng toàn bộ thì không bao giờ xuất hiện.
 */

export interface OutfitInput {
  /** Các câu gần đây của khách, cũ → mới (câu cuối là yêu cầu hiện tại). Điều kiện nào câu mới không nói thì lấy ở câu trước. */
  userTexts: string[]
  /** Slug của sản phẩm khách đã chọn sẵn (đã được xác định ở tầng tool), nếu có. */
  anchorSlug?: string
}

export type OutfitServiceResult =
  | { ok: true; view: OutfitView }
  | { ok: false; code: "NEED_GENDER" | "NO_OUTFIT" | "OVER_BUDGET" | "ANCHOR_NOT_FOUND"; message: string }

const ALL_CATEGORIES = Object.values(SLOT_CATEGORIES).flat()
const MAX_CANDIDATES = 300

const genderOfEnum = (g: Gender | GenderEnum): OutfitGender => (g === "MEN" ? "men" : g === "WOMEN" ? "women" : "unisex")
const GENDERS_FOR: Record<OutfitGender, Gender[]> = { men: ["MEN", "UNISEX"], women: ["WOMEN", "UNISEX"], unisex: ["UNISEX"] }

interface Wanted {
  gender?: OutfitGender
  occasions: string[]
  seasons: string[]
  budget?: number
  size?: string
}

/** Điều kiện từ các câu của khách: từng trường lấy ở câu MỚI NHẤT có nói tới nó (khách nói "nữ" ở câu sau vẫn giữ dịp "đi làm" ở câu trước). */
export function wantedFrom(userTexts: string[]): Wanted {
  const wanted: Wanted = { occasions: [], seasons: [] }
  for (const text of [...userTexts].reverse()) {
    const intent = buildSearchIntent(text, { colors: [] })
    const genders = intent.hard.genders
    if (!wanted.gender && genders) wanted.gender = genders.includes("MEN") ? "men" : genders.includes("WOMEN") ? "women" : "unisex"
    if (wanted.occasions.length === 0 && intent.soft.occasion.length > 0) wanted.occasions = intent.soft.occasion
    if (wanted.seasons.length === 0 && intent.soft.season.length > 0) wanted.seasons = intent.soft.season
    if (wanted.budget === undefined && intent.hard.maxPrice !== undefined) wanted.budget = intent.hard.maxPrice
    if (!wanted.size && intent.hard.sizes[0]) wanted.size = intent.hard.sizes[0]
  }
  return wanted
}

const productSelect = {
  id: true,
  name: true,
  slug: true,
  style: true,
  occasion: true,
  season: true,
  gender: true,
  basePrice: true,
  category: { select: { slug: true } },
  images: { orderBy: { position: "asc" as const }, take: 1, select: { url: true, alt: true } },
  variants: { where: { stock: { gt: 0 } }, select: { color: true, size: true } },
}

type Row = Awaited<ReturnType<typeof loadRows>>[number]

function loadRows(where: object, take: number) {
  return db.product.findMany({ where: { isActive: true, variants: { some: { stock: { gt: 0 } } }, ...where }, select: productSelect, take, orderBy: { id: "asc" } })
}

function toCandidate(row: Row): OutfitCandidate | null {
  let slot = slotOf(row.category.slug)
  if (!slot) return null
  // Danh mục "Váy đầm" gồm cả chân váy: chân váy không phải bộ hoàn chỉnh nên phối như quần (cần thêm áo).
  if (slot === "dress" && /chân váy/i.test(row.name)) slot = "bottom"
  const byColor = new Map<string, string[]>()
  for (const v of row.variants) byColor.set(v.color, [...(byColor.get(v.color) ?? []), v.size])
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    slot,
    style: row.style,
    occasion: row.occasion,
    season: row.season,
    price: row.basePrice,
    image: row.images[0] ?? null,
    colors: [...byColor].map(([name, sizes]) => ({ name, sizes })),
  }
}

export async function suggestOutfit(
  input: OutfitInput,
  config: AiConfig | null,
  deps: { retrieve?: (query: string, config: AiConfig) => Promise<KnowledgeHit[]> } = {},
): Promise<OutfitServiceResult> {
  const wanted = wantedFrom(input.userTexts)

  let anchor: OutfitCandidate | undefined
  if (input.anchorSlug) {
    const row = (await loadRows({ slug: input.anchorSlug }, 1))[0]
    anchor = row ? (toCandidate(row) ?? undefined) : undefined
    if (!row || !anchor) return { ok: false, code: "ANCHOR_NOT_FOUND", message: "Sản phẩm này không dùng để phối được hoặc đang hết hàng" }
    // Giới tính theo món đã chọn (unisex thì theo điều khách nói, nếu không thì unisex).
    const fromAnchor = genderOfEnum(row.gender)
    wanted.gender = fromAnchor === "unisex" ? (wanted.gender ?? "unisex") : fromAnchor
  }
  if (!wanted.gender) {
    return { ok: false, code: "NEED_GENDER", message: "Chưa biết khách muốn phối cho nam, nữ hay unisex: hãy hỏi khách trước" }
  }

  const rows = await loadRows({ gender: { in: GENDERS_FOR[wanted.gender] }, category: { slug: { in: ALL_CATEGORIES } } }, MAX_CANDIDATES)
  const candidates = rows.flatMap((r) => toCandidate(r) ?? [])

  const result = buildOutfit(
    { gender: wanted.gender, occasions: wanted.occasions, seasons: wanted.seasons, budget: wanted.budget, size: wanted.size, anchor },
    candidates,
  )
  if (!result.ok) {
    return result.reason === "over_budget"
      ? { ok: false, code: "OVER_BUDGET", message: `Chưa có bộ nào trong ngân sách ${formatVnd(wanted.budget ?? 0)}: hãy báo khách và hỏi có tăng ngân sách không` }
      : { ok: false, code: "NO_OUTFIT", message: "Chưa đủ món còn hàng để phối thành bộ cho yêu cầu này" }
  }

  // Nguồn kiến thức phối đồ (không bắt buộc: lỗi hoặc không có thì bộ đồ vẫn hợp lệ, chỉ không ghi nguồn).
  let knowledgeSources: string[] = []
  if (config) {
    try {
      const query = `Phối đồ ${wanted.occasions[0] ?? ""} cho ${wanted.gender === "men" ? "nam" : wanted.gender === "women" ? "nữ" : "unisex"}`.trim()
      const hits = await (deps.retrieve ?? ((q, c) => searchKnowledge(q, c, { limit: 2, types: ["styling"] })))(query, config)
      knowledgeSources = hits.map((h) => h.title)
    } catch (e) {
      console.warn("[ai] truy xuất kiến thức phối đồ lỗi, bỏ qua nguồn:", e instanceof Error ? e.message : e)
    }
  }

  const { plan } = result
  const forWho = wanted.gender === "men" ? "nam" : wanted.gender === "women" ? "nữ" : "unisex"
  const title = (anchor ? `Phối cùng ${anchor.name}` : `Bộ đồ ${wanted.occasions[0] ?? "thường ngày"} cho ${forWho}`).slice(0, 80)
  const view: OutfitView = {
    title,
    occasion: wanted.occasions[0] ?? null,
    seasons: wanted.seasons,
    items: plan.picks.map((p) => ({
      slot: p.slot,
      slug: p.candidate.slug,
      name: p.candidate.name,
      image: p.candidate.image,
      variantLabel: wanted.size ? `${p.color} · size ${wanted.size.toUpperCase()}` : p.color,
      price: p.candidate.price,
      reason: p.reason,
    })),
    totalPrice: plan.totalPrice,
    knowledgeSources,
    missingSlots: plan.missingSlots.map((s) => SLOT_LABEL[s]),
    note: wanted.size ? null : "Bạn chọn size ở từng sản phẩm trước khi thêm vào giỏ.",
  }
  return { ok: true, view }
}
