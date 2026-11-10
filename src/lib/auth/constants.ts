// Dùng được ở cả middleware (Edge) lẫn server: không import gì từ Node/Prisma.

export const ACCESS_COOKIE = "access_token"
export const REFRESH_COOKIE = "refresh_token"

export const ACCESS_TTL_SECONDS = 15 * 60
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60

export const ROLES = ["CUSTOMER", "ADMIN"] as const
export type AppRole = (typeof ROLES)[number]
