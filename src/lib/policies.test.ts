import { describe, expect, it } from "vitest"
import { formatVnd } from "@/lib/format"
import { PAYMENT_WINDOW_MINUTES } from "@/lib/order"
import { getPolicy, POLICIES } from "@/lib/policies"
import { FLAT_SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping"

describe("policies", () => {
  it("slug không trùng và đều tra được", () => {
    const slugs = POLICIES.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(getPolicy(s)?.slug).toBe(s)
    expect(getPolicy("khong-co")).toBeUndefined()
  })

  it("chính sách vận chuyển lấy đúng ngưỡng và phí từ hằng số, không ghi cứng", () => {
    const text = getPolicy("van-chuyen")!.sections.flatMap((s) => s.body).join(" ")
    expect(text).toContain(formatVnd(FREE_SHIPPING_THRESHOLD))
    expect(text).toContain(formatVnd(FLAT_SHIPPING_FEE))
  })

  it("chính sách thanh toán nêu đúng hạn thanh toán VNPay", () => {
    const text = getPolicy("thanh-toan")!.sections.flatMap((s) => s.body).join(" ")
    expect(text).toContain(`${PAYMENT_WINDOW_MINUTES} phút`)
  })

  it("đổi trả và bảo mật được đánh dấu đang cập nhật (chưa có nội dung từ cửa hàng)", () => {
    expect(getPolicy("doi-tra")!.pending).toBe(true)
    expect(getPolicy("bao-mat")!.pending).toBe(true)
  })
})
