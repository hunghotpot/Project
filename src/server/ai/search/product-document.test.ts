import { describe, expect, it } from "vitest"
import { buildProductDocument, type ProductDocumentInput } from "./product-document"

// Ví dụ 1 trong docs/ai/01-data-for-ai.md mục 2 (ao-so-mi-lua-satin-nu).
const SATIN: ProductDocumentInput = {
  name: "Áo sơ mi lụa satin nữ",
  categoryName: "Áo sơ mi nữ",
  brand: "Nhà Tằm",
  gender: "WOMEN",
  material: "Satin lụa",
  style: "elegant",
  occasion: ["dự tiệc", "đi làm", "hẹn hò"],
  season: ["xuân", "thu", "đông"],
  tags: ["satin", "bóng mờ", "sang trọng", "nữ"],
  description: "Sơ mi satin mềm rủ ánh bóng mờ.",
  colors: ["Kem", "Đen", "Đỏ đô", "Đen", "Kem"],
}

describe("buildProductDocument", () => {
  it("đúng template trong tài liệu, màu bỏ trùng và xếp theo bảng chữ cái tiếng Việt", () => {
    expect(buildProductDocument(SATIN)).toBe(
      [
        "Áo sơ mi lụa satin nữ.",
        "Loại: Áo sơ mi nữ. Thương hiệu: Nhà Tằm. Giới tính: Nữ.",
        "Chất liệu: Satin lụa. Phong cách: Thanh lịch (elegant).",
        "Dịp mặc: dự tiệc, đi làm, hẹn hò. Mùa: xuân, thu, đông.",
        "Màu sắc: Đen, Đỏ đô, Kem.",
        "Từ khoá: satin, bóng mờ, sang trọng, nữ.",
        "Mô tả: Sơ mi satin mềm rủ ánh bóng mờ.",
      ].join("\n"),
    )
  })

  it("ổn định: không phụ thuộc thứ tự màu đầu vào", () => {
    const a = buildProductDocument({ ...SATIN, colors: ["Kem", "Đen", "Đỏ đô"] })
    const b = buildProductDocument({ ...SATIN, colors: ["Đỏ đô", "Kem", "Đen"] })
    expect(a).toBe(b)
  })

  it("nhãn giới tính: Unisex kèm giải thích, Nam", () => {
    expect(buildProductDocument({ ...SATIN, gender: "UNISEX" })).toContain("Giới tính: Unisex (nam và nữ đều mặc được).")
    expect(buildProductDocument({ ...SATIN, gender: "MEN" })).toContain("Giới tính: Nam.")
  })

  it("style lạ (không có nhãn) giữ nguyên token", () => {
    expect(buildProductDocument({ ...SATIN, style: "punk" })).toContain("Phong cách: punk.")
  })

  it("gọn khoảng trắng thừa và xuống dòng trong mô tả", () => {
    const doc = buildProductDocument({ ...SATIN, name: "  Áo   thun ", description: "Dòng một.\n\n  Dòng   hai. " })
    expect(doc.startsWith("Áo thun.")).toBe(true)
    expect(doc.endsWith("Mô tả: Dòng một. Dòng hai.")).toBe(true)
  })

  it("không chứa giá, tồn kho hay mã", () => {
    const doc = buildProductDocument(SATIN)
    expect(doc).not.toMatch(/\d{4,}/)
  })
})
