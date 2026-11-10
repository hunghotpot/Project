import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants"
import { verifyAccessToken } from "@/server/auth/jwt"

/*
 * Middleware chạy ở Edge nên chỉ verify chữ ký JWT (không chạm DB).
 * - /account/*: cần đăng nhập. /admin/*: cần role ADMIN.
 * - Access token hết hạn nhưng còn refresh token → chuyển qua /api/auth/refresh
 *   (Route Handler rotate token, ghi cookie, rồi redirect về trang cũ).
 */

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const isAccount = pathname === "/account" || pathname.startsWith("/account/")
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/")

  const access = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value)

  if (!access) {
    const isPrefetch =
      req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch"
    if (req.cookies.has(REFRESH_COOKIE) && req.method === "GET" && !isPrefetch) {
      const url = new URL("/api/auth/refresh", req.url)
      url.searchParams.set("next", pathname + search)
      return NextResponse.redirect(url)
    }
    if (isAccount || isAdmin) {
      const url = new URL("/login", req.url)
      url.searchParams.set("next", pathname + search)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  if (isAdmin && access.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url))
  }
  return NextResponse.next()
}

export const config = {
  // Bỏ qua API, file tĩnh và asset của Next.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
}
