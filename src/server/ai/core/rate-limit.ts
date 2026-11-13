import "server-only"
import Redis from "ioredis"
import { orderDayKey } from "@/lib/order"

/*
 * Giới hạn tốc độ theo người dùng và ngân sách token mỗi ngày cho `/api/ai/*` (docs/ai/05-safety-and-guardrails.md mục 4).
 * Dùng Redis (INCR + EXPIRE) để bộ đếm sống ngoài tiến trình. Redis chưa cấu hình hoặc lỗi thì rơi về đếm trong bộ nhớ:
 * vẫn giới hạn được trên một máy, chỉ không chia sẻ giữa nhiều máy chủ và mất khi khởi động lại.
 */

export interface RateLimitResult {
  allowed: boolean
  /** Số yêu cầu còn lại trong cửa sổ hiện tại. */
  remaining: number
  /** Số giây phải chờ nếu bị chặn (cửa sổ cố định tính từ yêu cầu đầu tiên). */
  retryAfterSeconds: number
}

interface MemoryEntry {
  count: number
  resetAt: number
}

const DAY_SECONDS = 24 * 60 * 60

export function createRateLimiter(redisUrl: string | undefined) {
  const memory = new Map<string, MemoryEntry>()
  let client: Redis | undefined
  let warned = false

  const warn = (e: unknown) => {
    if (warned) return
    warned = true
    console.warn("[ai] Redis không dùng được, rơi về đếm trong bộ nhớ:", e instanceof Error ? e.message : e)
  }

  function redis(): Redis | undefined {
    if (!redisUrl) return undefined
    if (!client) {
      // Không xếp hàng lệnh khi mất kết nối: lỗi ngay để rơi về bộ nhớ thay vì treo yêu cầu.
      client = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1000, lazyConnect: true })
      client.on("error", warn)
    }
    return client
  }

  /** Chạy bằng Redis nếu có, ngược lại (hoặc khi Redis lỗi) chạy bằng bộ nhớ. */
  async function withRedis<T>(onRedis: (r: Redis) => Promise<T>, onMemory: () => T): Promise<T> {
    const r = redis()
    if (r) {
      try {
        if (r.status === "wait") await r.connect()
        return await onRedis(r)
      } catch (e) {
        warn(e)
      }
    }
    return onMemory()
  }

  function memoryCount(key: string, windowMs: number, add: number, now: number): MemoryEntry {
    const entry = memory.get(key)
    if (entry && entry.resetAt > now) {
      entry.count += add
      return entry
    }
    const fresh = { count: add, resetAt: now + windowMs }
    memory.set(key, fresh)
    return fresh
  }

  /** Tính một yêu cầu vào bộ đếm `key`; vượt `limit` trong `windowSeconds` thì bị chặn. */
  async function consume(key: string, limit: number, windowSeconds: number, now = Date.now()): Promise<RateLimitResult> {
    const k = `ai:rl:${key}`
    const { count, ttl } = await withRedis(
      async (r) => {
        const res = await r.multi().incr(k).ttl(k).exec()
        const count = Number(res?.[0]?.[1])
        let ttl = Number(res?.[1]?.[1])
        if (ttl < 0) {
          await r.expire(k, windowSeconds)
          ttl = windowSeconds
        }
        return { count, ttl }
      },
      () => {
        const e = memoryCount(k, windowSeconds * 1000, 1, now)
        return { count: e.count, ttl: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) }
      },
    )
    const allowed = count <= limit
    return { allowed, remaining: Math.max(0, limit - count), retryAfterSeconds: allowed ? 0 : ttl }
  }

  const tokenKey = (userId: string, now: number) => `ai:tokens:${userId}:${orderDayKey(new Date(now))}`
  /** Khoá của tổng toàn hệ thống: id người dùng (cuid) không bao giờ trùng "_all". */
  const TOTAL = "_all"

  /** Số token người dùng đã dùng trong ngày (theo giờ Việt Nam). */
  async function tokensUsedToday(userId: string, now = Date.now()): Promise<number> {
    const k = tokenKey(userId, now)
    return withRedis(
      async (r) => Number((await r.get(k)) ?? 0),
      () => {
        const e = memory.get(k)
        return e && e.resetAt > now ? e.count : 0
      },
    )
  }

  /** Tổng token cả hệ thống đã dùng trong ngày (mọi người dùng cộng lại). */
  const totalTokensToday = (now = Date.now()) => tokensUsedToday(TOTAL, now)

  /** Cộng token vừa dùng vào ngân sách ngày của người dùng và vào tổng toàn hệ thống (giữ khoá 2 ngày rồi tự xoá). */
  async function addTokens(userId: string, tokens: number, now = Date.now()): Promise<void> {
    if (!Number.isFinite(tokens) || tokens <= 0) return
    const n = Math.round(tokens)
    for (const k of [tokenKey(userId, now), tokenKey(TOTAL, now)]) {
      await withRedis(
        async (r) => {
          const total = await r.incrby(k, n)
          if (total === n) await r.expire(k, 2 * DAY_SECONDS)
        },
        () => {
          memoryCount(k, 2 * DAY_SECONDS * 1000, n, now)
        },
      )
    }
  }

  async function close(): Promise<void> {
    if (client && client.status !== "end") client.disconnect()
    client = undefined
  }

  return { consume, tokensUsedToday, totalTokensToday, addTokens, close }
}

export type AiRateLimiter = ReturnType<typeof createRateLimiter>

let shared: AiRateLimiter | undefined

/** Bộ giới hạn dùng chung của tiến trình, đọc `REDIS_URL` một lần. */
export function getAiRateLimiter(): AiRateLimiter {
  shared ??= createRateLimiter(process.env.REDIS_URL)
  return shared
}
