import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory"
import type { CreateProductInput } from "@/lib/validators/admin-catalog"
import { db } from "@/server/db"
import { createFixtures } from "@/test/db-fixtures"
import { AdminCatalogError } from "./admin-catalog.service"
import { createCategory, deleteCategory, listCategoriesTree, updateCategory } from "./admin-category.service"
import {
  adjustStock,
  createProduct,
  deleteProduct,
  getAdminProduct,
  getInventorySummary,
  listAdminProducts,
  listLowStockVariants,
  setProductActive,
  updateProduct,
} from "./admin-product.service"
import { deleteSizeChartRows, listSizeChart, replaceSizeChart } from "./admin-size-chart.service"
import { syncProductEmbedding } from "./product-hooks"

/*
 * Test tích hợp trên PostgreSQL thật (cần `npm run db:up`): service Admin về sản phẩm / tồn kho / danh mục / bảng size.
 * Mọi bản ghi mang tiền tố RUN (tên, slug, SKU) và được dọn khi xong. Không chạy song song với test tích hợp khác.
 */

vi.mock("./product-hooks", () => ({ syncProductEmbedding: vi.fn(async () => {}) }))
const hook = vi.mocked(syncProductEmbedding)

const RUN = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const PREFIX = RUN.toUpperCase()
const admin = { userId: "test-admin" }
const fx = createFixtures()

let rootId = "" // danh mục gốc dùng chung
let leafId = "" // danh mục con của rootId, nơi đặt sản phẩm
let n = 0

const form = (over: Record<string, unknown> = {}): CreateProductInput => {
  const i = ++n
  return {
    name: `${RUN} Áo thun ${i}`,
    skuPrefix: `${PREFIX}-${i}`,
    description: "Mô tả thử",
    brand: "Test",
    material: "Cotton 100%",
    style: "casual",
    occasion: ["đi làm"],
    season: ["hè"],
    gender: "UNISEX",
    tags: ["basic"],
    basePrice: 200_000,
    categoryId: leafId,
    images: [{ url: "/uploads/a.jpg" }],
    variants: [
      { size: "M", color: "Đen", colorHex: "#111111", stock: 20 },
      { size: "L", color: "Đen", colorHex: "#111111", stock: 5 },
      { size: "M", color: "Trắng", colorHex: "#FFFFFF", stock: 0 },
    ],
    ...over,
  } as CreateProductInput
}

const failCode = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(AdminCatalogError)
    return (e as AdminCatalogError).code
  }
  throw new Error("Đáng lẽ phải lỗi")
}

beforeAll(async () => {
  const root = await createCategory(admin, { name: `Gốc ${RUN}` })
  rootId = root.id
  leafId = (await createCategory(admin, { name: `Lá ${RUN}`, parentId: rootId })).id
})

beforeEach(() => hook.mockClear())

afterAll(async () => {
  const ids = [rootId, leafId]
  await db.product.deleteMany({ where: { categoryId: { in: ids } } })
  await db.category.deleteMany({ where: { id: leafId } })
  await db.category.deleteMany({ where: { id: rootId } })
  await db.category.deleteMany({ where: { slug: { contains: RUN } } }).catch(() => {})
  await fx.cleanup()
})

