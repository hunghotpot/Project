import "server-only"
import type { PaymentStatus, Prisma } from "@prisma/client"
import {
  formatOrderCode,
  orderDayKey,
  SUPPORTED_PAYMENT_METHODS,
  type CheckoutPaymentMethod,
} from "@/lib/order"
import { calculateShippingFee } from "@/lib/shipping"
import type { AddressInput } from "@/lib/validators/auth"
import { orderListFilterSchema, type OrderListFilterInput } from "@/lib/validators/order-list"
import { db } from "@/server/db"
import { addItemsClamped } from "@/server/services/cart.service"
import type {
  OrderAddressSnapshot,
  OrderDetail,
  OrderDetailView,
  OrderHistoryView,
  OrderItemView,
  OrderListItem,
  OrderListResult,
  OrderStatusValue,
  OrderSummary,
  ReorderResult,
  StockShortage,
} from "@/types/order"

/*
 * Đơn hàng. Hàm nhận `user` làm tham số, không đọc cookie/headers (AI tool-calling gọi lại được).
 * createOrder / cancelOrder chạy trọn trong MỘT transaction: lỗi ở bất kỳ bước nào thì mọi thay đổi (trừ kho, tạo đơn,
 * xoá giỏ) đều được hoàn tác.
 */

export type OrderErrorCode =
  | "EMPTY_CART"
  | "ADDRESS_NOT_FOUND"
  | "PAYMENT_METHOD_UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "ORDER_NOT_FOUND"
  | "CANNOT_CANCEL"
  | "CANNOT_PAY"
  | "PAYMENT_EXPIRED"
  | "INVALID_STATUS_CHANGE"

export class OrderError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    message: string,
    /** OUT_OF_STOCK: danh sách dòng không đủ hàng. */
    public readonly shortages?: StockShortage[]
  ) {
    super(message)
    this.name = "OrderError"
  }
}

export interface CreateOrderInput {
  /** Địa chỉ trong sổ địa chỉ của user… */
  addressId?: string
  /** …hoặc địa chỉ mới (được lưu vào sổ địa chỉ). Đúng một trong hai. */
  newAddress?: AddressInput
  paymentMethod: CheckoutPaymentMethod
  note?: string
}

export type Db = Prisma.TransactionClient

/** Người thực hiện thay đổi trạng thái: khách/admin (có userId) hoặc hệ thống (job, cổng thanh toán). */
export type OrderActor = { type: "CUSTOMER" | "ADMIN"; userId: string } | { type: "SYSTEM" }

/** Ghi một dòng nhật ký đổi trạng thái. Luôn gọi TRONG cùng transaction với lần đổi để hai thứ không lệch nhau. */
export async function recordStatusChange(
  tx: Db,
  orderId: string,
  from: OrderStatusValue | null,
  to: OrderStatusValue,
  actor: OrderActor,
  note?: string | null
): Promise<void> {
  await tx.orderStatusHistory.create({
    data: {
      orderId,
      fromStatus: from,
      toStatus: to,
      actorType: actor.type,
      actorUserId: actor.type === "SYSTEM" ? null : actor.userId,
      note: note ?? null,
    },
  })
}

const lineSelect = {
  variantId: true,
  quantity: true,
  variant: {
    select: {
      sku: true,
      size: true,
      color: true,
      price: true,
      product: { select: { name: true, isActive: true } },
    },
  },
} satisfies Prisma.CartItemSelect

const detailSelect = {
  id: true,
  code: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  createdAt: true,
  subtotal: true,
  shippingFee: true,
  total: true,
  note: true,
  shippingAddress: true,
  items: {
    orderBy: { id: "asc" },
    select: { productName: true, size: true, color: true, unitPrice: true, quantity: true },
  },
} satisfies Prisma.OrderSelect

type DetailRow = Prisma.OrderGetPayload<{ select: typeof detailSelect }>

function toDetail(o: DetailRow): OrderDetail {
  return { ...o, shippingAddress: o.shippingAddress as unknown as OrderAddressSnapshot }
}

