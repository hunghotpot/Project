import type { CategorySeed, ProductGroup } from "./types";

const TOP_SIZES = ["S", "M", "L", "XL"];
const PANT_SIZES = ["28", "29", "30", "31", "32", "33", "34"];
const WOMEN_PANT_SIZES = ["26", "27", "28", "29", "30", "31", "32"];

// Cây danh mục: gốc Nam / Nữ / Unisex gom nhóm, sản phẩm nằm ở category lá. Phụ kiện dùng chung, là lá ở cấp gốc.
// Mỗi sản phẩm vào đúng một lá theo giới tính của nó (xem PRODUCT_GROUPS), nên không phải gán tay.
export const CATEGORIES: CategorySeed[] = [
  { slug: "nam", name: "Nam", description: "Thời trang nam: áo thun, sơ mi, áo khoác, quần và trang phục dự tiệc." },
  { slug: "nu", name: "Nữ", description: "Thời trang nữ: áo, quần, váy đầm cho đi làm, đi chơi và dự tiệc." },
  { slug: "unisex", name: "Unisex", description: "Thiết kế dùng chung cho cả nam và nữ, form rộng thoải mái." },

  { slug: "ao-thun-nam", name: "Áo thun nam", description: "Áo thun, áo polo nam từ basic đến oversize, mặc hằng ngày hay tập luyện.", parent: "nam" },
  { slug: "ao-so-mi-nam", name: "Áo sơ mi nam", description: "Sơ mi nam công sở, linen, flannel và các kiểu sơ mi thời trang.", parent: "nam" },
  { slug: "ao-khoac-nam", name: "Áo khoác nam", description: "Hoodie, bomber, blazer, áo dạ và áo khoác mùa lạnh cho nam.", parent: "nam" },
  { slug: "quan-jeans-nam", name: "Quần jeans nam", description: "Quần jeans nam đủ form: slim, straight, baggy.", parent: "nam" },
  { slug: "quan-tay-kaki-nam", name: "Quần tây & kaki nam", description: "Quần tây công sở, kaki chinos, jogger và quần short nam.", parent: "nam" },
  {
    slug: "vest-du-tiec-nam",
    name: "Vest & đồ dự tiệc nam",
    description: "Blazer, gile linen mỏng cho tiệc cưới và sự kiện mùa hè, thoáng mát khi đứng ngoài trời.",
    parent: "nam",
  },

  { slug: "ao-thun-nu", name: "Áo thun nữ", description: "Áo thun, áo croptop, áo polo nữ từ basic đến năng động.", parent: "nu" },
  { slug: "ao-so-mi-nu", name: "Áo sơ mi nữ", description: "Sơ mi nữ công sở, linen, lụa và các kiểu sơ mi thời trang.", parent: "nu" },
  { slug: "ao-khoac-nu", name: "Áo khoác nữ", description: "Hoodie, blazer, cardigan, áo dạ và áo khoác mùa lạnh cho nữ.", parent: "nu" },
  { slug: "quan-jeans-nu", name: "Quần jeans nữ", description: "Quần jeans nữ: skinny, straight, wide-leg, flare.", parent: "nu" },
  { slug: "quan-tay-kaki-nu", name: "Quần tây & kaki nữ", description: "Quần tây công sở, kaki, quần short và chân váy nữ.", parent: "nu" },
  { slug: "vay-dam", name: "Váy đầm", description: "Đầm công sở, đầm dự tiệc, váy midi, chân váy các kiểu.", parent: "nu" },

  { slug: "ao-thun-unisex", name: "Áo thun unisex", description: "Áo thun, áo nỉ form rộng cho cả nam và nữ.", parent: "unisex" },
  { slug: "ao-so-mi-unisex", name: "Áo sơ mi unisex", description: "Sơ mi form rộng, linen, đũi dùng chung nam nữ.", parent: "unisex" },
  { slug: "ao-khoac-unisex", name: "Áo khoác unisex", description: "Hoodie, bomber, áo khoác gió form rộng cho cả nam và nữ.", parent: "unisex" },
  { slug: "quan-unisex", name: "Quần unisex", description: "Quần jeans, kaki, jogger form rộng dùng chung nam nữ.", parent: "unisex" },

  { slug: "phu-kien", name: "Phụ kiện", description: "Thắt lưng, mũ, khăn, túi, balo, kính mát và trang sức." },
];

/** Key = tên file trong products/. Mỗi nhóm chứa đủ giới tính; build.ts xếp từng sản phẩm vào category lá theo `gender`. */
export const PRODUCT_GROUPS: Record<string, ProductGroup> = {
  "ao-thun": {
    skuPrefix: "TEE",
    sizes: TOP_SIZES,
    leaf: { MEN: "ao-thun-nam", WOMEN: "ao-thun-nu", UNISEX: "ao-thun-unisex" },
  },
  "ao-so-mi": {
    skuPrefix: "SHI",
    sizes: TOP_SIZES,
    leaf: { MEN: "ao-so-mi-nam", WOMEN: "ao-so-mi-nu", UNISEX: "ao-so-mi-unisex" },
  },
  "ao-khoac": {
    skuPrefix: "JKT",
    sizes: TOP_SIZES,
    leaf: { MEN: "ao-khoac-nam", WOMEN: "ao-khoac-nu", UNISEX: "ao-khoac-unisex" },
  },
  "quan-jeans": {
    skuPrefix: "JNS",
    sizes: PANT_SIZES,
    womenSizes: WOMEN_PANT_SIZES,
    leaf: { MEN: "quan-jeans-nam", WOMEN: "quan-jeans-nu", UNISEX: "quan-unisex" },
  },
  "quan-tay-kaki": {
    skuPrefix: "TRS",
    sizes: PANT_SIZES,
    womenSizes: WOMEN_PANT_SIZES,
    leaf: { MEN: "quan-tay-kaki-nam", WOMEN: "quan-tay-kaki-nu", UNISEX: "quan-unisex" },
  },
  "vay-dam": {
    skuPrefix: "DRS",
    sizes: TOP_SIZES,
    leaf: { MEN: "vay-dam", WOMEN: "vay-dam", UNISEX: "vay-dam" },
  },
  "vest-du-tiec-nam": {
    skuPrefix: "SUI",
    sizes: TOP_SIZES,
    leaf: { MEN: "vest-du-tiec-nam", WOMEN: "vest-du-tiec-nam", UNISEX: "vest-du-tiec-nam" },
  },
  "phu-kien": {
    skuPrefix: "ACC",
    sizes: ["Free size"],
    leaf: { MEN: "phu-kien", WOMEN: "phu-kien", UNISEX: "phu-kien" },
  },
};
