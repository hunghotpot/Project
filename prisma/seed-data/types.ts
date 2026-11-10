import type { ColorKey, MaterialKey, Season } from "./vocab";

export type Gender = "MEN" | "WOMEN" | "UNISEX";

export interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  /** slug của category cha; bỏ trống = category gốc */
  parent?: string;
  /** Chỉ category lá (có sản phẩm) cần skuPrefix + sizes. */
  skuPrefix?: string;
  sizes?: string[];
}

export interface ProductSeed {
  name: string;
  brand: string;
  material: MaterialKey;
  style: string;
  gender: Gender;
  occasion: string[];
  season: Season[];
  tags: string[];
  /** VND */
  price: number;
  colors: ColorKey[];
  /** Ghi đè size mặc định của category (ví dụ phụ kiện: "Free size", thắt lưng 85-105) */
  sizes?: string[];
  /** Câu mở đầu mô tả, viết tay */
  desc: string;
  /** Gợi ý phối đồ, viết thường chữ đầu, kết thúc bằng dấu chấm */
  tip: string;
}

export interface SizeChartSeed {
  categorySlug: string;
  brand?: string;
  size: string;
  chest?: number;
  waist: number;
  hip: number;
  heightMin: number;
  heightMax: number;
  weightMin: number;
  weightMax: number;
}
