import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "@/lib/auth/constants"
import { verifyAccessToken } from "@/server/auth/jwt"
import { getUserById, type AuthSession, type PublicUser } from "@/server/services/auth.service"

const baseCookie = {
  httpOnly: true,
  // Chrome/Firefox coi localhost là secure context nhưng Safari thì không → chỉ bật secure ở production.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}

/** Chỉ gọi được trong Server Action / Route Handler (nơi được phép ghi cookie). */
export async function setAuthCookies(session: Pick<AuthSession, "accessToken" | "refreshToken">) {
  const store = await cookies()
  store.set(ACCESS_COOKIE, session.accessToken, { ...baseCookie, maxAge: ACCESS_TTL_SECONDS })
  store.set(REFRESH_COOKIE, session.refreshToken, { ...baseCookie, maxAge: REFRESH_TTL_SECONDS })
}

export async function clearAuthCookies() {
  const store = await cookies()
  store.delete(ACCESS_COOKIE)
  store.delete(REFRESH_COOKIE)
}

export async function getRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value
}

/**
 * User hiện tại hoặc null. Kiểm chữ ký access token rồi đọc lại DB để role/tên luôn mới
 * và tài khoản đã xoá thì mất hiệu lực ngay. `cache` để 1 request chỉ query 1 lần.
 * Không tự refresh được (RSC không ghi được cookie) — middleware đảm nhiệm việc đó.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  const payload = await verifyAccessToken(token)
  if (!payload) return null
  return getUserById(payload.userId)
})

export async function requireUser(nextPath?: string): Promise<PublicUser> {
  const user = await getCurrentUser()
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login")
  return user
}

export async function requireAdmin(nextPath?: string): Promise<PublicUser> {
  const user = await requireUser(nextPath)
  if (user.role !== "ADMIN") redirect("/")
  return user
}
