import { describe, expect, it } from "vitest"
import { customerTier, VIP_SPEND_THRESHOLD } from "./customer-tier"

describe("customerTier", () => {
  it("dưới ngưỡng là MEMBER", () => {
    expect(customerTier(0)).toBe("MEMBER")
    expect(customerTier(VIP_SPEND_THRESHOLD - 1)).toBe("MEMBER")
  })
  it("đúng ngưỡng trở lên là VIP", () => {
    expect(customerTier(VIP_SPEND_THRESHOLD)).toBe("VIP")
    expect(customerTier(VIP_SPEND_THRESHOLD * 3)).toBe("VIP")
  })
})
