import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProductListing } from "@/components/product/product-listing"
import { getCategoryBySlug } from "@/server/services/catalog.service"

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).slug)
  return { title: category?.name ?? "Danh mục" }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Trang chủ
        </Link>
        {category.parent && (
          <>
            {" / "}
            <Link href={`/categories/${category.parent.slug}`} className="hover:text-foreground">
              {category.parent.name}
            </Link>
          </>
        )}
        {" / "}
        <span className="text-foreground">{category.name}</span>
      </nav>
      <h1 className="text-3xl font-bold">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-2xl text-label text-muted-foreground">{category.description}</p>}
      {category.children.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/categories/${c.slug}`}
                className="inline-flex h-9 items-center rounded-full bg-secondary px-4 text-label font-bold hover:bg-border"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <ProductListing searchParams={await searchParams} basePath={`/categories/${slug}`} category={slug} />
      </div>
    </>
  )
}
