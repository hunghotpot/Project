/*
 * 15 truy vấn mẫu của Semantic Search (docs/ai/02-semantic-search.md mục 7) kèm vị từ kiểm tra, dùng cho `npm run ai:search-check`
 * (có gọi Ollama thật nên không nằm trong `npm test`). Cách chấm theo docs/ai/06-evaluation.md mục 2:
 *  - hard: điều kiện CỨNG, mọi sản phẩm trong top-5 phải thoả (vi phạm là lỗi nặng).
 *  - good: sản phẩm "đúng ý"; đạt Pass@5 khi không vi phạm hard và có ít nhất 1 sản phẩm good trong top-5.
 */
export interface ProductFacts {
  slug: string
  name: string
  description: string
  tags: string[]
  gender: "MEN" | "WOMEN" | "UNISEX"
  price: number
  season: string[]
  occasion: string[]
  style: string
  material: string
  categorySlug: string
  variants: { size: string; color: string; stock: number }[]
}

export interface SearchCase {
  id: number
  query: string
  hard: (p: ProductFacts) => boolean
  good: (p: ProductFacts) => boolean
}

const inStock = (p: ProductFacts) => p.variants.some((v) => v.stock > 0)
const inCategory = (p: ProductFacts, ...prefixes: string[]) => prefixes.some((x) => p.categorySlug.startsWith(x))
const menOrUnisex = (p: ProductFacts) => p.gender !== "WOMEN"
const womenOrUnisex = (p: ProductFacts) => p.gender !== "MEN"
const text = (p: ProductFacts) => `${p.name} ${p.tags.join(" ")} ${p.description}`.toLowerCase()

const caseOf = (id: number, query: string, hard: SearchCase["hard"], good: SearchCase["good"] = hard): SearchCase => ({ id, query, hard, good })

export const SEARCH_CASES: SearchCase[] = [
  caseOf(1, "áo thun nam", (p) => inStock(p) && menOrUnisex(p) && inCategory(p, "ao-thun")),
  caseOf(2, "ao khoac", (p) => inStock(p) && inCategory(p, "ao-khoac")),
  caseOf(
    3,
    "áo sơ mi trắng size M còn hàng",
    (p) => inStock(p) && inCategory(p, "ao-so-mi") && p.variants.some((v) => v.color === "Trắng" && v.size === "M" && v.stock > 0),
  ),
  caseOf(
    4,
    "quần jeans nam dưới 500k",
    (p) => inStock(p) && menOrUnisex(p) && p.price < 500_000 && inCategory(p, "quan-jeans", "quan-unisex"),
    (p) => inStock(p) && menOrUnisex(p) && p.price < 500_000 && (inCategory(p, "quan-jeans") || p.slug.includes("jeans")),
  ),
  caseOf(5, "đồ đi biển cho nữ", (p) => inStock(p) && womenOrUnisex(p), (p) => womenOrUnisex(p) && p.occasion.includes("đi biển")),
  caseOf(6, "váy đi đám cưới", (p) => inStock(p) && womenOrUnisex(p), (p) => p.occasion.includes("dự đám cưới") || inCategory(p, "vay-dam")),
  caseOf(
    7,
    "áo sơ mi linen mát cho nam đi cafe",
    (p) => inStock(p) && menOrUnisex(p) && inCategory(p, "ao-so-mi"),
    (p) => /linen/i.test(p.material) || /linen/i.test(p.name),
  ),
  caseOf(8, "quần short mát mẻ mùa hè", inStock, (p) => /short/i.test(p.name) && p.season.includes("hè")),
  caseOf(
    9,
    "đồ công sở nữ thanh lịch dưới 600k",
    (p) => inStock(p) && womenOrUnisex(p) && p.price < 600_000,
    (p) => ["elegant", "formal", "smart-casual"].includes(p.style) && p.occasion.includes("đi làm"),
  ),
  caseOf(10, "áo khoác ấm đi du lịch mùa đông", (p) => inStock(p) && inCategory(p, "ao-khoac"), (p) => p.season.includes("đông")),
  caseOf(11, "phong cách Hàn Quốc dễ thương", inStock, (p) => p.style === "korean"),
  caseOf(
    12,
    "quà tặng bạn gái dưới 300k",
    (p) => inStock(p) && womenOrUnisex(p) && p.price < 300_000,
    (p) => inCategory(p, "phu-kien"),
  ),
  caseOf(13, "áo oversize form rộng", (p) => inStock(p) && !/slim fit/i.test(p.name), (p) => /oversize|form rộng/.test(text(p))),
  caseOf(
    14,
    "Set đồ nam lịch sự đi đám cưới ngoài trời mùa hè",
    (p) => inStock(p) && menOrUnisex(p),
    (p) => p.occasion.includes("dự đám cưới") && p.season.includes("hè"),
  ),
  caseOf(15, "mặc gì đi hẹn hò tối nay", inStock, (p) => p.occasion.includes("hẹn hò")),
]
