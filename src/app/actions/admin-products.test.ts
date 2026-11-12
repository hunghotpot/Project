import { beforeEach, describe, expect, it, vi } from "vitest"

const getAdminUser = vi.fn()
const createProduct = vi.fn()
const updateProduct = vi.fn()
const setProductActive = vi.fn()
const deleteProduct = vi.fn()
const adjustStock = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/server/auth/admin", () => ({
  getAdminUser: () => getAdminUser(),
  NOT_ADMIN_MESSAGE: "Bạn không có quyền thực hiện thao tác này",
}))
vi.mock("@/server/services/admin-catalog.service", () => ({
  AdminCatalogError: class AdminCatalogError extends Error {
    constructor(
      public code: string,
      message: string,
      public issues?: unknown[]
    ) {
      super(message)
    }
  },
}))
vi.mock("@/server/services/admin-product.service", () => ({
  createProduct: (...a: unknown[]) => createProduct(...a),
  updateProduct: (...a: unknown[]) => updateProduct(...a),
  setProductActive: (...a: unknown[]) => setProductActive(...a),
  deleteProduct: (...a: unknown[]) => deleteProduct(...a),
  adjustStock: (...a: unknown[]) => adjustStock(...a),
}))

import { AdminCatalogError } from "@/server/services/admin-catalog.service"
import { adjustStockAction, deleteProductAction, saveProductAction, setProductActiveAction } from "./admin-products"

const NOT_ADMIN = { ok: false, message: "Bạn không có quyền thực hiện thao tác này" }
const ADMIN = { id: "admin-1", role: "ADMIN" }
const services = [createProduct, updateProduct, setProductActive, deleteProduct, adjustStock]

const validProduct = {
  name: "Áo thun basic",
  skuPrefix: "tee-01",
  description: "Áo thun cotton",
  brand: "Fashion Store",
  material: "Cotton",
  style: "casual",
  occasion: ["đi chơi"],
  season: ["hè"],
  gender: "UNISEX",
  tags: ["Basic"],
  basePrice: 199000,
  isActive: true,
  categoryId: "cat-1",
  images: [{ url: "/uploads/123e4567-e89b-42d3-a456-426614174000.jpg" }],
  variants: [{ size: "M", color: "Đen", colorHex: "#000000", stock: 5 }],
}

beforeEach(() => {
  getAdminUser.mockReset()
  for (const s of services) s.mockReset()
  getAdminUser.mockResolvedValue(ADMIN)
})

describe("saveProductAction", () => {
  it("khách / chưa đăng nhập bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await saveProductAction({ data: validProduct })).toEqual(NOT_ADMIN)
    expect(await saveProductAction({ id: "p1", data: validProduct })).toEqual(NOT_ADMIN)
    expect(createProduct).not.toHaveBeenCalled()
    expect(updateProduct).not.toHaveBeenCalled()
  })

  it("Admin: không có id gọi createProduct với { userId }", async () => {
    createProduct.mockResolvedValue({})
    const res = await saveProductAction({ data: validProduct })
    expect(res.ok).toBe(true)
    expect(createProduct).toHaveBeenCalledTimes(1)
    const [ctx, data] = createProduct.mock.calls[0]
    expect(ctx).toEqual({ userId: "admin-1" })
    expect(data).toMatchObject({ name: "Áo thun basic", skuPrefix: "TEE-01", tags: ["basic"], basePrice: 199000 })
    expect(updateProduct).not.toHaveBeenCalled()
  })

  it("Admin: có id gọi updateProduct", async () => {
    updateProduct.mockResolvedValue({})
    const res = await saveProductAction({ id: "p1", data: validProduct })
    expect(res.ok).toBe(true)
    expect(updateProduct.mock.calls[0][0]).toEqual({ userId: "admin-1" })
    expect(updateProduct.mock.calls[0][1]).toBe("p1")
    expect(createProduct).not.toHaveBeenCalled()
  })

  it("input sai trả issues theo từng ô và không gọi service", async () => {
    const res = await saveProductAction({ data: { ...validProduct, name: "", basePrice: -1 } })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      const paths = (res.issues ?? []).map((i) => i.path.join("."))
      expect(paths).toContain("name")
      expect(paths).toContain("basePrice")
    }
    expect((await saveProductAction("rác")).ok).toBe(false)
    expect(createProduct).not.toHaveBeenCalled()
  })

  it("lỗi nghiệp vụ của service được trả kèm message và issues", async () => {
    const issues = [{ path: ["variants", 0, "sku"], message: "Trùng SKU" }]
    createProduct.mockRejectedValue(new AdminCatalogError("INVALID_INPUT", "Trùng SKU", issues))
    expect(await saveProductAction({ data: validProduct })).toEqual({ ok: false, message: "Trùng SKU", issues })
  })

  it("lỗi lạ được ném lại", async () => {
    createProduct.mockRejectedValue(new Error("boom"))
    await expect(saveProductAction({ data: validProduct })).rejects.toThrow("boom")
  })
})

