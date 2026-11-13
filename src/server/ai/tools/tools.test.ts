import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import type { ChatEvent } from "@/lib/ai/chat-events"
import { uiActionSchema } from "@/lib/ai/ui-actions"
import { addToCartInputSchema, applyFiltersInputSchema, getOutfitSuggestionInputSchema, getOrderStatusInputSchema, navigateInputSchema, searchProductsInputSchema } from "@/lib/validators/ai"
import { createConfirmationStore } from "../core/confirmations"
import { toFilterQuery } from "./apply-filters"
import { createChatTools, type ToolContext } from "./index"

/* Tool chỉ validate rồi gọi service: service được giả, kiểm đầu ra rút gọn, sự kiện phát ra và việc userId lấy từ ngữ cảnh. */

const mocks = vi.hoisted(() => ({
  searchProducts: vi.fn(),
  listProducts: vi.fn(),
  getProductBySlug: vi.fn(),
  adviseSizeForProduct: vi.fn(),
  getCart: vi.fn(),
  addItem: vi.fn(),
  suggestOutfit: vi.fn(),
  getOrderByCode: vi.fn(),
  getOrderDetail: vi.fn(),
  listOrders: vi.fn(),
}))

vi.mock("../advisor/outfit.service", () => ({ suggestOutfit: mocks.suggestOutfit }))
vi.mock("../search/search.service", () => ({ searchProducts: mocks.searchProducts }))
vi.mock("../advisor/size.service", () => ({ adviseSizeForProduct: mocks.adviseSizeForProduct }))
vi.mock("@/server/services/catalog.service", async (orig) => ({
  ...(await orig<typeof import("@/server/services/catalog.service")>()),
  listProducts: mocks.listProducts,
  getProductBySlug: mocks.getProductBySlug,
}))
vi.mock("@/server/services/cart.service", async (orig) => ({ ...(await orig<typeof import("@/server/services/cart.service")>()), getCart: mocks.getCart, addItem: mocks.addItem }))
vi.mock("@/server/services/order.service", async (orig) => ({
  ...(await orig<typeof import("@/server/services/order.service")>()),
  getOrderByCode: mocks.getOrderByCode,
  getOrderDetail: mocks.getOrderDetail,
  listOrders: mocks.listOrders,
}))

const USER = "user-1"
let events: ChatEvent[]
let userText = ""
const confirmations = createConfirmationStore(undefined)
const ctx = (): ToolContext => ({ userId: USER, userText, userHistory: [userText], config: null, emit: (e) => events.push(e), confirmations })
const tools = () => createChatTools(ctx())

type Name = keyof ReturnType<typeof createChatTools>
async function run(name: Name, input: unknown): Promise<Record<string, unknown>> {
  const t = tools()[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<Record<string, unknown>> }
  return t.execute(input, { toolCallId: "t1", messages: [] })
}

beforeEach(() => {
  events = []
  userText = ""
  for (const m of Object.values(mocks)) m.mockReset()
})

const card = {
  id: "p1",
  name: "Áo sơ mi trắng",
  slug: "ao-so-mi-trang",
  categoryName: "Áo sơ mi nam",
  gender: "MEN" as const,
  price: 399000,
  image: { url: "/a.jpg", alt: "Áo" },
  hoverImage: null,
  colors: [{ name: "Trắng", hex: "#fff" }],
  inStock: true,
}

describe("tập tool", () => {
  it("là tập đóng: chỉ đọc, điều khiển giao diện và MỘT tool ghi (addToCart, hai pha); không có tool thanh toán/đơn/admin", () => {
    expect(Object.keys(tools()).sort()).toEqual(
      ["addToCart", "applyFilters", "getOrderStatus", "getOutfitSuggestion", "getProductDetail", "getSizeRecommendation", "navigate", "openCart", "searchProducts", "viewCart"].sort(),
    )
  })

  it("không schema đầu vào nào nhận userId hay role", () => {
    for (const t of Object.values(tools())) {
      const json = JSON.stringify(z.toJSONSchema((t as unknown as { inputSchema: z.ZodType }).inputSchema, { io: "input" }))
      expect(json).toContain('"type":"object"') // đã sinh được JSON schema thật (không phải kiểm rỗng)
      expect(json).not.toMatch(/userId|role/i)
    }
  })
})

