/*
 * Hàm thuần cho các màn danh sách Admin: bộ lọc/trang nằm trong URL (?q=&status=&page=), đúng quy ước dự án.
 * Dùng chung cho phân trang (server) và thanh công cụ (client), test được không cần DOM.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>

/** Dựng URL từ searchParams hiện tại cộng `patch` (giá trị undefined/"" = xoá khoá). Không giữ `page` khi patch không nói tới nó thì giữ nguyên. */
export function buildListHref(basePath: string, searchParams: RawSearchParams, patch: Record<string, string | number | undefined> = {}): string {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (key in patch || value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) next.append(key, v)
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && value !== "") next.set(key, String(value))
  }
  const qs = next.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * Dãy số trang hiển thị: tối đa `max` số, bám quanh trang hiện tại, luôn nằm trong [1, pageCount].
 * Ví dụ page 1/10 → [1,2,3,4,5]; page 6/10 → [4,5,6,7,8]; page 10/10 → [6,7,8,9,10].
 */
export function pageWindow(page: number, pageCount: number, max = 5): number[] {
  if (pageCount < 1) return []
  const size = Math.min(max, pageCount)
  const current = Math.min(Math.max(1, page), pageCount)
  let start = current - Math.floor(size / 2)
  start = Math.max(1, Math.min(start, pageCount - size + 1))
  return Array.from({ length: size }, (_, i) => start + i)
}

/** "Hiển thị 11 - 20" cho trang `page` (1-based). total = 0 → null. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } | null {
  if (total <= 0) return null
  const from = (page - 1) * pageSize + 1
  if (from > total) return null
  return { from, to: Math.min(page * pageSize, total) }
}
