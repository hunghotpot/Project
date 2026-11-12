import type { ProductSeed } from "../types";

// Trang phục nam dự tiệc / đám cưới mùa hè (ngoài trời): chất liệu mỏng, thoáng.
// Sơ mi, quần tây và phụ kiện cùng bộ nằm ở ao-so-mi.ts, quan-tay-kaki.ts, phu-kien.ts.
export const VEST_DU_TIEC_NAM: ProductSeed[] = [
  {
    name: "Áo blazer linen pha mỏng nhẹ",
    brand: "Hanoi Atelier",
    material: "linen-cotton",
    style: "formal",
    gender: "MEN",
    occasion: ["dự đám cưới", "dự tiệc", "dự sự kiện"],
    season: ["xuân", "hè"],
    tags: ["blazer", "linen", "thoáng mát", "ngoài trời", "tiệc cưới", "không lót"],
    price: 1290000,
    colors: ["beige", "navy", "lightblue"],
    desc: "Blazer linen pha cotton không lót, vai mềm và form vừa người, đứng dưới nắng ngoài trời vẫn thấy mát.",
    tip: "mặc cùng sơ mi trắng, quần tây cùng tông và giày loafer da; xắn nhẹ tay áo khi trời nóng.",
  },
  {
    name: "Áo gile linen dự tiệc",
    brand: "Hanoi Atelier",
    material: "linen",
    style: "formal",
    gender: "MEN",
    occasion: ["dự đám cưới", "dự tiệc"],
    season: ["hè"],
    tags: ["gile", "vest ba mảnh", "linen", "thoáng mát", "ngoài trời", "phù rể"],
    price: 790000,
    colors: ["cream", "grey", "olive"],
    desc: "Gile linen cài năm cúc, lót lưng mỏng có khóa điều chỉnh, gọn gàng mà không nóng như bộ vest đủ lớp.",
    tip: "mặc trong sơ mi tay dài xắn gọn, thêm nơ hoặc cà vạt; hợp tiệc cưới ngoài trời hay làm phù rể.",
  },
];