describe("searchProducts", () => {
  it("phát thẻ sản phẩm vào luồng và chỉ trả bản rút gọn cho model", async () => {
    mocks.searchProducts.mockResolvedValue({
      result: { items: [card], total: 1 },
      intent: { query: "ao so mi", hard: { genders: ["MEN"], sizes: [], colors: [] }, soft: { occasion: [], season: [], style: [] } },
      relaxed: ["Đã bỏ điều kiện màu đỏ"],
    })
    const out = await run("searchProducts", { query: "áo sơ mi nam", maxResults: 4 })
    expect(mocks.searchProducts).toHaveBeenCalledWith("áo sơ mi nam", { pageSize: 4, config: null })
    expect(events).toEqual([
      { type: "products", items: [{ slug: "ao-so-mi-trang", name: "Áo sơ mi trắng", price: 399000, categoryName: "Áo sơ mi nam", image: { url: "/a.jpg", alt: "Áo" }, colors: ["Trắng"] }] },
    ])
    expect(out).toMatchObject({ ok: true, total: 1, shown: 1, relaxed: ["Đã bỏ điều kiện màu đỏ"] })
    expect(JSON.stringify(out)).not.toContain("/a.jpg") // ảnh chỉ đi qua thẻ, không tốn ngữ cảnh model
  })

  it("không có kết quả thì không phát thẻ", async () => {
    mocks.searchProducts.mockResolvedValue({
      result: { items: [], total: 0 },
      intent: { query: "x", hard: { sizes: [], colors: [] }, soft: { occasion: [], season: [], style: [] } },
      relaxed: [],
    })
    expect(await run("searchProducts", { query: "áo vàng chanh", maxResults: 6 })).toMatchObject({ ok: true, total: 0, shown: 0 })
    expect(events).toEqual([])
  })

  it("service lỗi: trả lỗi có cấu trúc, không lộ chi tiết", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.searchProducts.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"))
    const out = await run("searchProducts", { query: "áo", maxResults: 6 })
    log.mockRestore()
    expect(out).toEqual({ ok: false, code: "INTERNAL", message: "Có lỗi xảy ra, bạn thử lại sau nhé" })
  })

  it("schema giới hạn độ dài câu tìm và số kết quả", () => {
    expect(searchProductsInputSchema.safeParse({ query: "a".repeat(201) }).success).toBe(false)
    expect(searchProductsInputSchema.safeParse({ query: "áo", maxResults: 13 }).success).toBe(false)
    expect(searchProductsInputSchema.parse({ query: "áo" }).maxResults).toBe(6)
  })
})

describe("applyFilters", () => {
  it("đặt trang danh sách theo câu của khách (không theo giá trị model sinh), đếm bằng bộ tìm kiếm và phát setFilters hợp lệ", async () => {
    mocks.searchProducts.mockResolvedValue({ result: { total: 7 } })
    userText = "lọc giúp mình đồ nam màu trắng size M dưới 500k"
    // Model có bịa tham số thì cũng bị bỏ qua: tool không nhận giá trị lọc nào.
    const out = await run("applyFilters", { gender: "women", maxPrice: 100000, category: "apparel" })
    expect(mocks.searchProducts).toHaveBeenCalledWith("đồ nam màu trắng size M dưới 500k", { pageSize: 1, config: null })
    expect(out).toMatchObject({ ok: true, total: 7 })
    expect(events).toEqual([{ type: "ui", action: { type: "setFilters", filters: expect.objectContaining({ q: "đồ nam màu trắng size M dưới 500k" }) } }])
    const filters = (events[0] as { action: { filters: Record<string, unknown> } }).action.filters
    expect(filters.gender).toBeUndefined()
    expect(filters.maxPrice).toBeUndefined()
    expect(uiActionSchema.safeParse((events[0] as { action: unknown }).action).success).toBe(true)
  })

  it("bỏ lời mở đầu của yêu cầu nhưng không làm mất nội dung", () => {
    expect(toFilterQuery("lọc giúp mình áo sơ mi nam màu trắng dưới 500k")).toBe("áo sơ mi nam màu trắng dưới 500k")
    expect(toFilterQuery("Tìm cho mình váy dự tiệc")).toBe("váy dự tiệc")
    expect(toFilterQuery("lọc áo thun")).toBe("áo thun")
    expect(toFilterQuery("áo khoác lọc nắng")).toBe("áo khoác lọc nắng")
    expect(toFilterQuery("lọc")).toBe("lọc") // không còn gì sau lời mở đầu thì giữ nguyên, không trả chuỗi rỗng
  })

  it("câu quá dài được cắt còn 100 ký tự (giới hạn của tham số q)", async () => {
    mocks.searchProducts.mockResolvedValue({ result: { total: 0 } })
    userText = "áo ".repeat(100)
    await run("applyFilters", {})
    const action = (events[0] as { action: { filters: { q: string } } }).action
    expect(action.filters.q.length).toBeLessThanOrEqual(100)
  })

  it("schema không nhận tham số nào từ model", () => {
    expect(Object.keys(applyFiltersInputSchema.shape)).toEqual([])
  })
})

