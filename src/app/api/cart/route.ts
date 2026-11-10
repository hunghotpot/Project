import { NextResponse } from "next/server"
import { EMPTY_CART } from "@/lib/cart"
import { resolveCartContext } from "@/server/cart/context"
import { getCart } from "@/server/services/cart.service"

// Khách xem được "giỏ rỗng" (badge = 0); thao tác ghi thì bị chặn ở các route bên dưới.
export async function GET() {
  const ctx = await resolveCartContext()
  return NextResponse.json(ctx ? await getCart(ctx) : EMPTY_CART)
}

