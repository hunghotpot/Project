import type { Metadata } from "next"
import { CartPageView } from "@/components/cart/cart-page-view"
import { requireUser } from "@/server/auth/session"

export const metadata: Metadata = { title: "Giỏ hàng", robots: { index: false } }

// Giỏ hàng chỉ dành cho người đã đăng nhập: khách bị chuyển sang /login rồi quay lại /cart.
export default async function CartPage() {
  await requireUser("/cart")
  return <CartPageView />
}

