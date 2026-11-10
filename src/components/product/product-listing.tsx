import { cache, Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ActiveFilters } from "@/components/product/active-filters"
import { ProductCard } from "@/components/product/product-card"
import { ProductFilterPanel } from "@/components/product/product-filter-panel"
import { ProductPagination } from "@/components/product/product-pagination"
import { ResultsFrame } from "@/components/product/results-frame"
import { MobileFilterSheet, SortSelect } from "@/components/product/product-toolbar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  parseProductFilters,
  serializeProductFilters,
  type SearchParamsLike,
} from "@/lib/validators/product-filter"
import { listProducts } from "@/server/services/catalog.service"

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-3 2xl:grid-cols-4"

// Header-sidebar-grid cùng cần một kết quả: cache() gộp thành 1 lần chạy listProducts / request.
const getListing = cache((qs: string, category: string | undefined) => {
  const filters = parseProductFilters(new URLSearchParams(qs))
  return listProducts(category ? { ...filters, category } : filters)
})

/**
 * Layout trang danh sách. `category` (từ path /categories/[slug]) ghi đè category trên query.
 * Bộ lọc nằm hoàn toàn trong URL; component client chỉ đọc/ghi URL qua useProductFilters().
 */
export function ProductListing({
  searchParams,
  basePath,
  category,
}: {
  searchParams: SearchParamsLike
  basePath: string
  category?: string
}) {
  const qs = toQueryString(searchParams)

  return (
    <div className="grid gap-8 pb-16 lg:grid-cols-[260px_1fr]">
      <aside aria-label="Bộ lọc sản phẩm" className="hidden lg:block">
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar qs={qs} category={category} />
        </Suspense>
      </aside>

      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Suspense>
              <MobileFilters qs={qs} category={category} />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-5 w-24" />}>
              <ResultCount qs={qs} category={category} />
            </Suspense>
          </div>
          <SortSelect />
        </div>
        <ActiveFilters />
        {/* key = URL: đổi bộ lọc → hiện skeleton thay vì giữ lưới cũ. */}
        <ResultsFrame>
          <Suspense key={qs + category} fallback={<GridSkeleton />}>
            <Results qs={qs} category={category} basePath={basePath} />
          </Suspense>
        </ResultsFrame>
      </div>
    </div>
  )
}

function toQueryString(sp: SearchParamsLike): string {
  if (sp instanceof URLSearchParams) return sp.toString()
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    for (const item of Array.isArray(v) ? v : v === undefined ? [] : [v]) out.append(k, item)
  }
  return out.toString()
}

async function Sidebar({ qs, category }: { qs: string; category?: string }) {
  const { facets } = await getListing(qs, category)
  return <ProductFilterPanel facets={facets} idPrefix="d" />
}

async function MobileFilters({ qs, category }: { qs: string; category?: string }) {
  const { facets } = await getListing(qs, category)
  return <MobileFilterSheet facets={facets} />
}

async function ResultCount({ qs, category }: { qs: string; category?: string }) {
  const { total } = await getListing(qs, category)
  return (
    <p className="text-label text-muted-foreground">
      <span className="font-bold text-foreground">{total}</span> sản phẩm
    </p>
  )
}

async function Results({ qs, category, basePath }: { qs: string; category?: string; basePath: string }) {
  const result = await getListing(qs, category)
  const filters = parseProductFilters(new URLSearchParams(qs))

  // Trang vượt quá số trang (vd. link cũ sau khi lọc thu hẹp) → về trang cuối.
  if (result.total > 0 && filters.page > result.pageCount) {
    const next = serializeProductFilters({ ...filters, page: result.pageCount }).toString()
    redirect(next ? `${basePath}?${next}` : basePath)
  }

  if (result.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
        <p className="text-lg font-bold">Không tìm thấy sản phẩm phù hợp</p>
        <p className="max-w-sm text-label text-muted-foreground">
          Thử bỏ bớt bộ lọc hoặc đổi từ khoá tìm kiếm.
        </p>
        <Link
          href={basePath}
          className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink/90"
        >
          Xoá tất cả bộ lọc
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className={GRID}>
        {result.items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <ProductPagination
        filters={filters}
        pageCount={result.pageCount}
        basePath={basePath}
        lockedCategory={!!category}
      />
    </>
  )
}

function GridSkeleton() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
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
  )
}

function SidebarSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

