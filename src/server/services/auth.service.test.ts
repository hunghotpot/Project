import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetRateLimitStore } from "@/server/auth/rate-limit"
import { fakeStore } from "@/test/fake-db"
import { AuthError, getUserById, login, logout, refresh, register, startSession } from "./auth.service"

vi.mock("@/server/db", async () => ({ db: (await import("@/test/fake-db")).fakeDb }))

const newUser = {
  name: "Nguyễn Văn A",
  email: "a@example.com",
  phone: null,
  password: "Matkhau123",
  confirmPassword: "Matkhau123",
}
const ctx = { ip: "1.2.3.4" }

async function expectAuthError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(AuthError)
  expect((err as AuthError).code).toBe(code)
  return err as AuthError
}

beforeEach(() => {
  fakeStore.reset()
  resetRateLimitStore()
})

describe("register", () => {
  it("tạo user, hash mật khẩu và chỉ lưu hash của refresh token", async () => {
    const session = await register(newUser)

    expect(session.user.email).toBe("a@example.com")
    expect(fakeStore.users[0].passwordHash).not.toBe(newUser.password)
    expect(fakeStore.tokens).toHaveLength(1)
    expect(fakeStore.tokens[0].tokenHash).not.toBe(session.refreshToken)
  })

  it("báo lỗi ở field email khi đăng ký trùng email", async () => {
    await register(newUser)

    const err = await expectAuthError(register(newUser), "EMAIL_TAKEN")
    expect(err.field).toBe("email")
    expect(fakeStore.users).toHaveLength(1)
  })
})

describe("login", () => {
  it("từ chối sai mật khẩu bằng thông báo chung, không lộ email có tồn tại hay không", async () => {
    await register(newUser)

    const wrongPassword = await expectAuthError(
      login({ email: newUser.email, password: "SaiMatKhau1" }, ctx),
      "INVALID_CREDENTIALS"
    )
    const unknownEmail = await expectAuthError(
      login({ email: "khong-ton-tai@example.com", password: "Matkhau123" }, ctx),
      "INVALID_CREDENTIALS"
    )
    expect(wrongPassword.message).toBe(unknownEmail.message)
  })

  it("đăng nhập đúng thì cấp phiên mới", async () => {
    await register(newUser)
    const session = await login({ email: newUser.email, password: newUser.password }, ctx)
    expect(session.user.email).toBe(newUser.email)
    expect(fakeStore.tokens).toHaveLength(2)
  })

  it("khoá sau 5 lần sai liên tiếp, kể cả khi lần sau nhập đúng", async () => {
    await register(newUser)
    for (let i = 0; i < 5; i++) {
      await expectAuthError(login({ email: newUser.email, password: "SaiMatKhau1" }, ctx), "INVALID_CREDENTIALS")
    }
    const err = await expectAuthError(
      login({ email: newUser.email, password: newUser.password }, ctx),
      "RATE_LIMITED"
    )
    expect(err.retryAfter).toBeGreaterThan(0)
  })
})

describe("refresh", () => {
  it("rotate: cấp token mới và thu hồi token cũ", async () => {
    const first = await register(newUser)
    const second = await refresh(first.refreshToken)

    expect(second.refreshToken).not.toBe(first.refreshToken)
    expect(fakeStore.tokens.filter((t) => t.revokedAt === null)).toHaveLength(1)
    expect(fakeStore.tokens[0].revokedAt).not.toBeNull()
    expect(fakeStore.tokens[0].familyId).toBe(fakeStore.tokens[1].familyId)
  })

  it("token đã rotate mà bị dùng lại thì báo lỗi và thu hồi cả family", async () => {
    const first = await register(newUser)
    const second = await refresh(first.refreshToken)

    await expectAuthError(refresh(first.refreshToken), "REFRESH_TOKEN_REUSED")

    // Token hợp lệ vừa cấp cũng bị vô hiệu: kẻ trộm lẫn người dùng thật đều phải đăng nhập lại.
    expect(fakeStore.tokens.every((t) => t.revokedAt !== null)).toBe(true)
    await expectAuthError(refresh(second.refreshToken), "REFRESH_TOKEN_REUSED")
  })

  it("từ chối token lạ và token hết hạn", async () => {
    await expectAuthError(refresh("token-khong-ton-tai"), "INVALID_REFRESH_TOKEN")

    const session = await register(newUser)
    fakeStore.tokens[0].expiresAt = new Date(Date.now() - 1000)
    await expectAuthError(refresh(session.refreshToken), "INVALID_REFRESH_TOKEN")
  })
})

describe("logout", () => {
  it("thu hồi refresh token nên không refresh được nữa", async () => {
    const session = await register(newUser)
    await logout(session.refreshToken)

    await expectAuthError(refresh(session.refreshToken), "REFRESH_TOKEN_REUSED")
  })
})

describe("tài khoản bị khoá (Admin khoá khách)", () => {
  const lock = () => {
    fakeStore.users[0].status = "LOCKED"
  }

  it("đăng nhập đúng mật khẩu vẫn bị chặn bằng ACCOUNT_LOCKED và không cấp phiên mới", async () => {
    await register(newUser)
    lock()
    const tokensBefore = fakeStore.tokens.length
    await expectAuthError(login({ email: newUser.email, password: newUser.password }, ctx), "ACCOUNT_LOCKED")
    expect(fakeStore.tokens).toHaveLength(tokensBefore)
  })

  it("sai mật khẩu vẫn báo lỗi chung: không lộ tài khoản đang bị khoá cho người không biết mật khẩu", async () => {
    await register(newUser)
    lock()
    await expectAuthError(login({ email: newUser.email, password: "SaiMatKhau1" }, ctx), "INVALID_CREDENTIALS")
  })

  it("refresh token còn hạn không dùng được nữa, mọi token của user bị thu hồi", async () => {
    const session = await register(newUser)
    await login({ email: newUser.email, password: newUser.password }, ctx)
    lock()
    await expectAuthError(refresh(session.refreshToken), "ACCOUNT_LOCKED")
    expect(fakeStore.tokens.every((t) => t.revokedAt !== null)).toBe(true)
  })

  it("access token còn hạn mất hiệu lực ngay: getUserById trả null; mở khoá thì có lại", async () => {
    const session = await register(newUser)
    expect(await getUserById(session.user.id)).not.toBeNull()
    lock()
    expect(await getUserById(session.user.id)).toBeNull()
    fakeStore.users[0].status = "ACTIVE"
    expect(await getUserById(session.user.id)).not.toBeNull()
  })

  it("startSession cho tài khoản bị khoá bị từ chối", async () => {
    const session = await register(newUser)
    lock()
    await expectAuthError(startSession(session.user.id), "ACCOUNT_LOCKED")
  })
})
