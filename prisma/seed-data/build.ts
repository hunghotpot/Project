import { CATEGORIES, PRODUCT_GROUPS } from "./categories";
import { PRODUCTS_BY_GROUP } from "./products";
import type { Gender, ProductSeed } from "./types";
import { COLORS, MATERIALS, type Season } from "./vocab";

// ─────────────── helpers ───────────────

/** PRNG có seed cố định để mỗi lần seed ra cùng một dữ liệu. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function seasonPhrase(season: Season[]): string {
  if (season.length >= 4) return "quanh năm";
  return "vào mùa " + season.join(" và mùa ");
}

function buildDescription(p: ProductSeed, index: number): string {
  const occ = p.occasion.join(", ");
  const sp = seasonPhrase(p.season);
  const templates = [
    `Thích hợp để ${occ}, dễ mặc ${sp}.`,
    `Bạn có thể diện khi ${occ}; đặc biệt hợp ${sp}.`,
    `Sản phẩm mặc được ${sp}, lý tưởng cho những lúc cần ${occ}.`,
  ];
  return [
    p.desc,
    MATERIALS[p.material].blurb,
    templates[index % templates.length],
    `Gợi ý phối đồ: ${p.tip}`,
  ].join(" ");
}

/*
 * Ảnh giữ chỗ cho dữ liệu seed: placehold.co (picsum.photos thường xuyên quá tải/lỗi).
 * Mỗi sản phẩm một màu theo loại đồ, ghi tên sản phẩm và số ảnh để phân biệt; cùng đầu vào luôn ra cùng URL.
 * Chỉ để dev/demo: ảnh thật tải lên qua trang Admin (public/uploads).
 */
const PLACEHOLDER_COLORS: Record<string, [bg: string, fg: string]> = {
  "ao-thun": ["e2e8f0", "334155"],
  "ao-so-mi": ["dbeafe", "1e3a8a"],
  "ao-khoac": ["e7e5e4", "44403c"],
  "quan-jeans": ["c7d2fe", "312e81"],
  "quan-tay-kaki": ["e8dcc4", "57534e"],
  "vay-dam": ["fde2e4", "881337"],
  "vest-du-tiec-nam": ["d9e4dd", "14532d"],
  "phu-kien": ["fef3c7", "78350f"],
};

/** Ngắt tên thành các dòng ngắn (tối đa ~16 ký tự) để chữ không tràn ảnh. */
function wrapLabel(text: string, max = 16): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function placeholderImageUrl(groupKey: string, name: string, n: number): string {
  const [bg, fg] = PLACEHOLDER_COLORS[groupKey] ?? ["e2e8f0", "334155"];
  const text = [...wrapLabel(name), `(ảnh ${n})`].join("\n");
  return `https://placehold.co/800x1000/${bg}/${fg}.png?text=${encodeURIComponent(text)}&font=source-sans-pro`;
}

// ─────────────── builders ───────────────

export interface BuiltVariant {
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  price: number;
  stock: number;
}

export interface BuiltProduct {
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  material: string;
  style: string;
  occasion: string[];
  season: string[];
  gender: Gender;
  tags: string[];
  basePrice: number;
  isFeatured: boolean;
  images: { url: string; alt: string; position: number }[];
  variants: BuiltVariant[];
}

const MAX_VARIANTS = 12;
const MIN_VARIANTS = 3;

function randomStock(rand: () => number): number {
  const r = rand();
  if (r < 0.07) return 0; // hết hàng
  if (r < 0.17) return 1 + Math.floor(rand() * 4); // sắp hết (1-4)
  return 8 + Math.floor(rand() * 73); // 8-80
}

export function buildProducts(): BuiltProduct[] {
  const rand = mulberry32(20261110);
  const slugs = new Set<string>();
  const skus = new Set<string>();
  const result: BuiltProduct[] = [];

  for (const [groupKey, products] of Object.entries(PRODUCTS_BY_GROUP)) {
    const group = PRODUCT_GROUPS[groupKey];
    if (!group) throw new Error(`Nhóm sản phẩm "${groupKey}" chưa khai báo trong PRODUCT_GROUPS`);

    products.forEach((p, i) => {
      const categorySlug = group.leaf[p.gender];
      if (!CATEGORIES.some((c) => c.slug === categorySlug)) {
        throw new Error(`Không có category "${categorySlug}" cho "${p.name}"`);
      }

      const slug = slugify(p.name);
      if (slugs.has(slug)) throw new Error(`Trùng slug: ${slug}`);
      slugs.add(slug);

      // Size: thỉnh thoảng bỏ size lớn nhất để số biến thể đa dạng hơn.
      let sizes = p.sizes ?? (p.gender === "WOMEN" && group.womenSizes ? group.womenSizes : group.sizes);
      if (sizes.length >= 4 && rand() < 0.3) sizes = sizes.slice(0, -1);

      // Giới hạn tối đa 12 biến thể: cắt bớt màu (quần có 7 size => 1 màu).
      const maxColors = Math.max(1, Math.floor(MAX_VARIANTS / sizes.length));
      const colors = p.colors.slice(0, maxColors);

      const variantCount = sizes.length * colors.length;
      if (variantCount < MIN_VARIANTS) {
        throw new Error(`"${p.name}" chỉ có ${variantCount} biến thể (cần >= ${MIN_VARIANTS})`);
      }

      const variants: BuiltVariant[] = [];
      for (const colorKey of colors) {
        const color = COLORS[colorKey];
        for (const size of sizes) {
          const sizeCode = size === "Free size" ? "FS" : size;
          const sku = `${group.skuPrefix}-${String(i + 1).padStart(3, "0")}-${color.code}-${sizeCode}`;
          if (skus.has(sku)) throw new Error(`Trùng SKU: ${sku}`);
          skus.add(sku);
          variants.push({
            sku,
            size,
            color: color.name,
            colorHex: color.hex,
            price: p.price,
            stock: randomStock(rand),
          });
        }
      }

      const imageCount = 2 + Math.floor(rand() * 3); // 2-4
      const images = Array.from({ length: imageCount }, (_, n) => ({
        url: placeholderImageUrl(groupKey, p.name, n + 1),
        alt: `${p.name} - ảnh ${n + 1}`,
        position: n,
      }));

      result.push({
        categorySlug,
        name: p.name,
        slug,
        description: buildDescription(p, i),
        brand: p.brand,
        material: MATERIALS[p.material].label,
        style: p.style,
        occasion: p.occasion,
        season: p.season,
        gender: p.gender,
        tags: p.tags,
        basePrice: p.price,
        isFeatured: i % 10 === 0, // 2 sản phẩm đầu mỗi category con → mục "Nổi bật"
        images,
        variants,
      });
    });
  }

  return result;
}
