/*
 * So khớp size khách (hoặc model) nói với size của biến thể. Kho có size chữ (S, M, L, XL), số (28, 85) và "Free size": khách nói "free"
 * hay "freesize" là đúng size "Free size", nên so chính xác từng ký tự sẽ báo nhầm "không có size này" (lỗi thật đã gặp: mũ bucket
 * "Free size" còn hàng nhưng thêm vào giỏ bị báo hết).
 */

const plainSize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d")
    .replace(/freesize/g, "free size")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/** Size `asked` có chỉ đúng biến thể size `variantSize` không (không phân biệt hoa thường, dấu, "Free" khớp "Free size"). */
export function sizeMatches(variantSize: string, asked: string): boolean {
  const a = plainSize(asked)
  const v = plainSize(variantSize)
  if (!a) return true
  if (a === v) return true
  const aw = a.split(" ")
  const vw = v.split(" ")
  // Mọi từ của một bên nằm trong bên kia ("free" ⊂ "free size"); size đơn ("M", "28") chỉ khớp chính nó.
  return aw.every((w) => vw.includes(w)) || vw.every((w) => aw.includes(w))
}