describe("getProductDetail", () => {
  it("trả bản rút gọn: có id biến thể và cờ còn hàng, không có SKU hay số tồn chính xác", async () => {
    mocks.getProductBySlug.mockResolvedValue({
      name: "Áo thun",
      slug: "ao-thun",
      brand: "FS",
      category: { name: "Áo thun nam", slug: "ao-thun-nam", parent: null },
      gender: "MEN",
      material: "Cotton",
      style: "casual",
      occasion: ["đi chơi"],
      description: "x".repeat(900),
      variants: [
        { id: "v1", sku: "SKU-1", size: "M", color: "Trắng", colorHex: "#fff", price: 199000, stock: 5 },
        { id: "v2", sku: "SKU-2", size: "L", color: "Đen", colorHex: "#000", price: 219000, stock: 0 },
      ],
      sizeChart: [{}],
    })
    const out = await run("getProductDetail", { product: "ao-thun" })
    expect(out).toMatchObject({ ok: true, priceFrom: 199000, priceTo: 219000, hasSizeChart: true })
    expect((out.description as string).length).toBeLessThanOrEqual(401)
    expect(out.variants).toEqual([
      { id: "v1", size: "M", color: "Trắng", price: 199000, inStock: true },
      { id: "v2", size: "L", color: "Đen", price: 219000, inStock: false },
    ])
    expect(JSON.stringify(out)).not.toMatch(/SKU-|stock/)
  })

  it("không có sản phẩm: PRODUCT_NOT_FOUND", async () => {
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({ result: { items: [] } })
    expect(await run("getProductDetail", { product: "ao-bia-hoan-toan" })).toMatchObject({ ok: false, code: "PRODUCT_NOT_FOUND" })
  })

  it("nhận tên sản phẩm (không cần slug đúng): đổi sang slug thật rồi đọc chi tiết", async () => {
    const real = { name: "Áo sơ mi poplin công sở", slug: "ao-so-mi-poplin-cong-so", brand: "FS", category: { name: "Áo sơ mi nam" }, gender: "MEN", material: "Cotton", style: "formal", occasion: [], description: "x", variants: [], sizeChart: [] }
    mocks.getProductBySlug.mockImplementation(async (slug: string) => (slug === real.slug ? real : null))
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: real.name, slug: real.slug }] } })
    // Model bịa slug "ao-so-mi-poplin-con-guo": không có sản phẩm nên tìm theo tên.
    expect(await run("getProductDetail", { product: "áo sơ mi poplin công sở" })).toMatchObject({ ok: true, slug: real.slug })
  })
})

