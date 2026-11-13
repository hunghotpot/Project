import { describe, expect, it } from "vitest"
import { sizeMatches } from "./size-match"

describe("sizeMatches", () => {
  it("khớp chính xác, không phân biệt hoa thường", () => {
    expect(sizeMatches("M", "m")).toBe(true)
    expect(sizeMatches("XL", "xl")).toBe(true)
    expect(sizeMatches("28", "28")).toBe(true)
  })

  it("'Free' và 'freesize' khớp 'Free size' (lỗi thật: mũ bucket Free size bị báo không có size Free)", () => {
    for (const asked of ["Free", "free", "free size", "Free size", "freesize", "FREE SIZE"]) {
      expect(sizeMatches("Free size", asked), asked).toBe(true)
    }
    expect(sizeMatches("Free", "free size")).toBe(true)
  })

  it("không khớp nhầm size khác", () => {
    expect(sizeMatches("L", "XL")).toBe(false)
    expect(sizeMatches("XL", "L")).toBe(false)
    expect(sizeMatches("S", "XS")).toBe(false)
    expect(sizeMatches("M", "L")).toBe(false)
    expect(sizeMatches("28", "128")).toBe(false)
    expect(sizeMatches("Free size", "M")).toBe(false)
    expect(sizeMatches("M", "Free")).toBe(false)
  })

  it("không có size cần so thì khớp mọi biến thể", () => {
    expect(sizeMatches("M", "")).toBe(true)
    expect(sizeMatches("M", "  ")).toBe(true)
  })
})
