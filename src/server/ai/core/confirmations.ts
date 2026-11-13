import "server-only"
import { randomBytes } from "node:crypto"
import Redis from "ioredis"

/*
 * Kho xác nhận cho tool GHI (docs/ai/04-tool-calling.md mục 3). Tool `addToCart` chỉ tạo một bản ghi ở đây; chỉ khi khách bấm
 * "Xác nhận" trên giao diện, `POST /api/ai/confirm` mới lấy bản ghi ra và ghi giỏ hàng. Đảm bảo:
 *  - dùng MỘT lần (lấy ra là xoá, nguyên tử: Redis GETDEL),
 *  - gắn đúng người dùng (khoá chứa userId nên người khác có biết id cũng không lấy được),
 *  - hết hạn ngắn (mặc định 5 phút),
 *  - id ngẫu nhiên 128 bit, không đoán được.
 * Redis chưa cấu hình hoặc lỗi thì rơi về bộ nhớ (đúng trên một máy; mất khi khởi động lại, người dùng chỉ cần nhờ trợ lý lại).
 */

export const CONFIRMATION_TTL_SECONDS = 5 * 60

/** Việc sẽ được ghi khi khách xác nhận. Chỉ gồm điều server đã kiểm, không có gì do khách hay model tự khai ngoài biến thể và số lượng. */
export interface PendingAddToCart {
  kind: "addToCart"
  variantId: string
  quantity: number
}

interface MemoryEntry {
  value: PendingAddToCart
  expiresAt: number
}

export function createConfirmationStore(redisUrl: string | undefined) {
  const memory = new Map<string, MemoryEntry>()
  let client: Redis | undefined
  let warned = false

  const warn = (e: unknown) => {
    if (warned) return
    warned = true
    console.warn("[ai] Redis không dùng được cho xác nhận, rơi về bộ nhớ:", e instanceof Error ? e.message : e)
  }

  function redis(): Redis | undefined {
    if (!redisUrl) return undefined
    if (!client) {
      client = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1000, lazyConnect: true })
      client.on("error", warn)
    }
    return client
  }

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

  const key = (userId: string, id: string) => `ai:confirm:${userId}:${id}`

  /** Lưu một việc chờ xác nhận cho `userId`; trả id đưa lên thẻ xác nhận. */
  async function create(userId: string, value: PendingAddToCart, now = Date.now()): Promise<{ id: string; expiresInSeconds: number }> {
    const id = randomBytes(16).toString("hex")
    const k = key(userId, id)
    await withRedis(
      async (r) => {
        await r.set(k, JSON.stringify(value), "EX", CONFIRMATION_TTL_SECONDS)
      },
      () => {
        memory.set(k, { value, expiresAt: now + CONFIRMATION_TTL_SECONDS * 1000 })
      },
    )
    return { id, expiresInSeconds: CONFIRMATION_TTL_SECONDS }
  }

  /**
   * Lấy ra VÀ xoá (dùng một lần). null nếu không có, đã dùng, hết hạn hoặc thuộc người dùng khác.
   * Lấy ra rồi mà ghi lỗi thì bản ghi vẫn mất: khách nhờ trợ lý lại (an toàn hơn là cho thử lại cùng một id).
   */
  async function consume(userId: string, id: string, now = Date.now()): Promise<PendingAddToCart | null> {
    const k = key(userId, id)
    return withRedis(
      async (r) => {
        const raw = await r.getdel(k)
        return raw ? (JSON.parse(raw) as PendingAddToCart) : null
      },
      () => {
        const entry = memory.get(k)
        memory.delete(k)
        return entry && entry.expiresAt > now ? entry.value : null
      },
    )
  }

  async function close(): Promise<void> {
    if (client && client.status !== "end") client.disconnect()
    client = undefined
  }

  return { create, consume, close }
}

export type ConfirmationStore = ReturnType<typeof createConfirmationStore>

let shared: ConfirmationStore | undefined

/** Kho dùng chung của tiến trình, đọc `REDIS_URL` một lần. */
export function getConfirmationStore(): ConfirmationStore {
  shared ??= createConfirmationStore(process.env.REDIS_URL)
  return shared
}