describe("getSizeRecommendation", () => {
  const base = { productName: "Áo thun", alternativeSize: null, confidence: "high", reasons: [], missingFields: [], stock: null, message: null }

  beforeEach(() => mocks.getProductBySlug.mockResolvedValue({ slug: "ao-thun" }))

  it("có gợi ý: phát thẻ size kèm bảng size và trả kết quả cho model diễn đạt", async () => {
    mocks.adviseSizeForProduct.mockResolvedValue({ advice: { ...base, status: "recommended", recommendedSize: "M" }, chart: [], categoryName: "Áo thun nam" })
    const out = await run("getSizeRecommendation", { product: "ao-thun", heightCm: 170, weightKg: 65 })
    expect(mocks.adviseSizeForProduct).toHaveBeenCalledWith(expect.objectContaining({ productSlug: "ao-thun", heightCm: 170, weightKg: 65 }))
    expect(out).toMatchObject({ ok: true, status: "recommended", recommendedSize: "M" })
    expect(events).toEqual([{ type: "size", advice: expect.objectContaining({ recommendedSize: "M" }), chart: [], categoryName: "Áo thun nam" }])
  })

  it("thiếu số đo (need_info): không phát thẻ, model hỏi lại bằng lời", async () => {
    mocks.adviseSizeForProduct.mockResolvedValue({
      advice: { ...base, status: "need_info", recommendedSize: null, missingFields: ["heightCm", "weightKg"] },
      chart: [],
      categoryName: "Áo thun nam",
    })
    const out = await run("getSizeRecommendation", { product: "ao-thun" })
    expect(out).toMatchObject({ ok: true, status: "need_info", missingFields: ["heightCm", "weightKg"] })
    expect(events).toEqual([])
  })

  it("slug bịa (không có sản phẩm) và không tìm được theo tên: PRODUCT_NOT_FOUND, không tính size", async () => {
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({ result: { items: [] } })
    expect(await run("getSizeRecommendation", { product: "somi-poplin-cung-170" })).toMatchObject({ ok: false, code: "PRODUCT_NOT_FOUND" })
    expect(mocks.adviseSizeForProduct).not.toHaveBeenCalled()
  })

  it("tên sản phẩm khớp đúng một sản phẩm: dùng slug thật của sản phẩm đó", async () => {
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: "Áo sơ mi poplin công sở", slug: "ao-so-mi-poplin-cong-so" }, { name: "Áo thun cotton", slug: "ao-thun-cotton" }] } })
    mocks.adviseSizeForProduct.mockResolvedValue({ advice: { ...base, status: "recommended", recommendedSize: "L" }, chart: [], categoryName: "Áo sơ mi nam" })
    await run("getSizeRecommendation", { product: "áo sơ mi poplin công sở", heightCm: 178 })
    expect(mocks.adviseSizeForProduct).toHaveBeenCalledWith(expect.objectContaining({ productSlug: "ao-so-mi-poplin-cong-so", heightCm: 178 }))
  })

  it("nhiều sản phẩm khớp tên: AMBIGUOUS_PRODUCT kèm tên để hỏi khách, không đoán", async () => {
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({
      result: { items: [{ name: "Quần jeans nữ ống rộng", slug: "q1" }, { name: "Quần jeans nữ skinny", slug: "q2" }] },
    })
    const out = await run("getSizeRecommendation", { product: "quần jeans nữ", heightCm: 165 })
    expect(out).toMatchObject({ ok: false, code: "AMBIGUOUS_PRODUCT", details: { candidates: ["Quần jeans nữ ống rộng", "Quần jeans nữ skinny"] } })
    expect(mocks.adviseSizeForProduct).not.toHaveBeenCalled()
  })
})

describe("viewCart", () => {
  it("đọc giỏ của userId trong ngữ cảnh và chỉ trả trường cần thiết", async () => {
    mocks.getCart.mockResolvedValue({
      itemCount: 2,
      subtotal: 398000,
      items: [
        { variantId: "v1", productId: "p1", slug: "ao", name: "Áo thun", sku: "S1", size: "M", color: "Trắng", colorHex: "#fff", image: null, unitPrice: 199000, quantity: 2, lineTotal: 398000, stock: 9, warnings: [{ code: "STOCK_REDUCED", message: "Chỉ còn 9" }] },
      ],
    })
    const out = await run("viewCart", {})
    expect(mocks.getCart).toHaveBeenCalledWith({ userId: USER })
    expect(out).toEqual({
      ok: true,
      itemCount: 2,
      subtotal: 398000,
      items: [{ name: "Áo thun", size: "M", color: "Trắng", quantity: 2, unitPrice: 199000, lineTotal: 398000, warnings: ["Chỉ còn 9"] }],
    })
  })
})

