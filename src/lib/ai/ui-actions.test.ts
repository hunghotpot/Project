import { describe, expect, it } from "vitest"
import { parseProductFilters } from "@/lib/validators/product-filter"
import { ALLOWED_PATH, uiActionHref, uiActionSchema } from "./ui-actions"

describe("uiActionSchema (whitelist hành động giao diện)", () => {
  it("nhận ba hành động hợp lệ", () => {
    expect(uiActionSchema.safeParse({ type: "openCart" }).success).toBe(true)
    expect(uiActionSchema.safeParse({ type: "navigate", to: "/cart" }).success).toBe(true)
    expect(uiActionSchema.safeParse({ type: "setFilters", filters: parseProductFilters(new URLSearchParams("size=M&maxPrice=500000")) }).success).toBe(true)
  })

  it("từ chối type lạ hoặc không có type (kể cả hành động ghi)", () => {
    for (const bad of [{ type: "addToCart", variantId: "x" }, { type: "eval", code: "1" }, { type: "placeOrder" }, {}, null, "openCart"]) {
      expect(uiActionSchema.safeParse(bad).success).toBe(false)
    }
  })

  it("từ chối đường dẫn ngoài whitelist: URL tuyệt đối, javascript:, //host, admin, API, thoát thư mục", () => {
    for (const to of [
      "https://evil.example/login",
      "http://localhost:3000/cart",
      "javascript:alert(1)",
      "//evil.example",
      "/admin",
      "/admin/orders",
      "/api/ai/chat",
      "/products/../admin",
      "/login",
      "/cart?next=https://evil.example",
      "/cart/",
      "cart",
      "/products/Áo Thun",
      "",
    ]) {
      expect(uiActionSchema.safeParse({ type: "navigate", to }).success, to).toBe(false)
    }
  })

  it("nhận các trang cửa hàng được phép", () => {
    for (const to of ["/products", "/products/ao-so-mi-trang", "/categories/ao-thun-nam", "/cart", "/checkout", "/account", "/account/orders", "/account/orders/abc123"]) {
      expect(ALLOWED_PATH.test(to), to).toBe(true)
    }
  })

  it("setFilters thiếu filters thì bị từ chối", () => {
    expect(uiActionSchema.safeParse({ type: "setFilters" }).success).toBe(false)
  })
})

describe("uiActionHref", () => {
  it("setFilters dựng URL bằng serializeProductFilters (bộ lọc nằm trong URL)", () => {
    const filters = parseProductFilters(new URLSearchParams("gender=men&size=M&maxPrice=500000"))
    expect(uiActionHref({ type: "setFilters", filters })).toBe("/products?size=M&gender=men&maxPrice=500000")
  })

  it("setFilters rỗng về /products; navigate giữ nguyên đường dẫn; openCart không đổi trang", () => {
    expect(uiActionHref({ type: "setFilters", filters: parseProductFilters(new URLSearchParams()) })).toBe("/products")
    expect(uiActionHref({ type: "navigate", to: "/cart" })).toBe("/cart")
    expect(uiActionHref({ type: "openCart" })).toBeNull()
  })
})
