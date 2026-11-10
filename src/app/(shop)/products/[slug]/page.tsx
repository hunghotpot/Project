import { cache, Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductCard } from "@/components/product/product-card"
import { ProductDetailConnected } from "@/components/product/product-detail-connected"
import { ProductSectionSkeleton, SectionHeading } from "@/components/product/product-sections"
import { getCareTips } from "@/lib/care"
import { SITE_NAME } from "@/lib/site"
import { getCurrentUser } from "@/server/auth/session"
import { getProductBySlug, getRelatedProducts } from "@/server/services/catalog.service"
import type { ProductDetail } from "@/types/catalog"

// generateMetadata và page cùng cần sản phẩm: cache() gộp thành 1 lần query / request.
const getProduct = cache(getProductBySlug)

type Props = { params: Promise<{ slug: string }> }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug)
  if (!product) return { title: "Không tìm thấy sản phẩm" }

  const description = product.description.length > 160 ? `${product.description.slice(0, 157)}...` : product.description
  const path = `/products/${product.slug}`
  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: product.name,
      description,
      images: product.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })),
    },
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const [product, user] = await Promise.all([getProduct((await params).slug), getCurrentUser()])
  if (!product) notFound()

  const { category } = product

  return (
    <div className="space-y-12 pb-16">
      <JsonLd product={product} />

      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <Crumb href="/">Trang chủ</Crumb>
          {category.parent && <Crumb href={`/categories/${category.parent.slug}`}>{category.parent.name}</Crumb>}
          <Crumb href={`/categories/${category.slug}`}>{category.name}</Crumb>
          <li aria-current="page" className="line-clamp-1 font-bold text-foreground">
            {product.name}
          </li>
        </ol>
      </nav>

      <ProductDetailConnected product={product} careTips={getCareTips(product.material)} authenticated={!!user} />

      <Suspense fallback={<ProductSectionSkeleton />}>
        <RelatedProducts product={product} />
      </Suspense>
    </div>
  )
}

async function RelatedProducts({ product }: { product: ProductDetail }) {
  const items = await getRelatedProducts(product, 4)
  if (items.length === 0) return null
  return (
    <section aria-labelledby="related-heading" className="space-y-6 border-t border-border pt-8">
      <SectionHeading id="related-heading" title="Sản phẩm liên quan" href={`/categories/${product.category.slug}`} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

function Crumb({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Link href={href} className="hover:text-foreground">
        {children}
      </Link>
      <span aria-hidden>/</span>
    </li>
  )
}

// schema.org Product + AggregateOffer (giá thấp nhất / cao nhất của các biến thể).
function JsonLd({ product }: { product: ProductDetail }) {
  const prices = product.variants.map((v) => v.price)
  const inStock = product.variants.some((v) => v.stock > 0)
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: product.brand },
    material: product.material,
    category: product.category.name,
    url: `${APP_URL}/products/${product.slug}`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "VND",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: product.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  }
  return (
    <script
      type="application/ld+json"
      // "<" được escape để nội dung sản phẩm không thể đóng thẻ script.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}