describe("getOrderStatus", () => {
  const order = {
    id: "o1",
    code: "FS-20261110-0003",
    status: "SHIPPING",
    paymentMethod: "COD",
    paymentStatus: "UNPAID",
    createdAt: new Date("2026-11-10T03:00:00Z"),
    subtotal: 398000,
    shippingFee: 30000,
    total: 428000,
    note: "gọi trước khi giao",
    shippingAddress: { fullName: "Nguyễn Văn A", phone: "0987654321", street: "1 Lê Lợi", ward: "P1", district: "Q1", province: "HCM" },
    items: [{ productName: "Áo thun", size: "M", color: "Trắng", unitPrice: 199000, quantity: 2, variantId: "v1", image: null, slug: "ao", inStock: true }],
    history: [{ fromStatus: null, toStatus: "PENDING", actorType: "CUSTOMER", actorName: "Nguyễn Văn A", note: null, createdAt: new Date("2026-11-10T03:00:00Z") }],
  }

  it("tra theo mã: ràng buộc userId từ ngữ cảnh, không trả địa chỉ, SĐT, ghi chú đơn hay tên người xử lý", async () => {
    mocks.getOrderByCode.mockResolvedValue(order)
    const out = await run("getOrderStatus", { orderCode: "FS-20261110-0003" })
    expect(mocks.getOrderByCode).toHaveBeenCalledWith(USER, "FS-20261110-0003")
    expect(out).toMatchObject({ ok: true, code: "FS-20261110-0003", status: "SHIPPING", total: 428000 })
    const text = JSON.stringify(out)
    for (const secret of ["0987654321", "Lê Lợi", "Nguyễn Văn A", "gọi trước khi giao", "shippingAddress"]) expect(text).not.toContain(secret)
  })

  it("không có mã: lấy đơn gần nhất của chính khách", async () => {
    mocks.listOrders.mockResolvedValue({ items: [{ id: "o1" }] })
    mocks.getOrderDetail.mockResolvedValue(order)
    const out = await run("getOrderStatus", {})
    expect(mocks.listOrders).toHaveBeenCalledWith(USER, { pageSize: 1 })
    expect(mocks.getOrderDetail).toHaveBeenCalledWith(USER, "o1")
    expect(out).toMatchObject({ ok: true, code: "FS-20261110-0003" })
  })

  it("orderCode rỗng (model hay gửi chuỗi rỗng thay vì bỏ trống) được coi là không có mã, không bị từ chối", () => {
    expect(getOrderStatusInputSchema.parse({ orderCode: "" })).toEqual({ orderCode: undefined })
    expect(getOrderStatusInputSchema.parse({ orderCode: "  " })).toEqual({ orderCode: undefined })
    expect(getOrderStatusInputSchema.parse({ orderCode: " FS-20261110-0003 " })).toEqual({ orderCode: "FS-20261110-0003" })
    expect(getOrderStatusInputSchema.safeParse({ orderCode: "x".repeat(41) }).success).toBe(false)
  })

  it("mã không có hoặc của người khác đều ra ORDER_NOT_FOUND; chưa có đơn nào cũng vậy", async () => {
    mocks.getOrderByCode.mockResolvedValue(null)
    expect(await run("getOrderStatus", { orderCode: "FS-20261110-9999" })).toMatchObject({ ok: false, code: "ORDER_NOT_FOUND" })
    mocks.listOrders.mockResolvedValue({ items: [] })
    expect(await run("getOrderStatus", {})).toMatchObject({ ok: false, code: "ORDER_NOT_FOUND" })
  })
})

describe("openCart và navigate", () => {
  it("phát đúng hành động giao diện", async () => {
    expect(await run("openCart", {})).toEqual({ ok: true })
    expect(await run("navigate", { to: "/checkout" })).toEqual({ ok: true, to: "/checkout" })
    expect(events).toEqual([
      { type: "ui", action: { type: "openCart" } },
      { type: "ui", action: { type: "navigate", to: "/checkout" } },
    ])
  })

  it("schema navigate từ chối đường dẫn ngoài whitelist", () => {
    for (const to of ["https://evil.example", "/admin", "javascript:alert(1)", "/api/ai/chat"]) {
      expect(navigateInputSchema.safeParse({ to }).success, to).toBe(false)
    }
  })
})

