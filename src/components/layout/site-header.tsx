import Link from "next/link"
import { AccountMenu, type AccountMenuUser } from "@/components/layout/account-menu"
import { CartButton } from "@/components/cart/cart-button"
import { Logo } from "@/components/layout/logo"
import { MobileNav } from "@/components/layout/mobile-nav"
import { SearchForm } from "@/components/layout/search-form"
import type { NavCategory } from "@/types/catalog"

interface SiteHeaderProps {
  categories: NavCategory[]
  /** null = chưa đăng nhập. */
  user?: AccountMenuUser | null
}

export function SiteHeader({ categories, user = null }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-3 px-4 md:h-[77px] md:gap-4 md:px-8">
        <MobileNav categories={categories} />
        <Logo />

        {/* Desktop: menu danh mục lấy từ DB */}
        <nav
          aria-label="Danh mục chính"
          className="ml-6 hidden items-center gap-6 lg:flex xl:ml-24 xl:gap-8"
        >
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="text-nav font-bold whitespace-nowrap text-foreground uppercase transition-colors hover:text-primary focus-visible:text-primary"
            >
              {c.name}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchForm className="hidden w-56 md:block xl:w-60" />
          <AccountMenu user={user} />
          <CartButton authenticated={!!user} />
        </div>
      </div>

      {/* Mobile: ô tìm kiếm nằm hàng riêng dưới header */}
      <div className="px-4 pb-3 md:hidden">
        <SearchForm />
      </div>
    </header>
  )
}

