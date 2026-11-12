import Link from "next/link"
import { Logo } from "@/components/layout/logo"
import { POLICIES } from "@/lib/policies"
import { SITE_NAME } from "@/lib/site"
import type { NavCategory } from "@/types/catalog"

const ACCOUNT_LINKS = [
  { href: "/account/profile", label: "Thông tin cá nhân" },
  { href: "/account/orders", label: "Đơn hàng của tôi" },
  { href: "/account/addresses", label: "Sổ địa chỉ" },
]

const linkClass = "text-label text-subtle-foreground transition-colors hover:text-white"
const headingClass = "mb-3 text-sm font-bold uppercase"

// Figma chưa có footer → dựng theo ngôn ngữ hero (ink, chữ trắng/slate). Bốn cột: giới thiệu, danh mục, tài khoản, chính sách.
export function SiteFooter({ categories }: { categories: NavCategory[] }) {
  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="mx-auto grid w-full max-w-page grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] md:gap-8 md:px-8">
        <div className="col-span-2 space-y-4 md:col-span-1">
          <Logo inverted />
          <p className="max-w-sm text-sm text-subtle-foreground">
            Khám phá phong cách thời trang hiện đại và năng động, từ đồ mặc hằng ngày đến phụ kiện.
          </p>
        </div>

        <nav aria-label="Danh mục ở chân trang">
          <h2 className={headingClass}>Danh mục</h2>
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categories/${c.slug}`} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Tài khoản">
          <h2 className={headingClass}>Tài khoản</h2>
          <ul className="space-y-2">
            {ACCOUNT_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Chính sách">
          <h2 className={headingClass}>Chính sách</h2>
          <ul className="space-y-2">
            {POLICIES.map((p) => (
              <li key={p.slug}>
                <Link href={`/chinh-sach/${p.slug}`} className={linkClass}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
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