async function resolveAddress(tx: Db, userId: string, input: CreateOrderInput): Promise<OrderAddressSnapshot> {
  const pick = (a: OrderAddressSnapshot): OrderAddressSnapshot => ({
    fullName: a.fullName,
    phone: a.phone,
    street: a.street,
    ward: a.ward,
    district: a.district,
    province: a.province,
  })

  if (input.addressId) {
    const saved = await tx.address.findFirst({ where: { id: input.addressId, userId } })
    if (!saved) throw new OrderError("ADDRESS_NOT_FOUND", "Không tìm thấy địa chỉ nhận hàng")
    return pick(saved)
  }
  if (input.newAddress) {
    const { isDefault, ...fields } = input.newAddress
    const count = await tx.address.count({ where: { userId } })
    const makeDefault = isDefault || count === 0
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    await tx.address.create({ data: { ...fields, isDefault: makeDefault, userId } })
    return pick(fields)
  }
  throw new OrderError("ADDRESS_NOT_FOUND", "Vui lòng chọn địa chỉ nhận hàng")
}

/**
 * Đặt hàng từ giỏ của user. Trong một transaction:
 * 1. đọc giỏ, kiểm tra địa chỉ;
 * 2. với từng dòng: `updateMany({ stock >= qty }, decrement)` — câu lệnh nguyên tử nên hai người mua cùng lúc
 *    biến thể còn 1 sản phẩm thì chỉ một bên trừ được (bên kia nhận count = 0);
 * 3. nếu có dòng thiếu hàng → ném OUT_OF_STOCK kèm danh sách (transaction rollback, giỏ giữ nguyên);
 * 4. tạo Order + OrderItem (snapshot giá/tên/size/màu), cấp mã đơn, xoá giỏ.
 */
export async function createOrder(user: { id: string }, input: CreateOrderInput): Promise<OrderDetail> {
  if (!SUPPORTED_PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new OrderError("PAYMENT_METHOD_UNAVAILABLE", "Phương thức thanh toán này chưa được hỗ trợ")
  }

  const orderId = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({ where: { userId: user.id }, select: { id: true } })
    const lines = cart ? await tx.cartItem.findMany({ where: { cartId: cart.id }, select: lineSelect }) : []
    if (!cart || lines.length === 0) throw new OrderError("EMPTY_CART", "Giỏ hàng của bạn đang trống")

    const shippingAddress = await resolveAddress(tx, user.id, input)

    // Trừ kho theo thứ tự id cố định: các đơn tranh nhau nhiều biến thể khoá hàng cùng thứ tự → không deadlock.
    lines.sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0))
    const shortages: StockShortage[] = []
    for (const l of lines) {
      let deducted = false
      if (l.variant.product.isActive) {
        const res = await tx.productVariant.updateMany({
          where: { id: l.variantId, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        })
        deducted = res.count === 1
      }
      if (!deducted) {
        const fresh = l.variant.product.isActive
          ? await tx.productVariant.findUnique({ where: { id: l.variantId }, select: { stock: true } })
          : null
        shortages.push({
          variantId: l.variantId,
          productName: l.variant.product.name,
          size: l.variant.size,
          color: l.variant.color,
          requested: l.quantity,
          available: fresh?.stock ?? 0,
        })
      }
    }
    if (shortages.length > 0) {
      throw new OrderError(
        "OUT_OF_STOCK",
        `Một số sản phẩm không đủ hàng: ${shortages.map((s) => s.productName).join(", ")}`,
        shortages
      )
    }

    const subtotal = lines.reduce((sum, l) => sum + l.variant.price * l.quantity, 0)
    const shippingFee = calculateShippingFee(subtotal)

    const day = orderDayKey(new Date())
    const seq = await tx.orderSequence.upsert({
      where: { day },
      create: { day, last: 1 },
      update: { last: { increment: 1 } },
      select: { last: true },
    })

    const order = await tx.order.create({
      data: {
        code: formatOrderCode(day, seq.last),
        userId: user.id,
        subtotal,
        shippingFee,
        total: subtotal + shippingFee,
        note: input.note ?? null,
        shippingAddress: { ...shippingAddress },
        paymentMethod: input.paymentMethod,
        statusHistory: {
          create: { fromStatus: null, toStatus: "PENDING", actorType: "CUSTOMER", actorUserId: user.id, note: "Đặt hàng" },
        },
        items: {
          create: lines.map((l) => ({
            variantId: l.variantId,
            productName: l.variant.product.name,
            sku: l.variant.sku,
            size: l.variant.size,
            color: l.variant.color,
            unitPrice: l.variant.price,
            quantity: l.quantity,
          })),
        },
      },
      select: { id: true },
    })

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    return order.id
  })

  const created = await getOrder(user.id, orderId)
  return created!
}