describe("addToCart (tool ghi, pha 1: chỉ tạo thẻ xác nhận)", () => {
  const product = {
    name: "Áo sơ mi poplin công sở",
    slug: "ao-so-mi-poplin-cong-so",
    variants: [
      { id: "v-m-trang", size: "M", color: "Trắng", price: 429000, stock: 5 },
      { id: "v-l-trang", size: "L", color: "Trắng", price: 429000, stock: 2 },
      { id: "v-l-xam", size: "L", color: "Xám", price: 439000, stock: 0 },
      { id: "v-m-xanh", size: "M", color: "Xanh nhạt", price: 429000, stock: 3 },
    ],
  }
  beforeEach(() => {
    mocks.getProductBySlug.mockResolvedValue(product)
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: product.name, slug: product.slug }] } })
  })

  it("KHÔNG ghi giỏ: chỉ phát thẻ xác nhận, addItem không bao giờ được gọi", async () => {
    const out = await run("addToCart", { product: product.slug, size: "L", color: "trắng", quantity: 2 })
    expect(mocks.addItem).not.toHaveBeenCalled()
    expect(out).toMatchObject({ ok: true, status: "pending_confirmation" })
    expect(out.note).toContain("CHƯA thêm vào giỏ")
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: "confirm",
      data: { title: "Thêm vào giỏ hàng?", lines: [`${product.name} · Trắng · L × 2`], total: 858000, expiresInMinutes: 5 },
    })
  })

  it("bản ghi chờ xác nhận gắn đúng người dùng và đúng biến thể thật do server chọn (không phải id model đưa)", async () => {
    await run("addToCart", { product: product.slug, size: "L", color: "Trắng", quantity: 2 })
    const id = (events[0] as { data: { id: string } }).data.id
    expect(await confirmations.consume("someone-else", id)).toBeNull()
    expect(await confirmations.consume(USER, id)).toEqual({ kind: "addToCart", variantId: "v-l-trang", quantity: 2 })
  })

  it("thiếu size/màu mà còn nhiều lựa chọn: NEED_SIZE_OR_COLOR kèm lựa chọn còn hàng, không tạo thẻ", async () => {
    const out = await run("addToCart", { product: product.slug, quantity: 1 })
    expect(out).toMatchObject({ ok: false, code: "NEED_SIZE_OR_COLOR" })
    expect(JSON.stringify(out)).toContain("M · Trắng")
    expect(JSON.stringify(out)).not.toContain("L · Xám") // hết hàng không được đưa ra
    expect(events).toEqual([])
  })

  it("size, màu hết hàng hoặc không có: VARIANT_NOT_AVAILABLE, không tạo thẻ", async () => {
    expect(await run("addToCart", { product: product.slug, size: "L", color: "Xám", quantity: 1 })).toMatchObject({ ok: false, code: "VARIANT_NOT_AVAILABLE" })
    expect(await run("addToCart", { product: product.slug, size: "XXL", quantity: 1 })).toMatchObject({ ok: false, code: "VARIANT_NOT_AVAILABLE" })
    expect(events).toEqual([])
  })

  it("số lượng vượt tồn kho: INSUFFICIENT_STOCK, không tạo thẻ", async () => {
    const out = await run("addToCart", { product: product.slug, size: "L", color: "Trắng", quantity: 3 })
    expect(out).toMatchObject({ ok: false, code: "INSUFFICIENT_STOCK", details: { available: 2 } })
    expect(events).toEqual([])
  })

  it("sản phẩm bịa hoặc mơ hồ: lỗi để hỏi lại, không tạo thẻ", async () => {
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({ result: { items: [] } })
    expect(await run("addToCart", { product: "áo thần kỳ", size: "M", quantity: 1 })).toMatchObject({ ok: false, code: "PRODUCT_NOT_FOUND" })
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: "Quần jeans nữ ống rộng", slug: "q1" }, { name: "Quần jeans nữ skinny", slug: "q2" }] } })
    expect(await run("addToCart", { product: "quần jeans nữ", size: "M", quantity: 1 })).toMatchObject({ ok: false, code: "AMBIGUOUS_PRODUCT" })
    expect(events).toEqual([])
  })

  it("schema: số lượng 1–99, size và màu rỗng coi như chưa nói, không nhận variantId/userId từ model", () => {
    expect(addToCartInputSchema.safeParse({ product: "x", quantity: 0 }).success).toBe(false)
    expect(addToCartInputSchema.safeParse({ product: "x", quantity: 100 }).success).toBe(false)
    expect(addToCartInputSchema.parse({ product: "x" })).toEqual({ product: "x", quantity: 1, size: undefined, color: undefined })
    expect(addToCartInputSchema.parse({ product: "x", size: "", color: "  " })).toMatchObject({ size: undefined, color: undefined })
    const keys = Object.keys(addToCartInputSchema.shape)
    expect(keys).not.toEqual(expect.arrayContaining(["variantId"]))
    expect(keys).not.toEqual(expect.arrayContaining(["userId"]))
  })

  it("không tool nào trong tập tool gọi addItem (đường ghi giỏ duy nhất là /api/ai/confirm)", async () => {
    mocks.listProducts.mockResolvedValue({ total: 0 })
    mocks.getCart.mockResolvedValue({ itemCount: 0, subtotal: 0, items: [] })
    mocks.searchProducts.mockResolvedValue({
      result: { items: [], total: 0 },
      intent: { query: "x", hard: { sizes: [], colors: [] }, soft: { occasion: [], season: [], style: [] } },
      relaxed: [],
    })
    mocks.listOrders.mockResolvedValue({ items: [] })
    await run("searchProducts", { query: "áo", maxResults: 3 })
    await run("applyFilters", {})
    await run("viewCart", {})
    await run("getOrderStatus", {})
    await run("openCart", {})
    await run("navigate", { to: "/cart" })
    await run("addToCart", { product: "x", size: "M", quantity: 1 })
    mocks.suggestOutfit.mockResolvedValue({ ok: false, code: "NEED_GENDER", message: "hỏi" })
    await run("getOutfitSuggestion", {})
    expect(mocks.addItem).not.toHaveBeenCalled()
  })
})