describe("tạo sản phẩm", () => {
  it("tạo đủ thông tin, SKU sinh từ tiền tố, slug từ tên, gọi hook một lần", async () => {
    const input = form({ images: [{ url: "/uploads/a.jpg" }, { url: "https://cdn.test/b.jpg", alt: "Mặt sau" }] })
    const p = await createProduct(admin, input)
    expect(p.slug).toBe(`${RUN}-ao-thun-${n}`)
    expect(p.isActive).toBe(true)
    expect(p.variants).toHaveLength(3)
    expect(p.variants.map((v) => v.sku)).toContain(`${input.skuPrefix}-DEN-M`)
    expect(p.variants.every((v) => v.price === 200_000)).toBe(true) // giá biến thể mặc định = giá bán
    expect(p.images.map((i) => [i.position, i.alt])).toEqual([[0, input.name], [1, "Mặt sau"]])
    expect(p.totalStock).toBe(25)
    expect(p.status).toBe("IN_STOCK")
    expect(p.hasOrders).toBe(false)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(p.id)
  })

  it("trùng tên → slug thêm hậu tố -2", async () => {
    const a = await createProduct(admin, form({ name: `${RUN} Trùng tên` }))
    const b = await createProduct(admin, form({ name: `${RUN} Trùng tên` }))
    expect(b.slug).toBe(`${a.slug}-2`)
  })

  it("slug nhập tay bị trùng → DUPLICATE_SLUG", async () => {
    const a = await createProduct(admin, form())
    expect(await failCode(createProduct(admin, form({ slug: a.slug })))).toBe("DUPLICATE_SLUG")
  })

  it("SKU trùng toàn hệ thống → DUPLICATE_SKU, không tạo gì và không gọi hook", async () => {
    const a = await createProduct(admin, form())
    const dup = form({ name: `${RUN} Có SKU trùng`, skuPrefix: undefined, variants: [{ sku: a.variants[0].sku, size: "S", color: "Đỏ", colorHex: "#C0392B", stock: 1 }] })
    hook.mockClear()
    expect(await failCode(createProduct(admin, dup))).toBe("DUPLICATE_SKU")
    expect(await db.product.count({ where: { name: dup.name } })).toBe(0)
    expect(hook).not.toHaveBeenCalled()
  })

  it("danh mục không tồn tại / dữ liệu sai → mã lỗi rõ ràng", async () => {
    expect(await failCode(createProduct(admin, form({ categoryId: "khong-co" })))).toBe("CATEGORY_NOT_FOUND")
    expect(await failCode(createProduct(admin, form({ occasion: ["đi bar"] })))).toBe("INVALID_INPUT")
  })

  it("hook ném lỗi không làm hỏng thao tác chính", async () => {
    hook.mockRejectedValueOnce(new Error("embed down"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const p = await createProduct(admin, form())
    expect(await getAdminProduct(p.id)).not.toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe("danh sách, tổng quan, cảnh báo", () => {
  let a: Awaited<ReturnType<typeof createProduct>>
  let b: Awaited<ReturnType<typeof createProduct>>
  let c: Awaited<ReturnType<typeof createProduct>>
  const base = () => ({ categoryId: leafId })

  beforeAll(async () => {
    // a: còn hàng (tổng 25); b: sắp hết (tổng 3, ẩn); c: hết hàng (tổng 0)
    a = await createProduct(admin, form({ name: `${RUN} Zeta Phối`, tags: ["tối giản"] }))
    b = await createProduct(admin, form({ name: `${RUN} Beta`, isActive: false, variants: [{ size: "S", color: "Be", colorHex: "#D8C3A5", stock: 3 }] }))
    c = await createProduct(admin, form({ name: `${RUN} Gamma`, variants: [{ size: "S", color: "Be", colorHex: "#D8C3A5", stock: 0 }] }))
  })

  const ids = async (f: Record<string, unknown>) => (await listAdminProducts({ ...base(), ...f })).items.map((i) => i.id).sort()

  it("lọc theo danh mục: id, slug; danh mục gốc gồm cả con", async () => {
    const all = [a.id, b.id, c.id]
    expect(await ids({ pageSize: 50 })).toEqual(expect.arrayContaining(all))
    const root = await db.category.findUniqueOrThrow({ where: { id: rootId } })
    const viaRoot = await listAdminProducts({ categorySlug: root.slug, pageSize: 50 })
    expect(viaRoot.items.map((i) => i.id)).toEqual(expect.arrayContaining(all))
    expect((await listAdminProducts({ categorySlug: "khong-ton-tai" })).total).toBe(0)
  })

  it("DTO: tổng tồn, trạng thái, gom theo màu và size, ảnh đầu, SKU", async () => {
    const item = (await listAdminProducts({ ...base(), q: `${RUN} Zeta` })).items[0]
    expect(item.id).toBe(a.id)
    expect(item.totalStock).toBe(25)
    expect(item.status).toBe("IN_STOCK")
    expect(item.image?.url).toBe("/uploads/a.jpg")
    expect(item.category.id).toBe(leafId)
    expect(item.colors.map((x) => [x.color, x.totalStock, x.sizes.map((s) => `${s.size}:${s.stock}:${s.status}`)])).toEqual([
      ["Đen", 25, ["M:20:IN_STOCK", "L:5:LOW"]],
      ["Trắng", 0, ["M:0:OUT"]],
    ])
    expect(item.skus).toHaveLength(3)
  })

  it("tìm theo tên không dấu, SKU, tag", async () => {
    expect(await ids({ q: `${RUN} zeta phoi` })).toEqual([a.id])
    expect(await ids({ q: a.variants[0].sku.toLowerCase() })).toEqual([a.id])
    expect(await ids({ q: `${RUN} toi gian` })).toEqual([a.id]) // "tối giản" là tag của a; mỗi từ phải khớp
    expect(await ids({ q: `${RUN} khong-co-tag` })).toEqual([])
  })

  it("lọc theo trạng thái tồn và hiển thị", async () => {
    expect(await ids({ stockStatus: "LOW" })).toEqual([b.id])
    expect(await ids({ stockStatus: "OUT" })).toEqual([c.id])
    expect(await ids({ stockStatus: "IN_STOCK", pageSize: 50 })).toContain(a.id)
    expect(await ids({ isActive: "false", pageSize: 50 })).toEqual([b.id])
    expect(await ids({ stockStatus: "OUT", isActive: "false" })).toEqual([])
  })

  it("phân trang", async () => {
    const p1 = await listAdminProducts({ ...base(), pageSize: 2, page: 1 })
    const p2 = await listAdminProducts({ ...base(), pageSize: 2, page: 2 })
    expect(p1.items).toHaveLength(2)
    expect(p1.total).toBeGreaterThanOrEqual(3)
    expect(p1.pageCount).toBe(Math.ceil(p1.total / 2))
    expect(p2.items.map((i) => i.id)).not.toEqual(expect.arrayContaining(p1.items.map((i) => i.id)))
  })

  it("getInventorySummary tăng đúng theo sản phẩm mới", async () => {
    const before = await getInventorySummary()
    const p = await createProduct(
      admin,
      form({
        basePrice: 100_000,
        variants: [
          { size: "S", color: "Đỏ", colorHex: "#C0392B", stock: 4, price: 150_000 }, // sắp hết
          { size: "M", color: "Đỏ", colorHex: "#C0392B", stock: 0, price: 150_000 }, // hết
          { size: "L", color: "Đỏ", colorHex: "#C0392B", stock: 30, price: 100_000 },
        ],
      })
    )
    const after = await getInventorySummary()
    expect(after.productCount).toBe(before.productCount + 1)
    expect(after.totalStock - before.totalStock).toBe(34)
    expect(after.inventoryValue - before.inventoryValue).toBe(4 * 150_000 + 30 * 100_000)
    expect(after.lowStockVariants - before.lowStockVariants).toBe(1)
    expect(after.outOfStockVariants - before.outOfStockVariants).toBe(1)
    expect(after.lowStockProducts).toBe(before.lowStockProducts) // tổng 34 > ngưỡng
    expect(p.totalStock).toBe(34)
  })

  it("listLowStockVariants: gom theo màu, chỉ sản phẩm đang hiển thị", async () => {
    // Giới hạn theo id: DB seed có hàng trăm biến thể sắp hết/hết hàng, sẽ đẩy dữ liệu test ra khỏi top 100.
    const entries = await listLowStockVariants(100, { productIds: [a.id, b.id, c.id] })
    expect(entries.map((e) => e.productId)).toContain(c.id)
    expect(entries.some((e) => e.productId === b.id)).toBe(false) // b đang ẩn
    const aBlack = entries.find((e) => e.productId === a.id && e.color === "Đen")
    expect(aBlack?.sizes.map((s) => [s.size, s.stock, s.status])).toEqual([["L", 5, "LOW"]])
    const aWhite = entries.find((e) => e.productId === a.id && e.color === "Trắng")
    expect(aWhite?.sizes[0]).toMatchObject({ size: "M", stock: 0, status: "OUT" })
    expect((await listLowStockVariants(1, { productIds: [a.id, b.id, c.id] })).length).toBe(1)
  })

  it("ngưỡng cảnh báo dùng LOW_STOCK_THRESHOLD", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(10)
  })
})

describe("sửa sản phẩm", () => {
  it("sửa thông tin, thêm/sửa/xoá biến thể và thay ảnh trong một lần", async () => {
    const p = await createProduct(admin, form())
    const keep = p.variants.find((v) => v.color === "Đen" && v.size === "M")!
    const drop = p.variants.find((v) => v.color === "Trắng")!
    hook.mockClear()

    const updated = await updateProduct(admin, p.id, {
      ...form({ name: `${p.name} (mới)`, basePrice: 250_000, isActive: false, tags: ["sale"], images: [{ url: "/uploads/new.jpg" }] }),
      skuPrefix: undefined,
      variants: [
        { id: keep.id, sku: keep.sku, size: "M", color: "Đen", colorHex: "#111111", price: 260_000, stock: 7 },
        { size: "XL", color: "Đen", colorHex: "#111111", sku: `${PREFIX}-NEW-XL`, stock: 9 },
      ],
    })

    expect(updated.slug).toBe(p.slug) // slug giữ nguyên khi đổi tên
    expect(updated.name).toBe(`${p.name} (mới)`)
    expect(updated.isActive).toBe(false)
    expect(updated.tags).toEqual(["sale"])
    expect(updated.images.map((i) => i.url)).toEqual(["/uploads/new.jpg"])
    expect(updated.variants.map((v) => [v.id === keep.id, v.size, v.price, v.stock].join("/")).sort()).toEqual(["false/XL/250000/9", "true/M/260000/7"])
    expect(updated.variants.some((v) => v.id === drop.id)).toBe(false)
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it("lỗi giữa chừng thì rollback toàn bộ (SKU trùng sản phẩm khác)", async () => {
    const other = await createProduct(admin, form())
    const p = await createProduct(admin, form())
    const v = p.variants[0]
    const code = await failCode(
      updateProduct(admin, p.id, {
        ...form({ name: "Tên không được lưu" }),
        skuPrefix: undefined,
        variants: [{ id: v.id, sku: other.variants[0].sku, size: v.size, color: v.color, colorHex: v.colorHex, stock: 1 }],
      })
    )
    expect(code).toBe("DUPLICATE_SKU")
    const after = (await getAdminProduct(p.id))!
    expect(after.name).toBe(p.name)
    expect(after.variants).toHaveLength(3) // biến thể bị loại khỏi form chưa bị xoá
  })

  it("biến thể không thuộc sản phẩm / sản phẩm không tồn tại", async () => {
    const p = await createProduct(admin, form())
    const foreign = (await createProduct(admin, form())).variants[0]
    const body = (id: string) => ({
      ...form(),
      skuPrefix: undefined,
      variants: [{ id, sku: `${PREFIX}-ZZ-1`, size: "M", color: "Đen", colorHex: "#111111", stock: 1 }],
    })
    expect(await failCode(updateProduct(admin, p.id, body(foreign.id)))).toBe("VARIANT_NOT_FOUND")
    expect(await failCode(updateProduct(admin, "khong-co", body("x")))).toBe("PRODUCT_NOT_FOUND")
  })
})

describe("ẩn / xoá sản phẩm", () => {
  it("setProductActive bật/tắt và gọi hook", async () => {
    const p = await createProduct(admin, form())
    hook.mockClear()
    await setProductActive(admin, p.id, false)
    expect((await getAdminProduct(p.id))!.isActive).toBe(false)
    expect(hook).toHaveBeenCalledWith(p.id)
    await setProductActive(admin, p.id, true)
    expect((await getAdminProduct(p.id))!.isActive).toBe(true)
    expect(await failCode(setProductActive(admin, "khong-co", true))).toBe("PRODUCT_NOT_FOUND")
  })

  it("xoá sản phẩm chưa có đơn: xoá cả biến thể, ảnh", async () => {
    const p = await createProduct(admin, form())
    hook.mockClear()
    await deleteProduct(admin, p.id)
    expect(await getAdminProduct(p.id)).toBeNull()
    expect(await db.productVariant.count({ where: { productId: p.id } })).toBe(0)
    expect(await db.productImage.count({ where: { productId: p.id } })).toBe(0)
    expect(hook).toHaveBeenCalledWith(p.id)
    expect(await failCode(deleteProduct(admin, p.id))).toBe("PRODUCT_NOT_FOUND")
  })

  it("sản phẩm đã có đơn không xoá được, gợi ý ẩn", async () => {
    const p = await createProduct(admin, form())
    const v = p.variants[0]
    const { user } = await fx.makeBuyer([])
    await db.order.create({
      data: {
        code: `FS-${RUN}`,
        userId: user.id,
        subtotal: 200_000,
        total: 200_000,
        shippingAddress: {},
        paymentMethod: "COD",
        items: { create: { variantId: v.id, productName: p.name, sku: v.sku, size: v.size, color: v.color, unitPrice: 200_000, quantity: 1 } },
      },
    })
    hook.mockClear()
    try {
      await deleteProduct(admin, p.id)
      throw new Error("Đáng lẽ phải lỗi")
    } catch (e) {
      expect((e as AdminCatalogError).code).toBe("PRODUCT_HAS_ORDERS")
      expect((e as Error).message).toMatch(/ẩn sản phẩm/)
    }
    expect((await getAdminProduct(p.id))!.hasOrders).toBe(true)
    expect(hook).not.toHaveBeenCalled()
  })
})

describe("adjustStock", () => {
  it("cộng, trừ, đặt lại; không để âm", async () => {
    const p = await createProduct(admin, form({ variants: [{ size: "M", color: "Đen", colorHex: "#111111", stock: 10 }] }))
    const vid = p.variants[0].id
    hook.mockClear()

    expect(await adjustStock(admin, vid, { delta: 15 })).toMatchObject({ previousStock: 10, stock: 25, productId: p.id })
    expect(await adjustStock(admin, vid, { delta: -5 })).toMatchObject({ previousStock: 25, stock: 20 })
    expect(await failCode(adjustStock(admin, vid, { delta: -21 }))).toBe("NEGATIVE_STOCK")
    expect(await fx.stockOf(vid)).toBe(20)
    expect(await adjustStock(admin, vid, { newStock: 3 })).toMatchObject({ previousStock: 20, stock: 3 })
    expect(await adjustStock(admin, vid, { delta: -3 })).toMatchObject({ stock: 0 })
    expect(hook).toHaveBeenCalledTimes(4)
  })

  it("đầu vào sai / biến thể không tồn tại", async () => {
    expect(await failCode(adjustStock(admin, "khong-co", { delta: 1 }))).toBe("VARIANT_NOT_FOUND")
    expect(await failCode(adjustStock(admin, "x", { delta: 1, newStock: 1 }))).toBe("INVALID_INPUT")
    expect(await failCode(adjustStock(admin, "x", { delta: 0 }))).toBe("INVALID_INPUT")
  })

  it("nhiều lần cộng đồng thời không mất cập nhật", async () => {
    const p = await createProduct(admin, form({ variants: [{ size: "M", color: "Đen", colorHex: "#111111", stock: 0 }] }))
    const vid = p.variants[0].id
    await Promise.all(Array.from({ length: 10 }, () => adjustStock(admin, vid, { delta: 2 })))
    expect(await fx.stockOf(vid)).toBe(20)
  })
})

describe("danh mục", () => {
  it("tạo gốc/con, slug không dấu và duy nhất, cây tối đa 2 cấp", async () => {
    const a = await createCategory(admin, { name: `Đồ ${RUN} mới`, description: "  mô tả " })
    expect(a.slug).toBe(`do-${RUN}-moi`)
    expect(a.description).toBe("mô tả")
    expect(a.parentId).toBeNull()

    const dup = await createCategory(admin, { name: `Đồ ${RUN} mới` })
    expect(dup.slug).toBe(`${a.slug}-2`)

    const child = await createCategory(admin, { name: `Con ${RUN}`, parentId: a.id })
    expect(child.parentId).toBe(a.id)
    expect(await failCode(createCategory(admin, { name: `Cháu ${RUN}`, parentId: child.id }))).toBe("CATEGORY_TOO_DEEP")
    expect(await failCode(createCategory(admin, { name: `Mồ côi ${RUN}`, parentId: "khong-co" }))).toBe("CATEGORY_NOT_FOUND")

    const tree = await listCategoriesTree()
    const node = tree.find((t) => t.id === a.id)!
    expect(node.children.map((x) => x.id)).toEqual([child.id])
    expect(tree.find((t) => t.id === dup.id)?.children).toEqual([])

    await deleteCategory(admin, child.id)
    await deleteCategory(admin, dup.id)
    await deleteCategory(admin, a.id)
    expect((await listCategoriesTree()).some((t) => t.id === a.id)).toBe(false)
  })

  it("sửa tên giữ slug; chặn vòng lặp và cấp thứ 3", async () => {
    const x = await createCategory(admin, { name: `X ${RUN}` })
    const y = await createCategory(admin, { name: `Y ${RUN}`, parentId: x.id })
    const z = await createCategory(admin, { name: `Z ${RUN}` })

    const renamed = await updateCategory(admin, x.id, { name: `X2 ${RUN}`, description: "mới" })
    expect(renamed).toMatchObject({ name: `X2 ${RUN}`, slug: x.slug, description: "mới" })

    expect(await failCode(updateCategory(admin, x.id, { parentId: x.id }))).toBe("CATEGORY_CYCLE")
    expect(await failCode(updateCategory(admin, x.id, { parentId: z.id }))).toBe("CATEGORY_TOO_DEEP") // x đang có con
    expect(await failCode(updateCategory(admin, z.id, { parentId: y.id }))).toBe("CATEGORY_TOO_DEEP") // y là con
    expect((await updateCategory(admin, y.id, { parentId: null })).parentId).toBeNull() // đưa lên gốc
    expect((await updateCategory(admin, z.id, { parentId: x.id })).parentId).toBe(x.id)
    expect(await failCode(updateCategory(admin, "khong-co", { name: "Abc" }))).toBe("CATEGORY_NOT_FOUND")
    expect(await failCode(updateCategory(admin, x.id, {}))).toBe("INVALID_INPUT")

    await deleteCategory(admin, z.id)
    await deleteCategory(admin, y.id)
    await deleteCategory(admin, x.id)
  })

  it("không xoá khi còn con / còn sản phẩm (lỗi tiếng Việt, không lọt P2003)", async () => {
    expect(await failCode(deleteCategory(admin, rootId))).toBe("CATEGORY_HAS_CHILDREN")
    await createProduct(admin, form())
    try {
      await deleteCategory(admin, leafId)
      throw new Error("Đáng lẽ phải lỗi")
    } catch (e) {
      expect((e as AdminCatalogError).code).toBe("CATEGORY_HAS_PRODUCTS")
      expect((e as Error).message).toMatch(/sản phẩm/)
    }
    expect(await failCode(deleteCategory(admin, "khong-co"))).toBe("CATEGORY_NOT_FOUND")
  })
})

describe("bảng size", () => {
  const row = (size: string, over: Record<string, unknown> = {}) => ({
    size,
    chest: 96,
    waist: 80,
    hip: 98,
    heightMin: 165,
    heightMax: 172,
    weightMin: 58,
    weightMax: 68,
    ...over,
  })

  it("thay cả bảng chung, bảng brand riêng tách biệt, xoá từng dòng", async () => {
    const cat = await createCategory(admin, { name: `Size ${RUN}` })
    try {
      const general = await replaceSizeChart(admin, cat.id, [row("L"), row("S"), row("M")])
      expect(general.map((r) => r.size)).toEqual(["S", "M", "L"])
      expect(general.every((r) => r.brand === null)).toBe(true)

      const branded = await replaceSizeChart(admin, cat.id, [row("M", { chest: 100 })], "  Acme ")
      expect(branded).toHaveLength(1)
      expect(branded[0].brand).toBe("Acme")

      // thay lại bảng chung không đụng bảng brand
      await replaceSizeChart(admin, cat.id, [row("XL", { chest: undefined })])
      const all = await listSizeChart(cat.id)
      expect(all.map((r) => `${r.brand ?? "-"}:${r.size}`)).toEqual(["-:XL", "Acme:M"])
      expect(all[0].chest).toBeNull()

      expect(await deleteSizeChartRows(admin, cat.id, [all[1].id])).toBe(1)
      expect((await listSizeChart(cat.id)).map((r) => r.size)).toEqual(["XL"])
      expect(await failCode(deleteSizeChartRows(admin, cat.id, [all[0].id, "khong-co"]))).toBe("SIZE_CHART_ROW_NOT_FOUND")
      expect((await listSizeChart(cat.id)).length).toBe(1) // rollback: dòng hợp lệ chưa bị xoá
    } finally {
      await db.sizeChart.deleteMany({ where: { categoryId: cat.id } })
      await deleteCategory(admin, cat.id)
    }
  })

  it("số đo sai bị từ chối và không đổi bảng cũ; danh mục không tồn tại", async () => {
    const cat = await createCategory(admin, { name: `Size2 ${RUN}` })
    try {
      await replaceSizeChart(admin, cat.id, [row("M")])
      expect(await failCode(replaceSizeChart(admin, cat.id, [row("M", { heightMin: 190 })]))).toBe("INVALID_INPUT")
      expect(await failCode(replaceSizeChart(admin, cat.id, [row("M"), row("m")]))).toBe("INVALID_INPUT")
      expect((await listSizeChart(cat.id)).map((r) => [r.size, r.heightMin])).toEqual([["M", 165]])
      expect(await failCode(replaceSizeChart(admin, "khong-co", [row("M")]))).toBe("CATEGORY_NOT_FOUND")
    } finally {
      await db.sizeChart.deleteMany({ where: { categoryId: cat.id } })
      await deleteCategory(admin, cat.id)
    }
  })
})
