import { beforeEach, describe, expect, it, vi } from "vitest"

const getAdminUser = vi.fn()
const createCategory = vi.fn()
const updateCategory = vi.fn()
const deleteCategory = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/server/auth/admin", () => ({
  getAdminUser: () => getAdminUser(),
  NOT_ADMIN_MESSAGE: "Bạn không có quyền thực hiện thao tác này",
}))
vi.mock("@/server/services/admin-catalog.service", () => ({
  AdminCatalogError: class AdminCatalogError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message)
    }
  },
}))
vi.mock("@/server/services/admin-category.service", () => ({
  createCategory: (...a: unknown[]) => createCategory(...a),
  updateCategory: (...a: unknown[]) => updateCategory(...a),
  deleteCategory: (...a: unknown[]) => deleteCategory(...a),
}))

import { AdminCatalogError } from "@/server/services/admin-catalog.service"
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "./admin-categories"

const DENIED = { ok: false, message: "Bạn không có quyền thực hiện thao tác này" }
const ADMIN = { id: "admin-1", role: "ADMIN" }

beforeEach(() => {
  for (const f of [getAdminUser, createCategory, updateCategory, deleteCategory]) f.mockReset()
})

describe("createCategoryAction", () => {
  it("khách / chưa đăng nhập bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await createCategoryAction({ name: "Áo polo" })).toEqual(DENIED)
    expect(createCategory).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId } và input gốc", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    createCategory.mockResolvedValue({})
    const input = { name: "Áo polo", description: "Cổ bẻ", parentId: "cat-1" }
    const res = await createCategoryAction(input)
    expect(res.ok).toBe(true)
    expect(createCategory).toHaveBeenCalledWith({ userId: "admin-1" }, input)
  })

  it("input sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    const res = await createCategoryAction({ name: "A" })
    expect(res.ok).toBe(false)
    expect(createCategory).not.toHaveBeenCalled()
  })

  it("lỗi nghiệp vụ được trả về dưới dạng message", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    createCategory.mockRejectedValue(new AdminCatalogError("CATEGORY_TOO_DEEP", "Tối đa 2 cấp"))
    expect(await createCategoryAction({ name: "Áo polo", parentId: "x" })).toEqual({ ok: false, message: "Tối đa 2 cấp" })
  })
})

describe("updateCategoryAction", () => {
  it("khách bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await updateCategoryAction("cat-1", { name: "Áo mới" })).toEqual(DENIED)
    expect(updateCategory).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId }, id và input", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    updateCategory.mockResolvedValue({})
    const res = await updateCategoryAction("cat-1", { name: "Áo mới", description: null })
    expect(res.ok).toBe(true)
    expect(updateCategory).toHaveBeenCalledWith({ userId: "admin-1" }, "cat-1", { name: "Áo mới", description: null })
  })

  it("input sai (id hoặc dữ liệu rỗng) thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await updateCategoryAction({ bad: true }, { name: "Áo mới" })).ok).toBe(false)
    expect((await updateCategoryAction("cat-1", {})).ok).toBe(false)
    expect(updateCategory).not.toHaveBeenCalled()
  })
})

describe("deleteCategoryAction", () => {
  it("khách bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await deleteCategoryAction("cat-1")).toEqual(DENIED)
    expect(deleteCategory).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId } và id", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    deleteCategory.mockResolvedValue(undefined)
    expect((await deleteCategoryAction("cat-1")).ok).toBe(true)
    expect(deleteCategory).toHaveBeenCalledWith({ userId: "admin-1" }, "cat-1")
  })

  it("còn con / còn sản phẩm: trả đúng thông báo của service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    deleteCategory.mockRejectedValue(new AdminCatalogError("CATEGORY_HAS_PRODUCTS", 'Không thể xoá "Áo": còn 3 sản phẩm.'))
    expect(await deleteCategoryAction("cat-1")).toEqual({ ok: false, message: 'Không thể xoá "Áo": còn 3 sản phẩm.' })
  })

  it("id sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await deleteCategoryAction("")).ok).toBe(false)
    expect(deleteCategory).not.toHaveBeenCalled()
  })
})
