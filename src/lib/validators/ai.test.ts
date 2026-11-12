import { describe, expect, it } from "vitest"
import { sizeAdviceInputSchema } from "@/lib/validators/ai"

describe("sizeAdviceInputSchema", () => {
  it("chỉ cần productSlug; fit mặc định regular", () => {
    const r = sizeAdviceInputSchema.parse({ productSlug: "ao-so-mi-poplin-cong-so" })
    expect(r.fit).toBe("regular")
    expect(r.heightCm).toBeUndefined()
  })

  it("nhận số đo hợp lệ", () => {
    const r = sizeAdviceInputSchema.parse({ productSlug: "x", heightCm: 170, weightKg: 66, fit: "tight" })
    expect(r).toMatchObject({ heightCm: 170, weightKg: 66, fit: "tight" })
  })

  it.each([
    ["thiếu slug", {}],
    ["slug rỗng", { productSlug: "  " }],
    ["chiều cao quá thấp", { productSlug: "x", heightCm: 50 }],
    ["cân nặng quá cao", { productSlug: "x", weightKg: 400 }],
    ["số đo là chuỗi", { productSlug: "x", heightCm: "170" }],
    ["fit lạ", { productSlug: "x", fit: "super-tight" }],
  ])("từ chối: %s", (_name, input) => {
    expect(sizeAdviceInputSchema.safeParse(input).success).toBe(false)
  })
})
