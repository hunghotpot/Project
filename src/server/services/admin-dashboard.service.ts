import "server-only"
import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client"
import { adminDateRanges, addVnDays, percentChange, vnDateKey, WEEKDAY_LABELS } from "@/lib/admin-dates"
import { LOW_STOCK_THRESHOLD, stockStatus, type StockStatus } from "@/lib/inventory"
import { db } from "@/server/db"

/*
 * Thống kê trang Tổng quan của Admin. Service không kiểm quyền (Server Action/route gọi requireAdmin() trước).
 *
 * ĐỊNH NGHĨA DOANH THU: tổng `Order.total` (VND, gồm phí vận chuyển) của các đơn
 *   - có paymentStatus = PAID, HOẶC là đơn COD đã giao (status = DELIVERED, coi như đã thu tiền mặt);
 *   - và KHÔNG phải đơn CANCELLED, KHÔNG phải paymentStatus = REFUNDED.
 * Doanh thu được tính vào kỳ theo `Order.createdAt` (schema chưa có cột paidAt/deliveredAt), tính theo giờ Asia/Ho_Chi_Minh.
 * Mốc "hôm nay / tuần này (T2…CN) / tháng này" xem src/lib/admin-dates.ts.
 */

const REVENUE_WHERE: Prisma.OrderWhereInput = {
  status: { not: "CANCELLED" },
  paymentStatus: { not: "REFUNDED" },
  OR: [{ paymentStatus: "PAID" }, { paymentMethod: "COD", status: "DELIVERED" }],
}

const LOW_STOCK_LIST_SIZE = 5
const PENDING_ORDER_LIST_SIZE = 5

export interface DashboardStats {
  revenue: {
    total: number
    thisMonth: number
    /** % so với tháng trước; null nếu tháng trước chưa có doanh thu. */
    monthChangePct: number | null
  }
  orders: {
    today: number
    /** % so với hôm qua; null nếu hôm qua không có đơn. */
    todayChangePct: number | null
    /** Tổng số đơn đang chờ xử lý (PENDING). */
    pending: number
  }
  customers: {
    total: number
    newThisMonth: number
  }
  stock: {
    /** Số biến thể (sản phẩm đang bán) còn 1…LOW_STOCK_THRESHOLD: thẻ "Cảnh báo tồn kho". */
    lowCount: number
    outOfStockCount: number
    threshold: number
    /** Các biến thể ít hàng nhất (gồm cả hết hàng), tối đa 5. */
    lowItems: LowStockItem[]
  }
  /** 7 ngày của tuần hiện tại, T2 → CN (ngày chưa tới có revenue = 0). */
  weeklyRevenue: { date: string; label: string; revenue: number }[]
  pendingOrders: PendingOrderItem[]
}

export interface LowStockItem {
  variantId: string
  productId: string
  productName: string
  sku: string
  size: string
  color: string
  stock: number
  status: StockStatus
}

export interface PendingOrderItem {
  id: string
  code: string
  customerName: string
  itemCount: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  status: OrderStatus
  createdAt: Date
}

async function revenueBetween(from?: Date, to?: Date): Promise<number> {
  const range: Prisma.OrderWhereInput = from && to ? { createdAt: { gte: from, lt: to } } : {}
  const r = await db.order.aggregate({ where: { AND: [REVENUE_WHERE, range] }, _sum: { total: true } })
  return r._sum.total ?? 0
}

const countOrdersBetween = (from: Date, to: Date) => db.order.count({ where: { createdAt: { gte: from, lt: to } } })

export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const r = adminDateRanges(now)
  const activeVariant: Prisma.ProductVariantWhereInput = { product: { isActive: true } }

  const weekDays = WEEKDAY_LABELS.map((label, i) => {
    const start = addVnDays(r.weekStart, i)
    return { label, start, end: addVnDays(start, 1) }
  })

  const [
    revenueTotal,
    revenueMonth,
    revenuePrevMonth,
    ordersToday,
    ordersYesterday,
    pendingCount,
    totalCustomers,
    newCustomers,
    lowCount,
    outCount,
    lowVariants,
    pendingOrders,
    weekRevenue,
  ] = await Promise.all([
    revenueBetween(),
    revenueBetween(r.monthStart, r.nextMonthStart),
    revenueBetween(r.prevMonthStart, r.monthStart),
    countOrdersBetween(r.todayStart, r.tomorrowStart),
    countOrdersBetween(r.yesterdayStart, r.todayStart),
    db.order.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: r.monthStart } } }),
    db.productVariant.count({ where: { ...activeVariant, stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
    db.productVariant.count({ where: { ...activeVariant, stock: { lte: 0 } } }),
    db.productVariant.findMany({
      where: { ...activeVariant, stock: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: [{ stock: "asc" }, { sku: "asc" }],
      take: LOW_STOCK_LIST_SIZE,
      select: { id: true, sku: true, size: true, color: true, stock: true, product: { select: { id: true, name: true } } },
    }),
    db.order.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: PENDING_ORDER_LIST_SIZE,
      select: {
        id: true,
        code: true,
        total: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt: true,
        user: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    Promise.all(weekDays.map((d) => revenueBetween(d.start, d.end))),
  ])

  return {
    revenue: {
      total: revenueTotal,
      thisMonth: revenueMonth,
      monthChangePct: percentChange(revenueMonth, revenuePrevMonth),
    },
    orders: { today: ordersToday, todayChangePct: percentChange(ordersToday, ordersYesterday), pending: pendingCount },
    customers: { total: totalCustomers, newThisMonth: newCustomers },
    stock: {
      lowCount,
      outOfStockCount: outCount,
      threshold: LOW_STOCK_THRESHOLD,
      lowItems: lowVariants.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productName: v.product.name,
        sku: v.sku,
        size: v.size,
        color: v.color,
        stock: v.stock,
        status: stockStatus(v.stock),
      })),
    },
    weeklyRevenue: weekDays.map((d, i) => ({ date: vnDateKey(d.start), label: d.label, revenue: weekRevenue[i] })),
    pendingOrders: pendingOrders.map((o) => ({
      id: o.id,
      code: o.code,
      customerName: o.user.name,
      itemCount: o._count.items,
      total: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status: o.status,
      createdAt: o.createdAt,
    })),
  }
}
