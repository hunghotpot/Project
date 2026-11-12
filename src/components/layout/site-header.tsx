import { AccountMenu, type AccountMenuUser } from "@/components/layout/account-menu"
import { CartButton } from "@/components/cart/cart-button"
import { Logo } from "@/components/layout/logo"
import { SearchForm } from "@/components/layout/search-form"

interface SiteHeaderProps {
  /** null = chưa đăng nhập. */
  user?: AccountMenuUser | null
}

// Header không hiện danh mục: khách duyệt danh mục qua chân trang, ô tìm kiếm và trang sản phẩm.
export function SiteHeader({ user = null }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-3 px-4 md:h-[77px] md:gap-4 md:px-8">
        <Logo />

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
