import { beforeEach, describe, expect, it, vi } from "vitest"

const getAdminUser = vi.fn()
const replaceSizeChart = vi.fn()
const deleteSizeChartRows = vi.fn()

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
vi.mock("@/server/services/admin-size-chart.service", () => ({
  replaceSizeChart: (...a: unknown[]) => replaceSizeChart(...a),
  deleteSizeChartRows: (...a: unknown[]) => deleteSizeChartRows(...a),
}))

import { AdminCatalogError } from "@/server/services/admin-catalog.service"
import { deleteSizeChartRowsAction, replaceSizeChartAction } from "./admin-size-charts"

const DENIED = { ok: false, message: "Bạn không có quyền thực hiện thao tác này" }
const ADMIN = { id: "admin-1", role: "ADMIN" }
const row = (size: string, over: Record<string, unknown> = {}) => ({
  size,
  chest: 90,
  waist: 74,
  hip: 94,
  heightMin: 160,
  heightMax: 168,
  weightMin: 50,
  weightMax: 58,
  ...over,
})

beforeEach(() => {
  for (const f of [getAdminUser, replaceSizeChart, deleteSizeChartRows]) f.mockReset()
})

describe("replaceSizeChartAction", () => {
  it("khách / chưa đăng nhập bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await replaceSizeChartAction({ categoryId: "c1", brand: null, rows: [row("S")] })).toEqual(DENIED)
    expect(replaceSizeChart).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId }, danh mục, dòng và brand (rỗng = null)", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    replaceSizeChart.mockResolvedValue([])
    const rows = [row("S"), row("M", { chest: null })]
    const res = await replaceSizeChartAction({ categoryId: "c1", brand: "  ", rows })
    expect(res.ok).toBe(true)
    expect(replaceSizeChart).toHaveBeenCalledWith({ userId: "admin-1" }, "c1", rows, null)
  })

  it("số đo sai: không gọi service, trả issues theo ô", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    const res = await replaceSizeChartAction({ categoryId: "c1", brand: null, rows: [row("S"), row("M", { heightMin: 180 })] })
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.issues?.some((i) => i.path[0] === 1 && i.path[1] === "heightMax")).toBe(true)
    expect(replaceSizeChart).not.toHaveBeenCalled()
  })

  it("lỗi nghiệp vụ của service kèm issues được chuyển tiếp", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    const issues = [{ path: [0, "size"], message: "Trùng size S" }]
    replaceSizeChart.mockRejectedValue(new AdminCatalogError("INVALID_INPUT", "Trùng size S", issues))
    const res = await replaceSizeChartAction({ categoryId: "c1", brand: null, rows: [row("S")] })
    expect(res).toEqual({ ok: false, message: "Trùng size S", issues })
  })
})

describe("deleteSizeChartRowsAction", () => {
  it("khách bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await deleteSizeChartRowsAction({ categoryId: "c1", rowIds: ["r1"] })).toEqual(DENIED)
    expect(deleteSizeChartRows).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với { userId }, danh mục và id dòng", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    deleteSizeChartRows.mockResolvedValue(2)
    const res = await deleteSizeChartRowsAction({ categoryId: "c1", rowIds: ["r1", "r2"] })
    expect(res.ok).toBe(true)
    expect(deleteSizeChartRows).toHaveBeenCalledWith({ userId: "admin-1" }, "c1", ["r1", "r2"])
  })

  it("danh sách id rỗng thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await deleteSizeChartRowsAction({ categoryId: "c1", rowIds: [] })).ok).toBe(false)
    expect(deleteSizeChartRows).not.toHaveBeenCalled()
  })
})
