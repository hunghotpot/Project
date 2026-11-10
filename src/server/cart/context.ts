import "server-only"
import { getCurrentUser } from "@/server/auth/session"
import type { CartContext } from "@/server/services/cart.service"

// Cầu nối request → CartContext. cart.service không biết gì về cookie/session đăng nhập; chỉ file này đọc request.

/** Giỏ hàng chỉ dành cho user đã đăng nhập: khách → null (route trả 401, trang chuyển sang /login). */
export async function resolveCartContext(): Promise<CartContext | null> {
  const user = await getCurrentUser()
  return user ? { userId: user.id } : null
}
