import "server-only"
import bcrypt from "bcryptjs"
import type { OrderStatus, Prisma, UserStatus } from "@prisma/client"
import { startOfVnMonth } from "@/lib/admin-dates"
import { customerTier, VIP_SPEND_THRESHOLD, type CustomerTier } from "@/lib/customer-tier"
import {
  createCustomerSchema,
  customerIdSchema,
  customerListFilterSchema,
  type CreateCustomerInput,
  type CustomerListFilterInput,
} from "@/lib/validators/admin-customer"
import { db } from "@/server/db"

/*
 * Nghiệp vụ Admin → Khách hàng. Không đọc cookie và không tự kiểm quyền: Server Action/route phải gọi requireAdmin()
 * rồi truyền `admin: { userId }` vào.
 *
 * "Số đơn" và "tổng chi tiêu" chỉ tính các đơn KHÔNG bị huỷ (status != CANCELLED). Hạng VIP/Thành viên suy ra từ
 * tổng chi tiêu (xem src/lib/customer-tier.ts), không lưu trong DB.
 */

const BCRYPT_COST = 10 // giống auth.service
const NOT_CANCELLED = { not: "CANCELLED" } as const satisfies { not: OrderStatus }

export type AdminCustomerErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "NOT_A_CUSTOMER"
  | "CANNOT_LOCK_SELF"
  | "EMAIL_TAKEN"

export class AdminCustomerError extends Error {
  constructor(
    public readonly code: AdminCustomerErrorCode,
    message: string,
    /** Tên field của form để hiện lỗi đúng ô (nếu có). */
    public readonly field?: string
  ) {
    super(message)
    this.name = "AdminCustomerError"
  }
}

export interface AdminContext {
  userId: string
}

export interface CustomerListItem {
  id: string
  name: string
  /** Chữ cái đầu của tên (avatar). */
  initial: string
  email: string
  phone: string | null
  tier: CustomerTier
  orderCount: number
  /** VND, chỉ đơn không huỷ. */
  totalSpend: number
  status: UserStatus
  createdAt: Date
}

export interface CustomerListResult {
  items: CustomerListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CustomerSummary {
  totalCustomers: number
  /** Khách đăng ký từ đầu tháng này (giờ VN). */
  newThisMonth: number
  vipCount: number
  /** Khách có ≥ 2 đơn không huỷ / khách có ≥ 1 đơn không huỷ, tính theo %, làm tròn 1 chữ số. 0 nếu chưa ai mua. */
  repurchaseRate: number
}

export interface CustomerDetail extends CustomerListItem {
  addresses: {
    id: string
    fullName: string
    phone: string
    street: string
    ward: string
    district: string
    province: string
    isDefault: boolean
  }[]
  recentOrders: {
    id: string
    code: string
    status: OrderStatus
    total: number
    createdAt: Date
  }[]
}

function toListItem(
  u: { id: string; name: string; email: string; phone: string | null; status: UserStatus; createdAt: Date },
  stats: { orderCount: number; totalSpend: number } | undefined
): CustomerListItem {
  const totalSpend = stats?.totalSpend ?? 0
  return {
    id: u.id,
    name: u.name,
    initial: u.name.trim().charAt(0).toUpperCase(),
    email: u.email,
    phone: u.phone,
    tier: customerTier(totalSpend),
    orderCount: stats?.orderCount ?? 0,
    totalSpend,
    status: u.status,
    createdAt: u.createdAt,
  }
}

/** Số đơn + tổng chi tiêu (đơn không huỷ) cho đúng nhóm user — một câu truy vấn gom, không N+1. */
async function orderStatsFor(userIds: string[]): Promise<Map<string, { orderCount: number; totalSpend: number }>> {
  const map = new Map<string, { orderCount: number; totalSpend: number }>()
  if (userIds.length === 0) return map
  const rows = await db.order.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: NOT_CANCELLED },
    _count: { _all: true },
    _sum: { total: true },
  })
  for (const r of rows) map.set(r.userId, { orderCount: r._count._all, totalSpend: r._sum.total ?? 0 })
  return map
}

/** Id khách có tổng chi tiêu ≥ ngưỡng VIP (nhóm nhỏ nên đưa vào mệnh đề in/notIn được). */
async function vipCustomerIds(): Promise<string[]> {
  const rows = await db.order.groupBy({
    by: ["userId"],
    where: { status: NOT_CANCELLED, user: { role: "CUSTOMER" } },
    _sum: { total: true },
    having: { total: { _sum: { gte: VIP_SPEND_THRESHOLD } } },
  })
  return rows.map((r) => r.userId)
}

