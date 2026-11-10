import Image from "next/image"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionHeading } from "@/components/product/product-sections"
import { getHomeCategories } from "@/server/services/catalog.service"

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"

// Figma không có section danh mục → dùng lại ngôn ngữ thẻ sản phẩm (ảnh bo 8px + tên + phụ đề).
export async function CategoryGrid() {
  const categories = await getHomeCategories()
  if (categories.length === 0) return null

  return (
    <section aria-labelledby="categories-heading" className="space-y-6">
      <SectionHeading id="categories-heading" title="Danh mục sản phẩm" />
      <div className={GRID}>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="group flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <div className="relative aspect-6/5 overflow-hidden rounded-lg bg-secondary">
              {c.cover && (
                <Image
                  src={c.cover.url}
                  alt={`Danh mục ${c.name}`}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-nav leading-snug font-bold uppercase">{c.name}</h3>
              <p className="text-label text-subtle-foreground">{c.productCount} sản phẩm</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function CategoryGridSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-6 w-48" />
      <div className={GRID}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-6/5 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

