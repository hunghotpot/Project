/*
 * Circuit breaker cho các lời gọi tới model (docs/ai/05-safety-and-guardrails.md mục 8): Ollama sập hoặc treo thì không để mỗi yêu cầu
 * chờ hết timeout, mà ngắt một lúc và đi thẳng fallback (chat báo bận, tìm kiếm rơi về từ khoá).
 *
 *  - đóng: gọi bình thường. Lỗi liên tiếp (không xen thành công) đủ `threshold` trong `windowMs` thì mở.
 *  - mở: từ chối ngay trong `openMs`.
 *  - nửa mở: hết `openMs` chỉ cho MỘT lượt thăm dò đi qua; thành công thì đóng, thất bại thì mở lại.
 * Trạng thái nằm trong bộ nhớ của tiến trình (mỗi instance tự đo; đủ cho một máy chạy Ollama).
 * Chỉ tính lỗi hạ tầng (không kết nối được, timeout, luồng đứt), KHÔNG tính lỗi nghiệp vụ như tool trả ok:false.
 */

export interface BreakerOptions {
  threshold?: number
  windowMs?: number
  openMs?: number
  /** Chỉ để test. */
  now?: () => number
  /** Gọi khi đổi trạng thái (để ghi log cảnh báo). */
  onChange?: (state: BreakerState) => void
}

export type BreakerState = "closed" | "open" | "half-open"
export type BreakerGate = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export const DEFAULT_THRESHOLD = 5
export const DEFAULT_WINDOW_MS = 60_000
export const DEFAULT_OPEN_MS = 120_000

export class CircuitBreaker {
  private state: BreakerState = "closed"
  private failures: number[] = []
  private openedAt = 0
  private probeStartedAt = 0
  private readonly threshold: number
  private readonly windowMs: number
  private readonly openMs: number
  private readonly now: () => number
  private readonly onChange?: (state: BreakerState) => void

  constructor(opts: BreakerOptions = {}) {
    this.threshold = opts.threshold ?? DEFAULT_THRESHOLD
    this.windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS
    this.openMs = opts.openMs ?? DEFAULT_OPEN_MS
    this.now = opts.now ?? Date.now
    this.onChange = opts.onChange
  }

  get current(): BreakerState {
    return this.state
  }

  private set(state: BreakerState) {
    if (this.state === state) return
    this.state = state
    this.onChange?.(state)
  }

  /** Có được gọi model lúc này không. Nửa mở: lượt đầu tiên là lượt thăm dò, các lượt khác bị từ chối cho tới khi có kết quả. */
  allow(): BreakerGate {
    if (this.state === "closed") return { allowed: true }
    const t = this.now()
    if (this.state === "open") {
      const left = this.openedAt + this.openMs - t
      if (left > 0) return { allowed: false, retryAfterSeconds: Math.ceil(left / 1000) }
      this.set("half-open")
      this.probeStartedAt = t
      return { allowed: true }
    }
    // Nửa mở: đang có một lượt thăm dò. Nếu nó bị thất lạc (khách đóng trang, tiến trình lỗi) quá `openMs` thì cho lượt khác thử.
    if (t - this.probeStartedAt >= this.openMs) {
      this.probeStartedAt = t
      return { allowed: true }
    }
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((this.probeStartedAt + this.openMs - t) / 1000)) }
  }

  /** Lời gọi thành công: xoá chuỗi lỗi, đóng nếu đang nửa mở. */
  success(): void {
    this.failures = []
    this.set("closed")
  }

  /** Lời gọi lỗi hạ tầng: đủ ngưỡng thì mở; lượt thăm dò hỏng thì mở lại ngay. */
  failure(): void {
    const t = this.now()
    if (this.state === "half-open") {
      this.openedAt = t
      this.set("open")
      return
    }
    this.failures = [...this.failures.filter((f) => t - f < this.windowMs), t]
    if (this.failures.length >= this.threshold) {
      this.openedAt = t
      this.failures = []
      this.set("open")
    }
  }
}

/** Lỗi ném khi breaker đang mở: người gọi coi như lỗi model và chạy fallback của mình. */
export class CircuitOpenError extends Error {
  constructor(
    readonly target: string,
    readonly retryAfterSeconds: number,
  ) {
    super(`Dịch vụ AI (${target}) đang tạm ngắt, thử lại sau ${retryAfterSeconds} giây`)
    this.name = "CircuitOpenError"
  }
}

const registry = new Map<string, CircuitBreaker>()

/** Breaker dùng chung của tiến trình theo tên ("chat", "embedding"). */
export function getBreaker(name: string): CircuitBreaker {
  let b = registry.get(name)
  if (!b) {
    b = new CircuitBreaker({
      onChange: (state) => console.warn(`[ai] breaker "${name}" chuyển sang ${state === "open" ? "MỞ (tạm ngắt gọi model)" : state === "half-open" ? "nửa mở (thăm dò)" : "đóng (bình thường)"}`),
    })
    registry.set(name, b)
  }
  return b
}

/** Chỉ dùng trong test: xoá trạng thái của mọi breaker. */
export function resetBreakers(): void {
  registry.clear()
}