export async function listCustomers(input: CustomerListFilterInput = {}): Promise<CustomerListResult> {
  const { filter, q, page, pageSize } = customerListFilterSchema.parse(input)

  const where: Prisma.UserWhereInput = { role: "CUSTOMER" }
  if (filter === "locked") where.status = "LOCKED"
  if (filter === "vip") where.id = { in: await vipCustomerIds() }
  if (filter === "member") where.id = { notIn: await vipCustomerIds() }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ]
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
    }),
  ])
  const stats = await orderStatsFor(users.map((u) => u.id))

  return {
    items: users.map((u) => toListItem(u, stats.get(u.id))),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function getCustomerSummary(now = new Date()): Promise<CustomerSummary> {
  const monthStart = startOfVnMonth(now)
  const [totalCustomers, newThisMonth, buyers] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }),
    db.user.count({ where: { role: "CUSTOMER", createdAt: { gte: monthStart } } }),
    db.$queryRaw<{ buyers: number; repeaters: number; vip: number }[]>`
      SELECT COUNT(*)::int AS buyers,
             COUNT(*) FILTER (WHERE t.cnt >= 2)::int AS repeaters,
             COUNT(*) FILTER (WHERE t.spend >= ${VIP_SPEND_THRESHOLD}::bigint)::int AS vip
      FROM (
        SELECT o."userId", COUNT(*) AS cnt, SUM(o."total") AS spend
        FROM "Order" o
        JOIN "User" u ON u."id" = o."userId"
        WHERE u."role" = 'CUSTOMER' AND o."status" <> 'CANCELLED'
        GROUP BY o."userId"
      ) t`,
  ])
  const { buyers: buyerCount, repeaters, vip } = buyers[0] ?? { buyers: 0, repeaters: 0, vip: 0 }
  return {
    totalCustomers,
    newThisMonth,
    vipCount: vip,
    repurchaseRate: buyerCount === 0 ? 0 : Math.round((repeaters / buyerCount) * 1000) / 10,
  }
}

export async function getCustomerDetail(userId: string): Promise<CustomerDetail> {
  const id = customerIdSchema.parse(userId)
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: { id: true, fullName: true, phone: true, street: true, ward: true, district: true, province: true, isDefault: true },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, code: true, status: true, total: true, createdAt: true },
      },
    },
  })
  if (!user) throw notFound()
  if (user.role !== "CUSTOMER") throw notACustomer()

  const stats = (await orderStatsFor([id])).get(id)
  return { ...toListItem(user, stats), addresses: user.addresses, recentOrders: user.orders }
}

const notFound = () => new AdminCustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng")
const notACustomer = () => new AdminCustomerError("NOT_A_CUSTOMER", "Tài khoản này không phải khách hàng")

async function requireCustomer(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
  if (!user) throw notFound()
  if (user.role !== "CUSTOMER") throw notACustomer()
}

/** Khoá tài khoản khách: đổi status và thu hồi mọi refresh token trong cùng một transaction. Khoá lại tài khoản đã khoá là no-op an toàn. */
export async function lockCustomer(admin: AdminContext, userId: string): Promise<void> {
  const id = customerIdSchema.parse(userId)
  if (id === admin.userId) {
    throw new AdminCustomerError("CANNOT_LOCK_SELF", "Bạn không thể khoá chính tài khoản của mình")
  }
  await requireCustomer(id)
  await db.$transaction([
    db.user.update({ where: { id }, data: { status: "LOCKED" } }),
    db.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ])
}

/** Mở khoá: chỉ đổi status về ACTIVE (token đã thu hồi không được khôi phục, khách phải đăng nhập lại). */
export async function unlockCustomer(admin: AdminContext, userId: string): Promise<void> {
  void admin // chưa ghi nhật ký thao tác; giữ tham số để chữ ký thống nhất với lockCustomer
  const id = customerIdSchema.parse(userId)
  await requireCustomer(id)
  await db.user.update({ where: { id }, data: { status: "ACTIVE" } })
}

/**
 * Admin tạo tài khoản CUSTOMER thật (mật khẩu tạm do Admin đặt). KHÔNG phát hành token/phiên: khách tự đăng nhập sau.
 */
export async function createCustomerByAdmin(input: CreateCustomerInput): Promise<CustomerListItem> {
  const data = createCustomerSchema.parse(input)
  const taken = () => new AdminCustomerError("EMAIL_TAKEN", "Email này đã được đăng ký", "email")

  if (await db.user.findUnique({ where: { email: data.email }, select: { id: true } })) throw taken()

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST)
  try {
    const user = await db.user.create({
      data: { email: data.email, name: data.name, phone: data.phone, passwordHash, role: "CUSTOMER", status: "ACTIVE" },
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
    })
    return toListItem(user, undefined)
  } catch (e) {
    // Hai request cùng email chạy song song: unique index là chốt chặn cuối.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") throw taken()
    throw e
  }
}
