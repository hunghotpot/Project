import Link from "next/link"
import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductCard } from "@/components/product/product-card"
import { getFeaturedProducts, getNewProducts } from "@/server/services/catalog.service"

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"

export function SectionHeading({
  id,
  title,
  href,
}: {
  id: string
  title: ReactNode
  href?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-lg font-bold uppercase md:text-xl">
        {title}
      </h2>
      {href && (
        <Link href={href} className="shrink-0 text-label font-bold hover:text-primary">
          Xem tất cả →
        </Link>
      )}
    </div>
  )
}

export async function FeaturedProducts() {
  const products = await getFeaturedProducts(8)
  if (products.length === 0) return null
  return (
    <section aria-labelledby="featured-heading" className="space-y-6">
      <SectionHeading
        id="featured-heading"
        title={`Sản phẩm nổi bật (${products.length})`}
        href="/products"
      />
      <div className={GRID}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

export async function NewProducts() {
  const products = await getNewProducts(8)
  if (products.length === 0) return null
  return (
    <section aria-labelledby="new-heading" className="space-y-6">
      <SectionHeading id="new-heading" title="Sản phẩm mới" href="/products?sort=newest" />
      <div className={GRID}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} isNew />
        ))}
      </div>
    </section>
  )
}

export function ProductSectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-6 w-56" />
      <div className={GRID}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-6/5 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