/**
 * Lõi huỷ đơn: đổi trạng thái + hoàn tồn kho trong MỘT transaction.
 * Điều kiện trạng thái (và `paymentIn` nếu có) nằm ngay trong câu UPDATE nên hai lần huỷ đồng thời chỉ một lần hoàn kho,
 * và job hết hạn không thể huỷ đơn vừa được thanh toán xong.
 */
export async function cancelOrderCore(
  orderId: string,
  scope: {
    userId?: string
    paymentIn?: PaymentStatus[]
    markPaymentFailed?: boolean
    actor: OrderActor
    note?: string | null
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Quyền: khi có userId thì chỉ chủ đơn mới tìm thấy đơn (người khác nhận ORDER_NOT_FOUND, không lộ sự tồn tại).
    const order = await tx.order.findFirst({
      where: { id: orderId, ...(scope.userId ? { userId: scope.userId } : {}) },
      select: { id: true, items: { select: { variantId: true, quantity: true } } },
    })
    if (!order) throw new OrderError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng")

    // Khoá dòng đơn rồi đọc trạng thái hiện tại: IPN/đổi trạng thái đồng thời phải chờ, và "fromStatus" ghi vào lịch sử luôn đúng.
    const [locked] = await tx.$queryRaw<{ status: OrderStatusValue }[]>`SELECT "status" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`
    const fromStatus = locked.status

    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        ...(scope.paymentIn ? { paymentStatus: { in: scope.paymentIn } } : {}),
      },
      data: { status: "CANCELLED" },
    })
    if (claimed.count === 0) {
      throw new OrderError("CANNOT_CANCEL", "Chỉ huỷ được đơn đang chờ xác nhận hoặc đã xác nhận")
    }
    await tx.order.updateMany({ where: { id: order.id, paymentStatus: "PAID" }, data: { paymentStatus: "REFUNDED" } })
    if (scope.markPaymentFailed) {
      await tx.order.updateMany({ where: { id: order.id, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } })
    }
    await recordStatusChange(tx, order.id, fromStatus, "CANCELLED", scope.actor, scope.note)

    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.updateMany({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }
  })
}

/** Chủ đơn huỷ đơn khi còn PENDING/CONFIRMED: hoàn tồn kho + ghi lịch sử (kèm lý do) — cùng một transaction. */
export async function cancelOrder(user: { id: string }, orderId: string, reason?: string): Promise<OrderDetail> {
  await cancelOrderCore(orderId, { userId: user.id, actor: { type: "CUSTOMER", userId: user.id }, note: reason })
  return (await getOrder(user.id, orderId))!
}

// Luồng trạng thái hợp lệ (huỷ đi qua cancelOrder, không nằm ở đây).
const NEXT_STATUS: Partial<Record<OrderStatusValue, OrderStatusValue>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "SHIPPING",
  SHIPPING: "DELIVERED",
}

/**
 * Chuyển đơn sang bước kế tiếp (PENDING→CONFIRMED→SHIPPING→DELIVERED) và ghi lịch sử. Dành cho admin/hệ thống
 * (chưa có giao diện admin). Không nhảy cóc và không đi lùi.
 */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatusValue,
  actor: OrderActor,
  note?: string
): Promise<void> {
  const from = (Object.keys(NEXT_STATUS) as OrderStatusValue[]).find((s) => NEXT_STATUS[s] === to)
  if (!from) throw new OrderError("INVALID_STATUS_CHANGE", `Không thể chuyển đơn sang trạng thái ${to}`)

  await db.$transaction(async (tx) => {
    // Điều kiện trạng thái hiện tại nằm trong câu UPDATE: hai lần đổi đồng thời chỉ một lần thành công.
    const res = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to } })
    if (res.count === 0) {
      const exists = await tx.order.count({ where: { id: orderId } })
      throw exists
        ? new OrderError("INVALID_STATUS_CHANGE", `Đơn không ở trạng thái ${from} nên không chuyển được sang ${to}`)
        : new OrderError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng")
    }
    await recordStatusChange(tx, orderId, from, to, actor, note)
  })
}

