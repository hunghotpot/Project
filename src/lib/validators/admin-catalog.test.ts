import { describe, expect, it } from "vitest"
import { buildProducts } from "../../../prisma/seed-data/build"
import {
  ADMIN_STYLES,
  adjustStockSchema,
  adminProductFilterSchema,
  buildVariantSku,
  createCategorySchema,
  createProductSchema,
  replaceSizeChartSchema,
  slugify,
  updateProductSchema,
} from "./admin-catalog"

const variant = { size: "M", color: "Đen", colorHex: "#111111", stock: 5 }
const validProduct = {
  name: "Áo thun basic",
  skuPrefix: "tee-001",
  description: "Mô tả",
  brand: "Test",
  material: "Cotton 100%",
  style: "casual",
  occasion: ["đi làm"],
  season: ["hè"],
  gender: "UNISEX",
  basePrice: 199_000,
  categoryId: "cat1",
  variants: [variant],
}

const issues = (input: unknown, schema = createProductSchema) => {
  const r = schema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe("slugify / buildVariantSku", () => {
  it("bỏ dấu, đ → d, gom ký tự lạ", () => {
    expect(slugify("Áo thun Nam #1 — Đen")).toBe("ao-thun-nam-1-den")
    expect(slugify("Đầm Dạ Hội")).toBe("dam-da-hoi")
    expect(slugify("!!!")).toBe("")
  })

  it("sinh SKU biến thể từ tiền tố, màu, size", () => {
    expect(buildVariantSku("tee-001", "Xanh navy", "M")).toBe("TEE-001-XANH-NAVY-M")
    expect(buildVariantSku("TEE", "Đen", "Free size")).toBe("TEE-DEN-FREE-SIZE")
  })
})

describe("danh sách lựa chọn đóng", () => {
  it("mọi style trong seed nằm trong ADMIN_STYLES", () => {
    const allowed = new Set(ADMIN_STYLES)
    const outside = [...new Set(buildProducts().map((p) => p.style))].filter((s) => !allowed.has(s))
    expect(outside).toEqual([])
  })

  it("từ chối occasion / season / gender / style ngoài danh sách", () => {
    expect(createProductSchema.safeParse(validProduct).success).toBe(true)
    expect(createProductSchema.safeParse({ ...validProduct, occasion: ["đi bar"] }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, season: ["mưa"] }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, gender: "KIDS" }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, style: "punk" }).success).toBe(false)
  })
})

describe("createProductSchema / updateProductSchema", () => {
  it("điền mặc định: isActive = true, tags/ảnh rỗng, tag chuẩn hoá", () => {
    const r = createProductSchema.parse({ ...validProduct, tags: [" Basic ", "basic", "Tối giản"] })
    expect(r.isActive).toBe(true)
    expect(r.images).toEqual([])
    expect(r.tags).toEqual(["basic", "tối giản"])
  })

  it("tối đa 4 ảnh; ảnh chỉ nhận URL http(s) hoặc đường dẫn bắt đầu bằng /", () => {
    const img = (url: string) => ({ url })
    const ok = [img("/uploads/a.jpg"), img("https://cdn.test/b.jpg")]
    expect(createProductSchema.safeParse({ ...validProduct, images: ok }).success).toBe(true)
    expect(createProductSchema.safeParse({ ...validProduct, images: Array(5).fill(img("/a.jpg")) }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, images: [img("javascript:alert(1)")] }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, images: [img("//evil.test/x.jpg")] }).success).toBe(false)
  })

  it("biến thể: trùng (size, màu), trùng SKU, cùng màu khác mã màu", () => {
    expect(issues({ ...validProduct, variants: [variant, { ...variant, color: "đen" }] })[0]).toMatch(/Trùng biến thể/)
    expect(issues({ ...validProduct, variants: [{ ...variant, sku: "A-1" }, { ...variant, size: "L", sku: "a-1" }] })[0]).toMatch(/Trùng SKU/)
    expect(issues({ ...validProduct, variants: [variant, { ...variant, size: "L", colorHex: "#222222" }] })[0]).toMatch(/hai mã màu/)
  })

  it("cần SKU riêng hoặc mã SKU chung", () => {
    const { skuPrefix: _omit, ...noPrefix } = validProduct
    void _omit
    expect(issues(noPrefix)[0]).toMatch(/SKU/)
    expect(issues({ ...noPrefix, variants: [{ ...variant, sku: "abc-1" }] })).toEqual([])
  })

  it("tiền / tồn kho: số nguyên không âm", () => {
    expect(createProductSchema.safeParse({ ...validProduct, basePrice: -1 }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, basePrice: 10.5 }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, variants: [{ ...variant, stock: -1 }] }).success).toBe(false)
    expect(createProductSchema.safeParse({ ...validProduct, variants: [] }).success).toBe(false)
  })

  it("update nhận id biến thể và chặn id lặp; create bỏ qua id", () => {
    const v = { ...variant, id: "v1" }
    expect(updateProductSchema.safeParse({ ...validProduct, variants: [v] }).success).toBe(true)
    expect(issues({ ...validProduct, variants: [v, { ...v, size: "L" }] }, updateProductSchema as never)[0]).toMatch(/lặp/)
    const created = createProductSchema.parse({ ...validProduct, variants: [v] })
    expect("id" in created.variants[0]).toBe(false)
  })
})

