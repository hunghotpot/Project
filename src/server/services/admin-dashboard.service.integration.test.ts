import { afterAll, describe, expect, it } from "vitest"
import { vnDateKey } from "@/lib/admin-dates"
import { db } from "@/server/db"
import { createFixtures } from "@/test/db-fixtures"
import { getDashboardStats } from "./admin-dashboard.service"

/*
 * Test tích hợp trên PostgreSQL thật. DB có thể đã có dữ liệu → so sánh CHÊNH LỆCH trước/sau khi thêm dữ liệu test.
 * Đơn tạo với createdAt = bây giờ nên rơi vào hôm nay / tuần này / tháng này (giờ VN).
 */

const fx = createFixtures()
let orderSeq = 0

afterAll(fx.cleanup)

type Pay = "PENDING" | "PAID" | "REFUNDED"

function makeOrder(
  userId: string,
  total: number,
  o: { status: "PENDING" | "DELIVERED" | "CANCELLED"; paymentMethod: "COD" | "VNPAY"; paymentStatus: Pay }
) {
  return db.order.create({
    data: {
      code: `T-${Date.now().toString(36)}-${++orderSeq}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      subtotal: total,
      shippingFee: 0,
      total,
      shippingAddress: {},
      ...o,
    },
  })
}

describe("getDashboardStats", () => {
  it("doanh thu = đơn PAID hoặc COD đã giao; bỏ đơn huỷ/hoàn tiền/chưa thu", async () => {
    const now = new Date()
    const before = await getDashboardStats(now)
    const { user } = await fx.makeBuyer([])

    await makeOrder(user.id, 1_000_000, { status: "PENDING", paymentMethod: "VNPAY", paymentStatus: "PAID" }) // tính
    await makeOrder(user.id, 200_000, { status: "DELIVERED", paymentMethod: "COD", paymentStatus: "PENDING" }) // tính (COD đã giao)
    await makeOrder(user.id, 300_000, { status: "PENDING", paymentMethod: "COD", paymentStatus: "PENDING" }) // chưa thu
    await makeOrder(user.id, 400_000, { status: "CANCELLED", paymentMethod: "VNPAY", paymentStatus: "PAID" }) // đã huỷ
    await makeOrder(user.id, 500_000, { status: "DELIVERED", paymentMethod: "VNPAY", paymentStatus: "REFUNDED" }) // hoàn tiền

    const after = await getDashboardStats(now)
    expect(after.revenue.total - before.revenue.total).toBe(1_200_000)
    expect(after.revenue.thisMonth - before.revenue.thisMonth).toBe(1_200_000)

    const todayKey = vnDateKey(now)
    const dayOf = (s: typeof after) => s.weeklyRevenue.find((d) => d.date === todayKey)
    expect(dayOf(after)).toBeDefined()
    expect(dayOf(after)!.revenue - dayOf(before)!.revenue).toBe(1_200_000)

    expect(after.weeklyRevenue).toHaveLength(7)
    expect(after.weeklyRevenue.map((d) => d.label)).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"])

    expect(after.orders.today - before.orders.today).toBe(5)
    expect(after.orders.pending - before.orders.pending).toBe(2)
    expect(after.customers.total - before.customers.total).toBe(1)
    expect(after.customers.newThisMonth - before.customers.newThisMonth).toBe(1)

    expect(after.pendingOrders.length).toBeLessThanOrEqual(5)
    expect(after.pendingOrders.every((o) => o.status === "PENDING")).toBe(true)
    // Hai đơn PENDING vừa tạo là mới nhất → nằm trong danh sách, kèm tên khách.
    expect(after.pendingOrders.filter((o) => o.customerName === "Người Mua Thử").length).toBeGreaterThanOrEqual(2)
  })

  it("tồn kho thấp: đếm biến thể sắp hết / hết hàng", async () => {
    const before = await getDashboardStats()
    await fx.makeVariant(3)
    await fx.makeVariant(0)
    await fx.makeVariant(500)
    const after = await getDashboardStats()

    expect(after.stock.lowCount - before.stock.lowCount).toBe(1)
    expect(after.stock.outOfStockCount - before.stock.outOfStockCount).toBe(1)
    expect(after.stock.lowItems.length).toBeLessThanOrEqual(5)
    for (const item of after.stock.lowItems) {
      expect(item.stock).toBeLessThanOrEqual(after.stock.threshold)
      expect(item.status).toBe(item.stock <= 0 ? "OUT" : "LOW")
    }
  })
})