describe("getOutfitSuggestion (Mix & Match)", () => {
  const view = { title: "Bộ đồ đi làm cho nữ", occasion: "đi làm", seasons: [], items: [{ slot: "top", slug: "ao", name: "Áo sơ mi", image: null, variantLabel: "Trắng", price: 399000, reason: "Hợp dịp đi làm" }, { slot: "bottom", slug: "quan", name: "Quần tây", image: null, variantLabel: "Đen", price: 499000, reason: null }], totalPrice: 898000, knowledgeSources: [], missingSlots: [], note: null }

  it("phát thẻ bộ đồ vào luồng; model chỉ nhận bản tóm tắt (không ảnh, không lý do) và lời nhắc không liệt kê lại", async () => {
    mocks.suggestOutfit.mockResolvedValue({ ok: true, view })
    userText = "phối đồ đi làm cho nữ"
    const out = await run("getOutfitSuggestion", {})
    expect(events).toEqual([{ type: "outfit", data: view }])
    expect(out).toMatchObject({ ok: true, title: view.title, totalPrice: 898000, items: [{ slot: "top", name: "Áo sơ mi", color: "Trắng", price: 399000 }, { slot: "bottom", name: "Quần tây", color: "Đen", price: 499000 }] })
    expect(JSON.stringify(out)).not.toContain("Hợp dịp đi làm")
    expect(out.note).toContain("đừng liệt kê lại")
  })

  it("điều kiện lấy từ các câu gần đây của khách, không từ model", async () => {
    mocks.suggestOutfit.mockResolvedValue({ ok: true, view })
    userText = "nữ"
    const t = tools().getOutfitSuggestion as unknown as { execute: (i: unknown, o: unknown) => Promise<unknown> }
    const withHistory = { ...ctx(), userHistory: ["Phối đồ đi làm", "nữ"] }
    const tool = createChatTools(withHistory).getOutfitSuggestion as unknown as { execute: (i: unknown, o: unknown) => Promise<unknown> }
    await tool.execute({ occasion: "đi tiệc", gender: "men" }, { toolCallId: "t", messages: [] })
    expect(t).toBeDefined()
    expect(mocks.suggestOutfit).toHaveBeenCalledWith({ userTexts: ["Phối đồ đi làm", "nữ"], anchorSlug: undefined }, null)
  })

  it("khách đã chọn sẵn một sản phẩm: tên được đổi sang slug thật rồi mới phối", async () => {
    mocks.suggestOutfit.mockResolvedValue({ ok: true, view })
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: "Áo sơ mi poplin công sở", slug: "ao-so-mi-poplin-cong-so" }] } })
    userText = "phối thêm đồ cho áo sơ mi poplin công sở của mình"
    await run("getOutfitSuggestion", { product: "áo sơ mi poplin công sở" })
    expect(mocks.suggestOutfit).toHaveBeenCalledWith(expect.objectContaining({ anchorSlug: "ao-so-mi-poplin-cong-so" }), null)
  })

  it("sản phẩm bịa hoặc mơ hồ: lỗi để hỏi lại, không phối", async () => {
    mocks.getProductBySlug.mockResolvedValue(null)
    mocks.searchProducts.mockResolvedValue({ result: { items: [] } })
    userText = "phối đồ với áo thần kỳ và quần jeans nữ"
    expect(await run("getOutfitSuggestion", { product: "áo thần kỳ" })).toMatchObject({ ok: false, code: "PRODUCT_NOT_FOUND" })
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: "Quần jeans nữ A", slug: "a" }, { name: "Quần jeans nữ B", slug: "b" }] } })
    expect(await run("getOutfitSuggestion", { product: "quần jeans nữ" })).toMatchObject({ ok: false, code: "AMBIGUOUS_PRODUCT" })
    expect(mocks.suggestOutfit).not.toHaveBeenCalled()
    expect(events).toEqual([])
  })

  it("chưa biết nam hay nữ, hết ngân sách, không đủ món: trả lỗi có cấu trúc, không phát thẻ", async () => {
    for (const code of ["NEED_GENDER", "OVER_BUDGET", "NO_OUTFIT"]) {
      mocks.suggestOutfit.mockResolvedValue({ ok: false, code, message: "m" })
      expect(await run("getOutfitSuggestion", {})).toMatchObject({ ok: false, code })
    }
    expect(events).toEqual([])
  })

  it("schema chỉ nhận tên sản phẩm (không dịp, giới tính, ngân sách do model bịa)", () => {
    expect(Object.keys(getOutfitSuggestionInputSchema.shape)).toEqual(["product"])
    expect(getOutfitSuggestionInputSchema.parse({ product: "  " })).toEqual({ product: undefined })
  })
})

