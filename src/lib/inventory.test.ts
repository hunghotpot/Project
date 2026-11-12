import { describe, expect, it } from "vitest"
import { LOW_STOCK_THRESHOLD, stockStatus } from "@/lib/inventory"

describe("stockStatus", () => {
  it("phân loại theo ngưỡng", () => {
    expect(stockStatus(0)).toBe("OUT")
    expect(stockStatus(-1)).toBe("OUT")
    expect(stockStatus(1)).toBe("LOW")
    expect(stockStatus(LOW_STOCK_THRESHOLD)).toBe("LOW")
    expect(stockStatus(LOW_STOCK_THRESHOLD + 1)).toBe("IN_STOCK")
  })

  it("nhận ngưỡng tuỳ chỉnh", () => {
    expect(stockStatus(20, 25)).toBe("LOW")
    expect(stockStatus(26, 25)).toBe("IN_STOCK")
  })
})
