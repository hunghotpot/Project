export interface NavCategory {
  id: string
  name: string
  slug: string
  children: { id: string; name: string; slug: string }[]
}

export interface ProductImageData {
  url: string
  alt: string
  /** Ảnh dành riêng cho một màu; null/undefined = ảnh chung. Hiện DB chưa có cột này nên luôn trống. */
  color?: string | null
}

export interface ProductCardData {
  id: string
  name: string
  slug: string
  categoryName: string
  gender: "MEN" | "WOMEN" | "UNISEX"
  /** VND */
  price: number
  image: ProductImageData | null
  /** Ảnh thứ 2, hiện khi hover. */
  hoverImage: ProductImageData | null
  /** Các màu có trong biến thể (không trùng). */
  colors: ProductColor[]
  inStock: boolean
}

export interface ProductColor {
  name: string
  hex: string
}

export interface FacetValue {
  value: string
  count: number
}

export interface ProductFacets {
  sizes: FacetValue[]
  colors: (FacetValue & { hex: string })[]
  materials: FacetValue[]
  styles: FacetValue[]
  occasions: FacetValue[]
  genders: FacetValue[]
  /** Khoảng giá của tập sản phẩm khi bỏ qua bộ lọc giá. null nếu rỗng. */
  price: { min: number; max: number } | null
}

export interface ProductListResult {
  items: ProductCardData[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  facets: ProductFacets
}

export interface CategoryDetail {
  id: string
  name: string
  slug: string
  description: string | null
  parent: { name: string; slug: string } | null
  children: { id: string; name: string; slug: string }[]
}

export interface CategoryCardData {
  id: string
  name: string
  slug: string
  productCount: number
  cover: ProductImageData | null
}

export interface SizeChartRow {
  size: string
  chest: number | null
  waist: number
  hip: number
  heightMin: number
  heightMax: number
  weightMin: number
  weightMax: number
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  description: string
  brand: string
  material: string
  style: string
  occasion: string[]
  tags: string[]
  gender: "MEN" | "WOMEN" | "UNISEX"
  categoryId: string
  category: { name: string; slug: string; parent: { name: string; slug: string } | null }
  images: ProductImageData[]
  variants: {
    id: string
    sku: string
    size: string
    color: string
    colorHex: string
    price: number
    stock: number
  }[]
  /** Bảng size của category (ưu tiên bảng riêng của brand); rỗng nếu category chưa có. */
  sizeChart: SizeChartRow[]
}


