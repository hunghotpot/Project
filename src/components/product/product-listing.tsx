import { cache, Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ActiveFilters } from "@/components/product/active-filters"
import { ProductCard } from "@/components/product/product-card"
import { ProductFilterPanel } from "@/components/product/product-filter-panel"
import { ProductPagination } from "@/components/product/product-pagination"
import { ResultsFrame } from "@/components/product/results-frame"
import { MobileFilterSheet, SortSelect } from "@/components/product/product-toolbar"
import { SmartSearchNote, type SmartSearchSummary } from "@/components/product/smart-search-note"
import { Skeleton } from "@/components/ui/skeleton"
import {
  parseProductFilters,
  serializeProductFilters,
  type SearchParamsLike,
} from "@/lib/validators/product-filter"
import { getAiStatus } from "@/server/ai/core/env"
import { describeIntent } from "@/server/ai/search/describe-intent"
import { findRankedProducts, type RankedProducts } from "@/server/ai/search/search.service"
import { allowSmartSearch, SMART_SEARCH_LIMITED_NOTICE } from "@/server/ai/search/smart-search-limit"
import { getCurrentUser } from "@/server/auth/session"
import { listProducts } from "@/server/services/catalog.service"

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-3 2xl:grid-cols-4"

/** Quá hạn này thì bỏ embedding và dùng tìm kiếm từ khoá, để trang không bị treo khi Ollama chậm hoặc đang nạp model. */
const SMART_SEARCH_TIMEOUT_MS = 8000

/**
 * Câu tìm kiếm (không kèm danh mục cố định) luôn đi qua bước hiểu câu bằng code: từ điển lóng, giá, size, màu, xếp hạng theo từ khoá.
 * Phần vector (gọi model qua Ollama) chỉ dành cho người đã đăng nhập khi AI bật (AI cần tài khoản, docs/ai/00-overview.md mục 5);
 * khách hoặc AI tắt thì không gọi model nào. Trang danh mục (có `category`) giữ cách lọc cũ vì kết quả xếp hạng là toàn kho.
 */
async function rankQuery(q: string | undefined, category: string | undefined): Promise<RankedProducts | null> {
  if (!q || category) return null
  const status = getAiStatus()
  const user = status.enabled ? await getCurrentUser() : null
  // Vượt giới hạn tốc độ của tìm kiếm thông minh thì vẫn tìm được, chỉ không dùng vector (kèm ghi chú).
  const limited = !!user && !(await allowSmartSearch(user.id))
  const config = status.enabled && user && !limited ? { ...status.config, timeoutMs: Math.min(status.config.timeoutMs, SMART_SEARCH_TIMEOUT_MS) } : null
  const ranked = await findRankedProducts(q, { config })
  return limited ? { ...ranked, notice: SMART_SEARCH_LIMITED_NOTICE } : ranked
}

function summarize(r: RankedProducts): SmartSearchSummary {
  return {
    mode: r.mode,
    chips: describeIntent(r.intent),
    relaxed: r.relaxed,
    notice: r.notice,
    outOfScope: r.intent.outOfScope,
  }
}

// Header-sidebar-grid cùng cần một kết quả: cache() gộp thành 1 lần chạy / request (kể cả bước tìm kiếm thông minh).
const getListing = cache(async (qs: string, category: string | undefined) => {
  const filters = parseProductFilters(new URLSearchParams(qs))
  const base = category ? { ...filters, category } : filters
  const ranked = await rankQuery(filters.q, category)
  if (!ranked) return { ...(await listProducts(base)), smart: null }
  // Thứ tự theo mức phù hợp (bỏ qua sort); bộ lọc khác của khách (size, màu, giá…) vẫn áp lên tập kết quả.
  const list = await listProducts({ ...base, q: undefined }, { includeUnisex: true, onlyIds: ranked.ids })
  return { ...list, smart: summarize(ranked) }
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
          <Suspense fallback={<SortSelect />}>
            <SortControl qs={qs} category={category} />
          </Suspense>
        </div>
        <ActiveFilters />
        <Suspense>
          <SmartNote qs={qs} category={category} />
        </Suspense>
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

/** Tìm kiếm thông minh xếp theo mức phù hợp nên không có ô chọn sắp xếp. */
async function SortControl({ qs, category }: { qs: string; category?: string }) {
  const { smart } = await getListing(qs, category)
  return smart ? <p className="text-label text-muted-foreground">Xếp theo mức phù hợp</p> : <SortSelect />
}

async function SmartNote({ qs, category }: { qs: string; category?: string }) {
  const { smart } = await getListing(qs, category)
  return smart ? <SmartSearchNote smart={smart} /> : null
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

