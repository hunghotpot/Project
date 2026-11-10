import "server-only"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import type { Prisma, Role } from "@prisma/client"
import { REFRESH_TTL_SECONDS } from "@/lib/auth/constants"
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from "@/lib/validators/auth"
import { signAccessToken } from "@/server/auth/jwt"
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/server/auth/rate-limit"
import { db } from "@/server/db"

/*
 * Toàn bộ nghiệp vụ xác thực. Service KHÔNG đụng tới cookie/headers:
 * trả token về cho tầng gọi (Server Action / Route Handler) tự set cookie.
 * Đầu vào được giả định đã qua Zod ở tầng gọi.
 */

const BCRYPT_COST = 10

export type AuthErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_REUSED"
  | "WRONG_PASSWORD"
  | "USER_NOT_FOUND"

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    /** Tên field của form để hiện lỗi đúng ô (nếu có). */
    public readonly field?: string,
    /** RATE_LIMITED: số giây phải chờ. */
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = "AuthError"
  }
}

export interface PublicUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: Role
}

export interface AuthSession {
  user: PublicUser
  accessToken: string
  /** Token gốc — chỉ tồn tại ở đây, DB chỉ giữ hash. */
  refreshToken: string
}

type Db = Prisma.TransactionClient

interface UserRow extends PublicUser {
  passwordHash: string
}

function toPublicUser(u: PublicUser): PublicUser {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

// Hash giả để so sánh khi email không tồn tại → thời gian phản hồi không lộ email nào có tài khoản.
let dummyHash: string | undefined
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("dummy-password-for-timing", BCRYPT_COST)
  return dummyHash
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002"
}

async function issueSession(user: PublicUser, familyId: string, client: Db = db): Promise<AuthSession> {
  // 32 byte ngẫu nhiên (256 bit) → SHA-256 là đủ, không cần bcrypt cho token entropy cao.
  const refreshToken = randomBytes(32).toString("base64url")
  await client.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
    },
  })
  const accessToken = await signAccessToken({ userId: user.id, role: user.role })
  return { user: toPublicUser(user), accessToken, refreshToken }
}

/** Tạo phiên mới (family mới) cho user đã xác thực. */
export async function startSession(userId: string): Promise<AuthSession> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AuthError("USER_NOT_FOUND", "Tài khoản không tồn tại")
  return issueSession(user, randomUUID())
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (existing) throw new AuthError("EMAIL_TAKEN", "Email này đã được đăng ký", "email")

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST)
  let user: PublicUser
  try {
    user = await db.user.create({
      data: { email: input.email, name: input.name, phone: input.phone, passwordHash },
    })
  } catch (e) {
    // Hai request đăng ký cùng email chạy song song: unique index là chốt chặn cuối.
    if (isUniqueViolation(e)) throw new AuthError("EMAIL_TAKEN", "Email này đã được đăng ký", "email")
    throw e
  }
  return issueSession(user, randomUUID())
}

export async function login(input: LoginInput, ctx: { ip: string }): Promise<AuthSession> {
  const key = `${ctx.ip}|${input.email}`
  const retryAfter = loginBlockedFor(key)
  if (retryAfter !== null) {
    throw new AuthError(
      "RATE_LIMITED",
      `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(retryAfter / 60)} phút`,
      undefined,
      retryAfter
    )
  }

  const user: UserRow | null = await db.user.findUnique({ where: { email: input.email } })
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? getDummyHash())
  if (!user || !passwordOk) {
    recordLoginFailure(key)
    throw new AuthError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng")
  }

  clearLoginFailures(key)
  return issueSession(user, randomUUID())
}

/** Thu hồi refresh token hiện tại. Token lạ/đã thu hồi thì bỏ qua (logout luôn thành công). */
export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return
  await db.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Rotate: thu hồi refresh token cũ, cấp cặp token mới cùng family.
 * Token đã bị thu hồi mà vẫn được dùng lại ⇒ nghi bị đánh cắp ⇒ thu hồi cả family.
 */
export async function refresh(refreshToken: string): Promise<AuthSession> {
  const record = await db.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  })
  if (!record) throw new AuthError("INVALID_REFRESH_TOKEN", "Phiên đăng nhập không hợp lệ")

  if (record.revokedAt) return revokeFamilyAndThrow(record.familyId)
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AuthError("INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn")
  }

  const rotated = await db.$transaction(async (tx) => {
    // updateMany có điều kiện revokedAt=null → hai request song song chỉ một bên thắng.
    const claimed = await tx.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (claimed.count === 0) return null
    return issueSession(record.user, record.familyId, tx)
  })

  return rotated ?? revokeFamilyAndThrow(record.familyId)
}

async function revokeFamilyAndThrow(familyId: string): Promise<never> {
  await db.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  throw new AuthError("REFRESH_TOKEN_REUSED", "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại")
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await db.user.findUnique({ where: { id } })
  return user ? toPublicUser(user) : null
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  const user = await db.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone },
  })
  return toPublicUser(user)
}

/** Đổi mật khẩu và thu hồi mọi refresh token (đăng xuất các thiết bị khác). */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AuthError("USER_NOT_FOUND", "Tài khoản không tồn tại")

  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash)
  if (!ok) throw new AuthError("WRONG_PASSWORD", "Mật khẩu hiện tại không đúng", "currentPassword")

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST)
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ])
}
