import { beforeEach, describe, expect, it, vi } from "vitest"

const getAdminUser = vi.fn()
const adminChangeOrderStatus = vi.fn()
const adminCancelOrder = vi.fn()
const markBankTransferPaid = vi.fn()

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/server/auth/admin", () => ({
  getAdminUser: () => getAdminUser(),
  NOT_ADMIN_MESSAGE: "Bạn không có quyền thực hiện thao tác này",
}))
vi.mock("@/server/services/admin-order.service", () => ({
  adminChangeOrderStatus: (...args: unknown[]) => adminChangeOrderStatus(...args),
  adminCancelOrder: (...args: unknown[]) => adminCancelOrder(...args),
  markBankTransferPaid: (...args: unknown[]) => markBankTransferPaid(...args),
}))
vi.mock("@/server/services/order.service", () => ({
  OrderError: class OrderError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message)
    }
  },
}))

import { OrderError } from "@/server/services/order.service"
import { advanceOrderAction, approveOrderAction, cancelOrderAction, markBankTransferPaidAction } from "./admin-orders"

const NOT_ADMIN = { ok: false, message: "Bạn không có quyền thực hiện thao tác này" }
const ADMIN = { id: "admin-1", role: "ADMIN" }

beforeEach(() => {
  getAdminUser.mockReset()
  adminChangeOrderStatus.mockReset()
  adminCancelOrder.mockReset()
  markBankTransferPaid.mockReset()
})

describe("approveOrderAction (quyền)", () => {
  it("khách / chưa đăng nhập bị từ chối và service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    const res = await approveOrderAction("order-1")
    expect(res).toEqual(NOT_ADMIN)
    expect(adminChangeOrderStatus).not.toHaveBeenCalled()
  })

  it("Admin hợp lệ: gọi service với actor là chính Admin và chuyển sang CONFIRMED", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    adminChangeOrderStatus.mockResolvedValue({})
    const res = await approveOrderAction("order-1")
    expect(res.ok).toBe(true)
    expect(adminChangeOrderStatus).toHaveBeenCalledWith({ userId: "admin-1" }, "order-1", "CONFIRMED")
  })

  it("input sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    const res = await approveOrderAction({ bad: true })
    expect(res.ok).toBe(false)
    expect(adminChangeOrderStatus).not.toHaveBeenCalled()
  })
})

describe("advanceOrderAction", () => {
  it("không phải Admin: bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await advanceOrderAction("order-1", "SHIPPING")).toEqual(NOT_ADMIN)
    expect(adminChangeOrderStatus).not.toHaveBeenCalled()
  })

  it("Admin: truyền đúng actor, đơn và trạng thái đích", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    adminChangeOrderStatus.mockResolvedValue({})
    const res = await advanceOrderAction("order-1", "SHIPPING")
    expect(res.ok).toBe(true)
    expect(adminChangeOrderStatus).toHaveBeenCalledWith({ userId: "admin-1" }, "order-1", "SHIPPING")
  })

  it("trạng thái đích không hợp lệ (vd CANCELLED) thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    const res = await advanceOrderAction("order-1", "CANCELLED")
    expect(res.ok).toBe(false)
    expect(adminChangeOrderStatus).not.toHaveBeenCalled()
  })

  it("OrderError được chuyển thành thông báo", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    adminChangeOrderStatus.mockRejectedValue(new OrderError("INVALID_STATUS_CHANGE", "Không thể chuyển trạng thái"))
    expect(await advanceOrderAction("order-1", "DELIVERED")).toEqual({ ok: false, message: "Không thể chuyển trạng thái" })
  })
})

describe("cancelOrderAction", () => {
  it("không phải Admin: bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await cancelOrderAction("order-1", "lý do")).toEqual(NOT_ADMIN)
    expect(adminCancelOrder).not.toHaveBeenCalled()
  })

  it("Admin: truyền actor và lý do đã trim", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    adminCancelOrder.mockResolvedValue({})
    const res = await cancelOrderAction("order-1", "  khách đổi ý ")
    expect(res.ok).toBe(true)
    expect(adminCancelOrder).toHaveBeenCalledWith({ userId: "admin-1" }, "order-1", "khách đổi ý")
  })

  it("lý do trống được bỏ qua", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    adminCancelOrder.mockResolvedValue({})
    await cancelOrderAction("order-1", "   ")
    expect(adminCancelOrder).toHaveBeenCalledWith({ userId: "admin-1" }, "order-1", undefined)
  })

  it("lý do quá dài hoặc id sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await cancelOrderAction("order-1", "x".repeat(201))).ok).toBe(false)
    expect((await cancelOrderAction({ bad: true })).ok).toBe(false)
    expect(adminCancelOrder).not.toHaveBeenCalled()
  })

  it("OrderError được chuyển thành thông báo", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    adminCancelOrder.mockRejectedValue(new OrderError("CANNOT_CANCEL", "Đơn không thể hủy"))
    expect(await cancelOrderAction("order-1")).toEqual({ ok: false, message: "Đơn không thể hủy" })
  })
})

describe("markBankTransferPaidAction", () => {
  it("không phải Admin: bị từ chối, service không được gọi", async () => {
    getAdminUser.mockResolvedValue(null)
    expect(await markBankTransferPaidAction("order-1")).toEqual(NOT_ADMIN)
    expect(markBankTransferPaid).not.toHaveBeenCalled()
  })

  it("Admin: truyền actor và id đơn", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    markBankTransferPaid.mockResolvedValue({})
    const res = await markBankTransferPaidAction("order-1")
    expect(res.ok).toBe(true)
    expect(markBankTransferPaid).toHaveBeenCalledWith({ userId: "admin-1" }, "order-1")
  })

  it("input sai thì không gọi service", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    expect((await markBankTransferPaidAction({ bad: true })).ok).toBe(false)
    expect(markBankTransferPaid).not.toHaveBeenCalled()
  })

  it("OrderError được chuyển thành thông báo", async () => {
    getAdminUser.mockResolvedValue(ADMIN)
    markBankTransferPaid.mockRejectedValue(new OrderError("CANNOT_PAY", "Đơn này đã được xác nhận thanh toán trước đó"))
    expect(await markBankTransferPaidAction("order-1")).toEqual({
      ok: false,
      message: "Đơn này đã được xác nhận thanh toán trước đó",
    })
  })
})