describe("setProductActiveAction", () => {
  it("khách bị từ chối", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await setProductActiveAction("p1", false)).toEqual(NOT_ADMIN)
    expect(setProductActive).not.toHaveBeenCalled()
  })

  it("Admin: ẩn sản phẩm với { userId }", async () => {
    setProductActive.mockResolvedValue(undefined)
    const res = await setProductActiveAction("p1", false)
    expect(res.ok).toBe(true)
    expect(setProductActive).toHaveBeenCalledWith({ userId: "admin-1" }, "p1", false)
  })

  it("input sai thì không gọi service", async () => {
    expect((await setProductActiveAction({ bad: 1 }, true)).ok).toBe(false)
    expect((await setProductActiveAction("p1", "yes")).ok).toBe(false)
    expect(setProductActive).not.toHaveBeenCalled()
  })

  it("sản phẩm không tồn tại trả message của service", async () => {
    setProductActive.mockRejectedValue(new AdminCatalogError("PRODUCT_NOT_FOUND", "Sản phẩm không tồn tại"))
    expect(await setProductActiveAction("p1", true)).toMatchObject({ ok: false, message: "Sản phẩm không tồn tại" })
  })
})

describe("deleteProductAction", () => {
  it("khách bị từ chối", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await deleteProductAction("p1")).toEqual(NOT_ADMIN)
    expect(deleteProduct).not.toHaveBeenCalled()
  })

  it("Admin: xoá với { userId }", async () => {
    deleteProduct.mockResolvedValue(undefined)
    expect((await deleteProductAction("p1")).ok).toBe(true)
    expect(deleteProduct).toHaveBeenCalledWith({ userId: "admin-1" }, "p1")
  })

  it("input sai thì không gọi service", async () => {
    expect((await deleteProductAction("")).ok).toBe(false)
    expect(deleteProduct).not.toHaveBeenCalled()
  })

  it("sản phẩm đã có đơn: trả đúng lỗi kèm gợi ý ẩn", async () => {
    const msg = "Không thể xoá: sản phẩm đã có 2 dòng trong đơn hàng. Hãy ẩn sản phẩm thay vì xoá để giữ lịch sử đơn."
    deleteProduct.mockRejectedValue(new AdminCatalogError("PRODUCT_HAS_ORDERS", msg))
    expect(await deleteProductAction("p1")).toMatchObject({ ok: false, message: msg })
  })
})

describe("adjustStockAction", () => {
  it("khách bị từ chối", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await adjustStockAction([{ variantId: "v1", change: { delta: 5 } }])).toEqual(NOT_ADMIN)
    expect(adjustStock).not.toHaveBeenCalled()
  })

  it("Admin: cộng thêm và đặt lại từng biến thể, truyền { userId }", async () => {
    adjustStock.mockResolvedValue({})
    const res = await adjustStockAction([
      { variantId: "v1", change: { delta: 5 } },
      { variantId: "v2", change: { newStock: 0 } },
    ])
    expect(res.ok).toBe(true)
    expect(adjustStock).toHaveBeenNthCalledWith(1, { userId: "admin-1" }, "v1", { delta: 5 })
    expect(adjustStock).toHaveBeenNthCalledWith(2, { userId: "admin-1" }, "v2", { newStock: 0 })
  })

  it("input sai (rỗng, delta = 0, cả hai trường) thì không gọi service", async () => {
    expect((await adjustStockAction([])).ok).toBe(false)
    expect((await adjustStockAction([{ variantId: "v1", change: { delta: 0 } }])).ok).toBe(false)
    expect((await adjustStockAction([{ variantId: "v1", change: { delta: 1, newStock: 1 } }])).ok).toBe(false)
    expect((await adjustStockAction("x")).ok).toBe(false)
    expect(adjustStock).not.toHaveBeenCalled()
  })

  it("lỗi giữa chừng: dừng lại và báo số biến thể đã cập nhật", async () => {
    adjustStock.mockResolvedValueOnce({}).mockRejectedValueOnce(new AdminCatalogError("NEGATIVE_STOCK", "Không thể trừ 9: tồn kho hiện chỉ còn 2"))
    const res = await adjustStockAction([
      { variantId: "v1", change: { delta: 1 } },
      { variantId: "v2", change: { delta: -9 } },
      { variantId: "v3", change: { delta: 1 } },
    ])
    expect(res.ok).toBe(false)
    expect(res.message).toContain("tồn kho hiện chỉ còn 2")
    expect(res.message).toContain("1/3")
    expect(adjustStock).toHaveBeenCalledTimes(2)
  })
})