/**
 * Huỷ đơn quá hạn thanh toán (dùng cho job, không gắn với user). Chỉ huỷ khi tiền CHƯA về (payment PENDING/FAILED);
 * ném CANNOT_CANCEL nếu đơn đã được thanh toán/huỷ trong lúc chờ → người gọi bỏ qua.
 */
export async function cancelExpiredOrder(orderId: string): Promise<void> {
  await cancelOrderCore(orderId, {
    paymentIn: ["PENDING", "FAILED"],
    markPaymentFailed: true,
    actor: { type: "SYSTEM" },
    note: "Quá hạn thanh toán",
  })
}

export async function getOrder(userId: string, orderId: string): Promise<OrderDetail | null> {
  const row = await db.order.findFirst({ where: { id: orderId, userId }, select: detailSelect })
  return row ? toDetail(row) : null
}

export async function listRecentOrders(userId: string, limit = 5): Promise<OrderSummary[]> {
  // 1 query đơn + 1 query IN cho items của cả danh sách (không N+1).
  const rows = await db.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      code: true,
      createdAt: true,
      total: true,
      status: true,
      items: { orderBy: { id: "asc" }, select: { productName: true, quantity: true } },
    },
  })

  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    createdAt: o.createdAt,
    total: o.total,
    status: o.status as OrderStatusValue,
    firstProductName: o.items[0]?.productName ?? "—",
    otherLines: Math.max(o.items.length - 1, 0),
    quantity: o.items.reduce((sum, i) => sum + i.quantity, 0),
  }))
}

export async function countOrders(userId: string): Promise<number> {
  return db.order.count({ where: { userId } })
}

const itemViewSelect = {
  variantId: true,
  productName: true,
  size: true,
  color: true,
  unitPrice: true,
  quantity: true,
  variant: {
    select: {
      stock: true,
      product: {
        select: { slug: true, isActive: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } } },
      },
    },
  },
} satisfies Prisma.OrderItemSelect

type ItemViewRow = Prisma.OrderItemGetPayload<{ select: typeof itemViewSelect }>

function toItemView(i: ItemViewRow): OrderItemView {
  const v = i.variant
  return {
    variantId: i.variantId,
    productName: i.productName,
    size: i.size,
    color: i.color,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    image: v?.product.images[0] ?? null,
    slug: v?.product.slug ?? null,
    inStock: !!v && v.product.isActive && v.stock >= i.quantity,
  }
}

/**
 * Danh sách đơn của user: lọc theo trạng thái / từ khoá (mã đơn hoặc tên sản phẩm), phân trang, kèm số đơn theo từng trạng thái.
 * Luôn ràng buộc `userId` trong WHERE — quyền nằm ở service, không phụ thuộc UI.
 * 4 query cố định (đơn+items+ảnh, đếm, đếm theo trạng thái), không N+1.
 */
export async function listOrders(userId: string, input: OrderListFilterInput = {}): Promise<OrderListResult> {
  const f = orderListFilterSchema.parse(input)
  const q = f.q?.replace(/^#/, "").trim()
  const search: Prisma.OrderWhereInput = q
    ? {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {}
  const where: Prisma.OrderWhereInput = { userId, ...search, ...(f.status ? { status: f.status } : {}) }

  const [rows, total, grouped] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        code: true,
        createdAt: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        total: true,
        items: { orderBy: { id: "asc" }, select: itemViewSelect },
        statusHistory: {
          where: { toStatus: { in: ["CANCELLED", "DELIVERED"] } },
          orderBy: { createdAt: "desc" },
          select: { toStatus: true, note: true, createdAt: true },
        },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: { userId, ...search }, _count: { _all: true } }),
  ])

  const counts: OrderListResult["counts"] = { ALL: 0, PENDING: 0, CONFIRMED: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 }
  for (const g of grouped) {
    counts[g.status] = g._count._all
    counts.ALL += g._count._all
  }

  const items: OrderListItem[] = rows.map((o) => ({
    id: o.id,
    code: o.code,
    createdAt: o.createdAt,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    total: o.total,
    quantity: o.items.reduce((sum, i) => sum + i.quantity, 0),
    items: o.items.slice(0, 3).map(toItemView),
    lineCount: o.items.length,
    cancelReason: o.statusHistory.find((h) => h.toStatus === "CANCELLED")?.note ?? null,
    deliveredAt: o.statusHistory.find((h) => h.toStatus === "DELIVERED")?.createdAt ?? null,
  }))

  return { items, total, page: f.page, pageSize: f.pageSize, pageCount: Math.max(1, Math.ceil(total / f.pageSize)), counts }
}

