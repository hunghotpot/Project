import type { CategorySeed } from "./types";

const TOP_SIZES = ["S", "M", "L", "XL"];
const PANT_SIZES = ["28", "29", "30", "31", "32", "33", "34"];

// Category gốc (Áo, Quần) chỉ để gom nhóm; sản phẩm nằm ở category lá.
export const CATEGORIES: CategorySeed[] = [
  { slug: "ao", name: "Áo", description: "Các loại áo nam nữ: áo thun, sơ mi, áo khoác." },
  {
    slug: "ao-thun",
    name: "Áo thun",
    description: "Áo thun, áo polo từ basic đến oversize, mặc hằng ngày hay tập luyện.",
    parent: "ao",
    skuPrefix: "TEE",
    sizes: TOP_SIZES,
  },
  {
    slug: "ao-so-mi",
    name: "Áo sơ mi",
    description: "Sơ mi công sở, sơ mi linen, flannel và các kiểu sơ mi thời trang.",
    parent: "ao",
    skuPrefix: "SHI",
    sizes: TOP_SIZES,
  },
  {
    slug: "ao-khoac",
    name: "Áo khoác",
    description: "Hoodie, bomber, blazer, áo dạ, cardigan và áo khoác mùa lạnh.",
    parent: "ao",
    skuPrefix: "JKT",
    sizes: TOP_SIZES,
  },
  { slug: "quan", name: "Quần", description: "Quần jeans, quần tây, kaki, short." },
  {
    slug: "quan-jeans",
    name: "Quần jeans",
    description: "Quần jeans đủ form: slim, straight, baggy, wide-leg, flare.",
    parent: "quan",
    skuPrefix: "JNS",
    sizes: PANT_SIZES,
  },
  {
    slug: "quan-tay-kaki",
    name: "Quần tây & kaki",
    description: "Quần tây công sở, kaki chinos, jogger và quần short.",
    parent: "quan",
    skuPrefix: "TRS",
    sizes: PANT_SIZES,
  },
  {
    slug: "vay-dam",
    name: "Váy đầm",
    description: "Đầm công sở, đầm dự tiệc, váy midi, chân váy các kiểu.",
    skuPrefix: "DRS",
    sizes: TOP_SIZES,
  },
  {
    slug: "phu-kien",
    name: "Phụ kiện",
    description: "Thắt lưng, mũ, khăn, túi, balo, kính mát và trang sức.",
    skuPrefix: "ACC",
    sizes: ["Free size"],
  },
];
