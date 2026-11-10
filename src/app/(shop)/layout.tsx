import { CartDrawer } from "@/components/cart/cart-drawer"
import { CartProvider } from "@/components/cart/cart-provider"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { EMPTY_CART } from "@/lib/cart"
import { getCurrentUser } from "@/server/auth/session"
import { resolveCartContext } from "@/server/cart/context"
import { getCart } from "@/server/services/cart.service"
import { getNavCategories } from "@/server/services/catalog.service"

// Render theo request để skeleton/streaming hoạt động và không cần DB lúc build.
export const dynamic = "force-dynamic"

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [categories, user, cart] = await Promise.all([
    getNavCategories(),
    getCurrentUser(),
    resolveCartContext().then((ctx) => (ctx ? getCart(ctx) : EMPTY_CART)),
  ])

  return (
    <CartProvider initialCart={cart}>
      <SiteHeader
        categories={categories}
        user={user && { name: user.name, email: user.email, role: user.role }}
      />
      <main className="mx-auto w-full max-w-page px-4 pt-7 md:px-8">{children}</main>
      <SiteFooter categories={categories} />
      <CartDrawer />
    </CartProvider>
  )
}

