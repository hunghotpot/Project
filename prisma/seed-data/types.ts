import type { ColorKey, MaterialKey, Occasion, Season } from "./vocab";

export type Gender = "MEN" | "WOMEN" | "UNISEX";

export interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  /** slug của category cha; bỏ trống = category gốc */
  parent?: string;
}

/** Nhóm file sản phẩm (theo loại đồ). Mỗi sản phẩm được xếp vào category lá theo (nhóm, giới tính). */
export interface ProductGroup {
  /** Tiền tố SKU, giữ ổn định theo loại đồ dù sản phẩm nằm ở category nào. */
  skuPrefix: string;
  sizes: string[];
  /** Size riêng cho nữ (quần nữ dùng số 26-32). */
  womenSizes?: string[];
  /** Category lá theo giới tính. */
  leaf: Record<Gender, string>;
}

export interface ProductSeed {
  name: string;
  brand: string;
  material: MaterialKey;
  style: string;
  gender: Gender;
  occasion: Occasion[];
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
