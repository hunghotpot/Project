import type { Metadata } from "next"
import { ProductListing } from "@/components/product/product-listing"
import { parseProductFilters } from "@/lib/validators/product-filter"

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = parseProductFilters(await searchParams)
  return { title: q ? `Tìm kiếm: ${q}` : "Tất cả sản phẩm" }
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams
  const { q } = parseProductFilters(sp)

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">{q ? `Kết quả cho “${q}”` : "Tất cả sản phẩm"}</h1>
      <ProductListing searchParams={sp} basePath="/products" />
    </>
  )
}
