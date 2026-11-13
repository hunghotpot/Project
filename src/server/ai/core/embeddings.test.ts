import { describe, expect, it } from "vitest"
import { assertDimensions, hashContent } from "./embeddings"

describe("hashContent", () => {
  it("ổn định: cùng đầu vào cho cùng hash (sha256 hex 64 ký tự)", () => {
    const h = hashContent("Áo thun nam", "bge-m3", 1)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashContent("Áo thun nam", "bge-m3", 1)).toBe(h)
  })

  it("đổi nội dung, model hoặc templateVersion thì hash đổi", () => {
    const base = hashContent("Áo thun nam", "bge-m3", 1)
    expect(hashContent("Áo thun nữ", "bge-m3", 1)).not.toBe(base)
    expect(hashContent("Áo thun nam", "other-model", 1)).not.toBe(base)
    expect(hashContent("Áo thun nam", "bge-m3", 2)).not.toBe(base)
  })
})

describe("assertDimensions", () => {
  it("chấp nhận khi mọi vector đúng số chiều, kể cả danh sách rỗng", () => {
    expect(() => assertDimensions([[1, 2, 3], [4, 5, 6]], 3)).not.toThrow()
    expect(() => assertDimensions([], 1024)).not.toThrow()
  })

  it("ném lỗi nêu rõ vị trí và số chiều khi sai", () => {
    expect(() => assertDimensions([[1, 2, 3], [1, 2]], 3)).toThrow(/thứ 1 có 2 chiều.*là 3/)
  })

  it("vector rỗng bị coi là sai", () => {
    expect(() => assertDimensions([[]], 1024)).toThrow()
  })
})
