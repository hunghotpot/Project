import "server-only"
import { getProductBySlug } from "@/server/services/catalog.service"
import type { AiConfig } from "../core/env"
import { searchProducts } from "../search/search.service"

/*
 * Đổi "tên hoặc slug khách nhắc tới" thành slug thật. Model 4B hay tự bịa slug ("somi-poplin-cung-170") nên tool không nhận slug
 * thô: slug chỉ được dùng khi có sản phẩm thật, còn lại tìm theo tên và chỉ chọn khi KHÔNG mơ hồ (không đoán sản phẩm thay khách,
 * vì sai sản phẩm là sai bảng size).
 */

export type ResolvedProduct = { slug: string } | { candidates: { name: string; slug: string }[] } | null

const MAX_CANDIDATES = 4
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

export async function resolveProduct(ref: string, config: AiConfig | null): Promise<ResolvedProduct> {
  const text = ref.trim()
  if (!text) return null
  if (SLUG.test(text) && (await getProductBySlug(text))) return { slug: text }

  const words = plain(text).split(" ").filter(Boolean)
  if (words.length === 0) return null
  const found = await searchProducts(text, { pageSize: 8, config })
  // Mọi từ khách nói phải có trong tên sản phẩm (không dùng thứ hạng tìm kiếm để đoán).
  const matches = found.result.items.filter((p) => {
    const name = plain(p.name)
    return words.every((w) => name.includes(w))
  })
  if (matches.length === 0) return null
  if (matches.length === 1) return { slug: matches[0].slug }
  const exact = matches.filter((p) => plain(p.name) === words.join(" "))
  if (exact.length === 1) return { slug: exact[0].slug }
  return { candidates: matches.slice(0, MAX_CANDIDATES).map((p) => ({ name: p.name, slug: p.slug })) }
}
