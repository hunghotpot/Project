import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeCartStore } from "@/test/fake-cart-db"
import {
  addItem,
  CartError,
  clearCart,
  getCart,
  removeItem,
  updateQuantity,
  type CartContext,
} from "./cart.service"

vi.mock("@/server/db", async () => ({ db: (await import("@/test/fake-cart-db")).fakeCartDb }))

const user: CartContext = { userId: "user-1" }

async function expectCartError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(CartError)
  expect((err as CartError).code).toBe(code)
  return err as CartError
}

beforeEach(() => {
  fakeCartStore.reset()
  fakeCartStore.addVariant({ id: "v1", stock: 5, price: 100_000 })
  fakeCartStore.addVariant({ id: "v2", stock: 3, price: 250_000 })
})

describe("getCart / addItem", () => {
  it("chưa có giỏ thì trả giỏ rỗng và không tạo bản ghi", async () => {
    expect(await getCart(user)).toMatchObject({ items: [], itemCount: 0, subtotal: 0 })
    expect(fakeCartStore.cartCount()).toBe(0)
  })

  it("thêm sản phẩm trả về giỏ có thông tin biến thể, số lượng và tạm tính", async () => {
    await addItem(user, "v1", 2)
    const cart = await addItem(user, "v2", 1)

    expect(cart.itemCount).toBe(3)
    expect(cart.subtotal).toBe(2 * 100_000 + 250_000)
    expect(cart.items[0]).toMatchObject({ variantId: "v1", name: "SP v1", size: "M", color: "Đen", quantity: 2, lineTotal: 200_000 })
  })

  it("thêm lại cùng biến thể thì cộng dồn vào một dòng", async () => {
    await addItem(user, "v1", 2)
    const cart = await addItem(user, "v1", 1)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(3)
  })
})

describe("kiểm tra tồn kho", () => {
  it("không cho thêm vượt tồn kho và báo rõ số còn lại", async () => {
    const err = await expectCartError(addItem(user, "v2", 4), "INSUFFICIENT_STOCK")
    expect(err.message).toContain("3")
    expect(err.available).toBe(3)
    expect(await getCart(user)).toMatchObject({ itemCount: 0 })
  })

  it("tính cả số lượng đã có trong giỏ khi cộng dồn", async () => {
    await addItem(user, "v2", 2)
    const err = await expectCartError(addItem(user, "v2", 2), "INSUFFICIENT_STOCK")
    expect(err.available).toBe(1)
    expect((await getCart(user)).itemCount).toBe(2)
  })

  it("từ chối biến thể hết hàng, không tồn tại hoặc sản phẩm ngừng bán", async () => {
    fakeCartStore.addVariant({ id: "empty", stock: 0 })
    fakeCartStore.addVariant({ id: "hidden", stock: 9, isActive: false })
    await expectCartError(addItem(user, "empty", 1), "OUT_OF_STOCK")
    await expectCartError(addItem(user, "hidden", 1), "VARIANT_NOT_FOUND")
    await expectCartError(addItem(user, "nope", 1), "VARIANT_NOT_FOUND")
  })

  it("updateQuantity cũng không được vượt tồn kho", async () => {
    await addItem(user, "v1", 1)
    const err = await expectCartError(updateQuantity(user, "v1", 6), "INSUFFICIENT_STOCK")
    expect(err.available).toBe(5)
    expect((await updateQuantity(user, "v1", 5)).items[0].quantity).toBe(5)
  })
})

describe("số lượng không hợp lệ / bằng 0", () => {
  it("addItem từ chối 0, số âm và số thập phân", async () => {
    for (const q of [0, -1, 1.5, 100]) await expectCartError(addItem(user, "v1", q), "INVALID_QUANTITY")
  })

  it("updateQuantity về 0 thì xoá dòng khỏi giỏ", async () => {
    await addItem(user, "v1", 2)
    await addItem(user, "v2", 1)
    const cart = await updateQuantity(user, "v1", 0)
    expect(cart.items.map((i) => i.variantId)).toEqual(["v2"])
  })

  it("updateQuantity từ chối số âm; dòng không có trong giỏ báo ITEM_NOT_FOUND", async () => {
    await addItem(user, "v1", 1)
    await expectCartError(updateQuantity(user, "v1", -1), "INVALID_QUANTITY")
    await expectCartError(updateQuantity(user, "v2", 1), "ITEM_NOT_FOUND")
  })
})

describe("removeItem / clearCart", () => {
  it("removeItem xoá đúng dòng và bỏ qua dòng không tồn tại", async () => {
    await addItem(user, "v1", 1)
    await addItem(user, "v2", 1)
    expect((await removeItem(user, "v1")).items.map((i) => i.variantId)).toEqual(["v2"])
    expect((await removeItem(user, "v1")).itemCount).toBe(1)
  })

  it("clearCart làm rỗng giỏ", async () => {
    await addItem(user, "v1", 2)
    expect(await clearCart(user)).toMatchObject({ items: [], itemCount: 0 })
    expect((await getCart(user)).itemCount).toBe(0)
  })

  it("giỏ của hai user tách biệt", async () => {
    await addItem(user, "v1", 1)
    expect((await getCart({ userId: "user-2" })).itemCount).toBe(0)
  })
})

describe("cảnh báo khi dữ liệu đổi", () => {
  it("báo giá đã thay đổi kể từ lúc thêm", async () => {
    await addItem(user, "v1", 1)
    fakeCartStore.setPrice("v1", 120_000)
    const line = (await getCart(user)).items[0]
    expect(line.unitPrice).toBe(120_000)
    expect(line.warnings.map((w) => w.code)).toEqual(["PRICE_CHANGED"])
  })

  it("báo tồn kho giảm xuống dưới số lượng trong giỏ, và hết hàng thì loại khỏi tạm tính", async () => {
    await addItem(user, "v1", 4)
    fakeCartStore.setStock("v1", 2)
    let cart = await getCart(user)
    expect(cart.items[0].warnings.map((w) => w.code)).toEqual(["STOCK_REDUCED"])
    expect(cart.subtotal).toBe(400_000)

    fakeCartStore.setStock("v1", 0)
    cart = await getCart(user)
    expect(cart.items[0].warnings.map((w) => w.code)).toEqual(["OUT_OF_STOCK"])
    expect(cart.subtotal).toBe(0)
  })
})