describe("getOutfitSuggestion: tên sản phẩm do model bịa", () => {
  it("tên sản phẩm khách chưa hề nói bị bỏ qua (phối từ đầu), không báo lỗi không tìm thấy", async () => {
    mocks.suggestOutfit.mockResolvedValue({ ok: true, view: { title: "Bộ đồ đi biển cho nam", occasion: "đi biển", seasons: [], items: [{ slot: "top", slug: "a", name: "A", image: null, variantLabel: "Kem", price: 1, reason: null }], totalPrice: 1, knowledgeSources: [], missingSlots: [], note: null } })
    userText = "gợi ý outfit đi biển cho nam dưới 1 triệu"
    const out = await run("getOutfitSuggestion", { product: "áo thun cotton trắng" })
    expect(out).toMatchObject({ ok: true })
    expect(mocks.suggestOutfit).toHaveBeenCalledWith({ userTexts: [userText], anchorSlug: undefined }, null)
    expect(mocks.searchProducts).not.toHaveBeenCalled()
  })
})

describe("addToCart: size \"Free size\" (lỗi thật)", () => {
  it("khách và model nói 'Free' (hoặc 'free size') thì khớp biến thể 'Free size' còn hàng và tạo thẻ xác nhận", async () => {
    mocks.getProductBySlug.mockResolvedValue({
      name: "Mũ bucket canvas",
      slug: "mu-bucket-canvas",
      variants: [
        { id: "v-den", size: "Free size", color: "Đen", price: 189000, stock: 4 },
        { id: "v-kem", size: "Free size", color: "Kem", price: 189000, stock: 2 },
        { id: "v-reu", size: "Free size", color: "Xanh rêu", price: 189000, stock: 3 },
      ],
    })
    mocks.searchProducts.mockResolvedValue({ result: { items: [{ name: "Mũ bucket canvas", slug: "mu-bucket-canvas" }] } })
    for (const size of ["Free", "free size", "Free size", "freesize"]) {
      events = []
      const out = await run("addToCart", { product: "mu-bucket-canvas", size, color: "Xanh rêu", quantity: 1 })
      expect(out, size).toMatchObject({ ok: true, status: "pending_confirmation" })
      const id = (events[0] as { data: { id: string } }).data.id
      expect(await confirmations.consume(USER, id)).toEqual({ kind: "addToCart", variantId: "v-reu", quantity: 1 })
    }
  })

  it("size chữ khác nhau vẫn không khớp nhầm (L không khớp XL)", async () => {
    mocks.getProductBySlug.mockResolvedValue({
      name: "Áo",
      slug: "ao",
      variants: [{ id: "v-xl", size: "XL", color: "Trắng", price: 1, stock: 3 }],
    })
    expect(await run("addToCart", { product: "ao", size: "L", color: "Trắng", quantity: 1 })).toMatchObject({ ok: false, code: "VARIANT_NOT_AVAILABLE" })
  })
})
