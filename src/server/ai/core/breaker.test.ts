import { describe, expect, it } from "vitest"
import { CircuitBreaker, getBreaker, resetBreakers, type BreakerState } from "./breaker"

function make(opts: { threshold?: number } = {}) {
  let t = 1_000_000
  const states: BreakerState[] = []
  const b = new CircuitBreaker({ ...opts, now: () => t, onChange: (s) => states.push(s) })
  return { b, states, advance: (ms: number) => (t += ms) }
}
const failN = (b: CircuitBreaker, n: number) => Array.from({ length: n }, () => b.failure())

describe("CircuitBreaker", () => {
  it("đóng: cho qua; 4 lỗi liên tiếp chưa mở, lỗi thứ 5 thì mở", () => {
    const { b } = make()
    failN(b, 4)
    expect(b.allow().allowed).toBe(true)
    b.failure()
    expect(b.current).toBe("open")
  })

  it("mở: từ chối kèm số giây còn lại, đủ 2 phút thì cho một lượt thăm dò", () => {
    const { b, advance } = make()
    failN(b, 5)
    expect(b.allow()).toEqual({ allowed: false, retryAfterSeconds: 120 })
    advance(30_000)
    expect(b.allow()).toEqual({ allowed: false, retryAfterSeconds: 90 })
    advance(90_000)
    expect(b.allow()).toEqual({ allowed: true })
    expect(b.current).toBe("half-open")
  })

  it("nửa mở: chỉ MỘT lượt thăm dò, lượt khác bị từ chối cho tới khi có kết quả", () => {
    const { b, advance } = make()
    failN(b, 5)
    advance(120_000)
    expect(b.allow().allowed).toBe(true)
    expect(b.allow().allowed).toBe(false)
    expect(b.allow().allowed).toBe(false)
  })

  it("thăm dò thành công thì đóng, đếm lỗi làm lại từ đầu", () => {
    const { b, advance } = make()
    failN(b, 5)
    advance(120_000)
    b.allow()
    b.success()
    expect(b.current).toBe("closed")
    failN(b, 4)
    expect(b.current).toBe("closed")
  })

  it("thăm dò thất bại thì mở lại đủ 2 phút", () => {
    const { b, advance } = make()
    failN(b, 5)
    advance(120_000)
    b.allow()
    b.failure()
    expect(b.current).toBe("open")
    expect(b.allow()).toEqual({ allowed: false, retryAfterSeconds: 120 })
  })

  it("lượt thăm dò thất lạc (không báo kết quả): sau 2 phút cho lượt khác thử", () => {
    const { b, advance } = make()
    failN(b, 5)
    advance(120_000)
    b.allow()
    advance(60_000)
    expect(b.allow().allowed).toBe(false)
    advance(60_000)
    expect(b.allow().allowed).toBe(true)
  })

  it("một lần thành công xen giữa xoá chuỗi lỗi (chỉ tính lỗi LIÊN TIẾP)", () => {
    const { b } = make()
    failN(b, 4)
    b.success()
    failN(b, 4)
    expect(b.current).toBe("closed")
  })

  it("lỗi cách nhau quá 1 phút không cộng dồn", () => {
    const { b, advance } = make()
    failN(b, 3)
    advance(61_000)
    failN(b, 4)
    expect(b.current).toBe("closed")
    b.failure()
    expect(b.current).toBe("open")
  })

  it("báo đổi trạng thái đúng thứ tự: open → half-open → closed", () => {
    const { b, states, advance } = make()
    failN(b, 5)
    advance(120_000)
    b.allow()
    b.success()
    expect(states).toEqual(["open", "half-open", "closed"])
  })

  it("ngưỡng tuỳ chỉnh", () => {
    const { b } = make({ threshold: 2 })
    failN(b, 2)
    expect(b.current).toBe("open")
  })
})

describe("getBreaker", () => {
  it("cùng tên cùng một breaker; resetBreakers xoá trạng thái", () => {
    resetBreakers()
    const a = getBreaker("chat")
    expect(getBreaker("chat")).toBe(a)
    expect(getBreaker("embedding")).not.toBe(a)
    resetBreakers()
    expect(getBreaker("chat")).not.toBe(a)
  })
})
