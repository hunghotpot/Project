// Không import "server-only" và không dùng API Node: file này được middleware (Edge) dùng chung.
import { SignJWT, jwtVerify } from "jose"
import { ACCESS_TTL_SECONDS, ROLES, type AppRole } from "@/lib/auth/constants"

export interface AccessPayload {
  userId: string
  role: AppRole
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET chưa được cấu hình hoặc quá ngắn (tối thiểu 32 ký tự)")
  }
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(payload: AccessPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(getSecret())
}

/** Trả về null nếu token thiếu, sai chữ ký, hết hạn hoặc payload không hợp lệ. */
export async function verifyAccessToken(token: string | undefined): Promise<AccessPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] })
    const role = payload.role
    if (!payload.sub || typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) {
      return null
    }
    return { userId: payload.sub, role: role as AppRole }
  } catch {
    return null
  }
}
