import { NextResponse, type NextRequest } from "next/server"
import { safeNextPath } from "@/lib/validators/auth"
import { clearAuthCookies, getRefreshCookie, setAuthCookies } from "@/server/auth/session"
import { AuthError, refresh } from "@/server/services/auth.service"

// Được middleware chuyển hướng tới khi access token hết hạn. Xong thì quay lại trang đang xem.
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"))
  const target = new URL(next, req.url)
  const token = await getRefreshCookie()

  if (token) {
    try {
      await setAuthCookies(await refresh(token))
    } catch (e) {
      if (!(e instanceof AuthError)) throw e
      // Refresh token hỏng/đã dùng lại: xoá cookie để không bị lặp redirect.
      await clearAuthCookies()
    }
  }
  return NextResponse.redirect(target)
}
