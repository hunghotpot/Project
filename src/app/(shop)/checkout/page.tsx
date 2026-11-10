import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckoutForm } from "@/components/checkout/checkout-form"
import { calculateShippingFee } from "@/lib/shipping"
import { requireUser } from "@/server/auth/session"
import { isVnpayConfigured } from "@/server/payment/vnpay-config"
import { listAddresses } from "@/server/services/address.service"
import { getCart } from "@/server/services/cart.service"

export const metadata: Metadata = { title: "Thanh toán", robots: { index: false } }

export default async function CheckoutPage() {
  const user = await requireUser("/checkout")
  const [cart, addresses] = await Promise.all([getCart({ userId: user.id }), listAddresses(user.id)])
  if (cart.items.length === 0) redirect("/cart")

  const shippingFee = calculateShippingFee(cart.subtotal)

  return (
    <div className="pb-16">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Trang chủ
        </Link>
        {" / "}
        <Link href="/cart" className="hover:text-foreground">
          Giỏ hàng
        </Link>
        {" / "}
        <span className="font-bold text-foreground">Thanh toán</span>
      </nav>
      <h1 className="mt-6 mb-10 text-3xl font-bold">Thanh Toán Đơn Hàng</h1>

      <CheckoutForm
        addresses={addresses}
        vnpayEnabled={isVnpayConfigured()}
        items={cart.items}
        itemCount={cart.itemCount}
        subtotal={cart.subtotal}
        shippingFee={shippingFee}
        total={cart.subtotal + shippingFee}
      />
    </div>
  )
}

