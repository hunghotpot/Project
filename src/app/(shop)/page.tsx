import type { Metadata } from "next"
import { Suspense } from "react"
import { Hero } from "@/components/home/hero"
import { CategoryGrid, CategoryGridSkeleton } from "@/components/product/category-grid"
import {
  FeaturedProducts,
  NewProducts,
  ProductSectionSkeleton,
} from "@/components/product/product-sections"
import { SITE_NAME } from "@/lib/site"

const description =
  "Thời trang nam nữ hiện đại: áo thun, áo sơ mi, áo khoác, quần jeans, váy đầm và phụ kiện. Giao hàng toàn quốc, thanh toán khi nhận hàng."

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} - Thời trang hiện đại và năng động` },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: `${SITE_NAME} - Thời trang hiện đại và năng động`,
    description,
  },
}

export default function HomePage() {
  return (
    <div className="space-y-12">
      <Hero />
      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryGrid />
      </Suspense>
      <Suspense fallback={<ProductSectionSkeleton />}>
        <FeaturedProducts />
      </Suspense>
      <Suspense fallback={<ProductSectionSkeleton />}>
        <NewProducts />
      </Suspense>
    </div>
  )
}