/** Chi tiết đơn + lịch sử trạng thái + tình trạng còn hàng từng dòng. null nếu không phải đơn của user. */
/**
 * Tra đơn theo mã đơn ("FS-20261110-0003", không phân biệt hoa thường) của CHÍNH người dùng này (cho tool AI tra cứu đơn).
 * Mã sai định dạng hoặc đơn của người khác đều trả null như nhau, không lộ đơn có tồn tại hay không.
 */
export async function getOrderByCode(userId: string, code: string): Promise<OrderDetailView | null> {
  const normalized = code.trim().toUpperCase()
  if (!/^FS-\d{8}-\d{4,}$/.test(normalized)) return null
  const row = await db.order.findFirst({ where: { code: normalized, userId }, select: { id: true } })
  return row ? getOrderDetail(userId, row.id) : null
}

export async function getOrderDetail(userId: string, orderId: string): Promise<OrderDetailView | null> {
  const row = await db.order.findFirst({
    where: { id: orderId, userId }, // quyền: chỉ chủ đơn
    select: {
      ...detailSelect,
      items: { orderBy: { id: "asc" }, select: itemViewSelect },
      statusHistory: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          fromStatus: true,
          toStatus: true,
          actorType: true,
          note: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
    },
  })
  if (!row) return null

  const history: OrderHistoryView[] = row.statusHistory.map((h) => ({
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    actorType: h.actorType,
    // Khách hàng/hệ thống hiển thị theo loại; chỉ nhân viên (ADMIN) mới lộ tên.
    actorName: h.actorType === "ADMIN" ? (h.actor?.name ?? null) : null,
    note: h.note,
    createdAt: h.createdAt,
  }))

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt,
    subtotal: row.subtotal,
    shippingFee: row.shippingFee,
    total: row.total,
    note: row.note,
    shippingAddress: row.shippingAddress as unknown as OrderAddressSnapshot,
    items: row.items.map((i) => ({ ...toItemView(i) })),
    history,
  }
}

/**
 * Mua lại: thêm các dòng của đơn cũ vào giỏ của chính chủ đơn. Dòng hết hàng/ngừng bán bị bỏ qua (kèm lý do),
 * dòng đủ một phần thì thêm tối đa số còn lại. Không bao giờ vượt tồn kho.
 */
export async function reorder(user: { id: string }, orderId: string): Promise<ReorderResult> {
  const order = await db.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: { items: { orderBy: { id: "asc" }, select: { variantId: true, productName: true, size: true, color: true, quantity: true } } },
  })
  if (!order) throw new OrderError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng")

  const skipped: ReorderResult["skipped"] = []
  const lines: { variantId: string; quantity: number }[] = []
  for (const i of order.items) {
    // Biến thể đã bị xoá khỏi hệ thống (OrderItem.variantId = null) thì không còn gì để mua lại.
    if (i.variantId) lines.push({ variantId: i.variantId, quantity: i.quantity })
    else skipped.push({ productName: i.productName, size: i.size, color: i.color, reason: "UNAVAILABLE" })
  }

  const res = await addItemsClamped({ userId: user.id }, lines)
  for (const s of res.skipped) {
    const item = order.items.find((i) => i.variantId === s.variantId)!
    skipped.push({ productName: item.productName, size: item.size, color: item.color, reason: s.reason })
  }
  return { added: res.added.length, skipped }
}