describe("adjustStockSchema", () => {
  it("đúng một trong delta / newStock", () => {
    expect(adjustStockSchema.safeParse({ delta: 5 }).success).toBe(true)
    expect(adjustStockSchema.safeParse({ delta: -3 }).success).toBe(true)
    expect(adjustStockSchema.safeParse({ newStock: 0 }).success).toBe(true)
    expect(adjustStockSchema.safeParse({}).success).toBe(false)
    expect(adjustStockSchema.safeParse({ delta: 1, newStock: 1 }).success).toBe(false)
    expect(adjustStockSchema.safeParse({ delta: 0 }).success).toBe(false)
    expect(adjustStockSchema.safeParse({ newStock: -1 }).success).toBe(false)
    expect(adjustStockSchema.safeParse({ delta: 1.5 }).success).toBe(false)
  })
})

describe("adminProductFilterSchema (lỏng với URL)", () => {
  it("giá trị sai rơi về mặc định", () => {
    const f = adminProductFilterSchema.parse({ stockStatus: "xyz", isActive: "maybe", page: "-3", pageSize: "9999", q: "  áo  " })
    expect(f).toMatchObject({ stockStatus: undefined, isActive: undefined, page: 1, pageSize: 10, q: "áo" })
  })

  it("nhận giá trị hợp lệ dạng chuỗi", () => {
    const f = adminProductFilterSchema.parse({ stockStatus: "low", isActive: "false", page: "2", pageSize: "20", categorySlug: "nam" })
    expect(f).toMatchObject({ stockStatus: "LOW", isActive: false, page: 2, pageSize: 20, categorySlug: "nam" })
  })
})

describe("createCategorySchema", () => {
  it("parentId rỗng → null, mô tả rỗng → null", () => {
    expect(createCategorySchema.parse({ name: "Giày" })).toEqual({ name: "Giày", description: null, parentId: null })
  })
})

describe("replaceSizeChartSchema", () => {
  const row = { size: "M", chest: 96, waist: 80, hip: 98, heightMin: 165, heightMax: 172, weightMin: 58, weightMax: 68 }

  it("hợp lệ; chest có thể bỏ trống (quần)", () => {
    const r = replaceSizeChartSchema.parse([row, { ...row, size: "L", chest: undefined }])
    expect(r[1].chest).toBeNull()
  })

  it("min > max bị từ chối", () => {
    expect(replaceSizeChartSchema.safeParse([{ ...row, heightMin: 180 }]).success).toBe(false)
    expect(replaceSizeChartSchema.safeParse([{ ...row, weightMin: 90 }]).success).toBe(false)
  })

  it("size trùng (không phân biệt hoa thường) và số đo phi lý bị từ chối", () => {
    expect(replaceSizeChartSchema.safeParse([row, { ...row, size: "m" }]).success).toBe(false)
    expect(replaceSizeChartSchema.safeParse([{ ...row, waist: 5 }]).success).toBe(false)
    expect(replaceSizeChartSchema.safeParse([]).success).toBe(false)
  })
})
