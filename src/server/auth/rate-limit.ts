// Rate limit đăng nhập in-memory (đủ cho 1 instance / dev).
// Nhiều instance hoặc serverless: thay Map bằng Redis (INCR + EXPIRE) giữ nguyên các hàm này.

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60 * 1000

interface Entry {
  failures: number
  resetAt: number
}

const store = new Map<string, Entry>()

function getActive(key: string, now: number): Entry | undefined {
  const entry = store.get(key)
  if (entry && entry.resetAt <= now) {
    store.delete(key)
    return undefined
  }
  return entry
}

/** Số giây phải chờ nếu key đang bị khoá, ngược lại null. */
export function loginBlockedFor(key: string, now = Date.now()): number | null {
  const entry = getActive(key, now)
  if (!entry || entry.failures < MAX_FAILURES) return null
  return Math.ceil((entry.resetAt - now) / 1000)
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const entry = getActive(key, now)
  if (entry) {
    entry.failures += 1
  } else {
    store.set(key, { failures: 1, resetAt: now + WINDOW_MS })
  }
}

export function clearLoginFailures(key: string): void {
  store.delete(key)
}

/** Chỉ dùng trong test. */
export function resetRateLimitStore(): void {
  store.clear()
}
