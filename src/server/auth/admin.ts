import "server-only"
import { getCurrentUser } from "@/server/auth/session"
import type { PublicUser } from "@/server/services/auth.service"

/**
 * Admin hiện tại hoặc null. Dùng trong Server Action (không dùng requireAdmin vì nó redirect, còn action cần trả kết quả có cấu trúc).
 * Đọc lại DB qua getCurrentUser nên tài khoản bị khoá hoặc bị hạ quyền mất hiệu lực ngay.
 */
export async function getAdminUser(): Promise<PublicUser | null> {
  const user = await getCurrentUser()
  return user?.role === "ADMIN" ? user : null
}

export const NOT_ADMIN_MESSAGE = "Bạn không có quyền thực hiện thao tác này"
