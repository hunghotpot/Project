import { GENDER_LABEL, STYLE_LABEL } from "@/lib/format"

/*
 * Dựng "văn bản để embedding" cho một sản phẩm theo docs/ai/01-data-for-ai.md mục 2.
 * Cùng dữ liệu cho cùng chuỗi (ổn định để so contentHash). KHÔNG đưa giá, tồn kho, id, URL vào văn bản.
 * Sửa template thì tăng TEMPLATE_VERSION để buộc embed lại toàn bộ.
 */
export const TEMPLATE_VERSION = 1

export interface ProductDocumentInput {
  name: string
  categoryName: string
  brand: string
  gender: keyof typeof GENDER_LABEL
  material: string
  style: string
  occasion: string[]
  season: string[]
  tags: string[]
  description: string
  /** Tên màu của mọi biến thể (có thể trùng nhau). */
  colors: string[]
}

const GENDER_TEXT: Record<ProductDocumentInput["gender"], string> = {
  MEN: GENDER_LABEL.MEN,
  WOMEN: GENDER_LABEL.WOMEN,
  UNISEX: `${GENDER_LABEL.UNISEX} (nam và nữ đều mặc được)`,
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim()

/** Nhãn tiếng Việt kèm token gốc trong ngoặc để khớp cả từ tiếng Anh: "Thanh lịch (elegant)". */
function styleText(style: string): string {
  const label = STYLE_LABEL[style]
  return label && label !== style ? `${label} (${style})` : style
}

export function buildProductDocument(p: ProductDocumentInput): string {
  const colors = [...new Set(p.colors.map(clean))].sort((a, b) => a.localeCompare(b, "vi"))
  return [
    `${clean(p.name)}.`,
    `Loại: ${clean(p.categoryName)}. Thương hiệu: ${clean(p.brand)}. Giới tính: ${GENDER_TEXT[p.gender]}.`,
    `Chất liệu: ${clean(p.material)}. Phong cách: ${styleText(clean(p.style))}.`,
    `Dịp mặc: ${p.occasion.map(clean).join(", ")}. Mùa: ${p.season.map(clean).join(", ")}.`,
    `Màu sắc: ${colors.join(", ")}.`,
    `Từ khoá: ${p.tags.map(clean).join(", ")}.`,
    `Mô tả: ${clean(p.description)}`,
  ].join("\n")
}
