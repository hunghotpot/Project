import Link from "next/link"
import { Logo } from "@/components/layout/logo"
import { SITE_NAME } from "@/lib/site"
import type { NavCategory } from "@/types/catalog"

// Figma chưa có footer → dựng theo ngôn ngữ hero (ink, chữ trắng/slate).
export function SiteFooter({ categories }: { categories: NavCategory[] }) {
  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="mx-auto grid w-full max-w-page gap-10 px-4 py-12 md:grid-cols-[1.5fr_2fr] md:px-8">
        <div className="space-y-4">
          <Logo inverted />
          <p className="max-w-sm text-sm text-subtle-foreground">
            Khám phá phong cách thời trang hiện đại và năng động, từ đồ mặc hằng ngày đến phụ kiện.
          </p>
        </div>

        <nav aria-label="Danh mục ở chân trang" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {categories.map((c) => (
            <div key={c.id} className="space-y-3">
              <Link
                href={`/categories/${c.slug}`}
                className="text-sm font-bold uppercase hover:text-primary"
              >
                {c.name}
              </Link>
              <ul className="space-y-2">
                {c.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/categories/${child.slug}`}
                      className="text-label text-subtle-foreground hover:text-white"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-page px-4 py-5 text-xs text-subtle-foreground md:px-8">
          © {new Date().getFullYear()} {SITE_NAME}. Bảo lưu mọi quyền.
        </p>
      </div>
    </footer>
  )
}

