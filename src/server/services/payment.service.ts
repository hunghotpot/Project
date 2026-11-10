import "server-only"
import { PAYMENT_WINDOW_MINUTES } from "@/lib/order"
import { db } from "@/server/db"
import {
  buildPaymentUrl,
  formatVnpDate,
  makeTxnRef,
  normalizeIp,
  orderCodeFromTxnRef,
  toVnpParams,
  verifySignature,
  VNPAY_RESPONSE_MESSAGE,
  type VnpParams,
} from "@/server/payment/vnpay"
import { getVnpayConfig, type VnpayConfig } from "@/server/payment/vnpay-config"
import { cancelExpiredOrder, OrderError, recordStatusChange } from "@/server/services/order.service"

/*
 * Thanh toán VNPay (sandbox/production, API 2.1.0).
 * - Return URL chỉ để HIỂN THỊ kết quả cho người dùng; KHÔNG đổi trạng thái đơn (người dùng có thể giả mạo/đóng trình duyệt).
 * - IPN (server-to-server) là nguồn sự thật duy nhất cập nhật paymentStatus.
 * Không hàm nào ở đây log hash secret hay toàn bộ tham số.
 */

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

const requireConfig = (config?: VnpayConfig): VnpayConfig => {
  const c = config ?? getVnpayConfig()
  if (!c) throw new Error("VNPay chưa được cấu hình (thiếu VNP_TMN_CODE / VNP_HASH_SECRET)")
  return c
}

/** Dựng URL thanh toán đã ký. Link hết hạn đúng lúc đơn hết hạn (createdAt + 15 phút). */
export function createPaymentUrl(
  order: { code: string; total: number; createdAt?: Date },
  opts: { ipAddr?: string | null; now?: Date; config?: VnpayConfig } = {}
): string {
  const cfg = requireConfig(opts.config)
  const now = opts.now ?? new Date()
  const expireAt = new Date((order.createdAt ?? now).getTime() + PAYMENT_WINDOW_MINUTES * 60_000)

  const params: VnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: cfg.tmnCode,
    vnp_Amount: String(order.total * 100), // VNPay nhân 100, không có phần thập phân
    vnp_CurrCode: "VND",
    vnp_TxnRef: makeTxnRef(order.code, now),
    vnp_OrderInfo: `Thanh toan don hang ${order.code}`, // không dấu theo yêu cầu của VNPay
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: cfg.returnUrl,
    vnp_IpAddr: normalizeIp(opts.ipAddr),
    vnp_CreateDate: formatVnpDate(now),
    vnp_ExpireDate: formatVnpDate(expireAt),
  }
  return buildPaymentUrl(cfg.url, params, cfg.hashSecret)
}

/** Link thanh toán (lại) cho đơn của user. Kiểm tra đơn còn thanh toán được và chưa quá hạn. */
export async function getVnpayPayUrl(userId: string, orderId: string, ipAddr: string | null | undefined): Promise<string> {
  await expireUnpaidVnpayOrders() // dọn đơn quá hạn trước, phòng khi cron chưa chạy
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    select: { code: true, total: true, createdAt: true, status: true, paymentMethod: true, paymentStatus: true },
  })
  if (!order) throw new OrderError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng")
  if (order.paymentMethod !== "VNPAY") throw new OrderError("CANNOT_PAY", "Đơn hàng này không thanh toán qua VNPay")
  if (order.status === "CANCELLED") {
    throw new OrderError("PAYMENT_EXPIRED", "Đơn hàng đã bị huỷ do quá hạn thanh toán")
  }
  if (order.status !== "PENDING" || (order.paymentStatus !== "PENDING" && order.paymentStatus !== "FAILED")) {
    throw new OrderError("CANNOT_PAY", "Đơn hàng không còn ở trạng thái chờ thanh toán")
  }
  return createPaymentUrl(order, { ipAddr })
}

/** Id đơn theo mã đơn (dùng cho Return URL để chuyển hướng). Chỉ trả id, không lộ dữ liệu đơn. */
export async function findOrderIdByCode(code: string): Promise<string | null> {
  const order = await db.order.findUnique({ where: { code }, select: { id: true } })
  return order?.id ?? null
}

export interface VnpayReturnResult {
  /** Chữ ký hợp lệ (dữ liệu đúng là của VNPay, không bị sửa). */
  valid: boolean
  /** valid + giao dịch thành công. Chỉ để hiển thị — KHÔNG dùng để ghi nhận thanh toán. */
  success: boolean
  orderCode: string | null
  responseCode: string | null
  message: string
}

/** Kiểm tra dữ liệu người dùng được VNPay đưa về Return URL. Không đụng DB. */
export function verifyReturn(params: RawParams, config?: VnpayConfig): VnpayReturnResult {
  const cfg = requireConfig(config)
  const p = toVnpParams(params)
  const orderCode = orderCodeFromTxnRef(p.vnp_TxnRef)
  if (!verifySignature(p, cfg.hashSecret)) {
    return { valid: false, success: false, orderCode, responseCode: null, message: "Chữ ký không hợp lệ" }
  }
  const responseCode = p.vnp_ResponseCode ?? null
  const success = responseCode === "00" && p.vnp_TransactionStatus === "00"
  return {
    valid: true,
    success,
    orderCode,
    responseCode,
    message: VNPAY_RESPONSE_MESSAGE[responseCode ?? ""] ?? "Giao dịch không thành công",
  }
}

/** Mã phản hồi IPN theo tài liệu VNPay. */
export interface IpnResponse {
  RspCode: "00" | "01" | "02" | "04" | "97" | "99"
  Message: string
}

/**
 * Xử lý IPN: kiểm chữ ký → tìm đơn → khớp số tiền → cập nhật paymentStatus.
 * Idempotent: mỗi chuyển trạng thái nằm trong điều kiện của câu UPDATE (PENDING|FAILED → PAID, PENDING → FAILED),
 * nên VNPay gọi lại bao nhiêu lần cũng chỉ cập nhật một lần, các lần sau trả "02".
 */
export async function handleIPN(params: RawParams, config?: VnpayConfig): Promise<IpnResponse> {
  const cfg = config ?? getVnpayConfig()
  if (!cfg) return { RspCode: "99", Message: "Merchant not configured" }

  const p = toVnpParams(params)
  if (!verifySignature(p, cfg.hashSecret)) return { RspCode: "97", Message: "Invalid signature" }

  const code = orderCodeFromTxnRef(p.vnp_TxnRef)
  const order = code
    ? await db.order.findUnique({
        where: { code },
        select: { id: true, code: true, total: true, status: true, paymentMethod: true, paymentStatus: true },
      })
    : null
  if (!order || order.paymentMethod !== "VNPAY") return { RspCode: "01", Message: "Order not found" }

  if (Number(p.vnp_Amount) !== order.total * 100) return { RspCode: "04", Message: "Invalid amount" }

  const paid = p.vnp_ResponseCode === "00" && p.vnp_TransactionStatus === "00"
  if (paid) {
    // Thanh toán lại sau một lần thất bại (FAILED → PAID) vẫn hợp lệ; đơn đã huỷ thì không "sống lại".
    // Đổi trạng thái + ghi lịch sử trong một transaction (lịch sử chỉ có khi lần đổi thật sự xảy ra).
    const res = await db.$transaction(async (tx) => {
      const r = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING", paymentStatus: { in: ["PENDING", "FAILED"] } },
        data: { paymentStatus: "PAID", status: "CONFIRMED" },
      })
      if (r.count === 1) {
        await recordStatusChange(tx, order.id, "PENDING", "CONFIRMED", { type: "SYSTEM" }, "Thanh toán VNPay thành công")
      }
      return r
    })
    if (res.count === 1) return { RspCode: "00", Message: "Confirm Success" }
    if (order.status === "CANCELLED") {
      // Tiền đã về nhưng đơn bị huỷ (quá hạn): cần hoàn tiền thủ công. Chỉ log mã đơn, không log dữ liệu giao dịch.
      console.warn(`[vnpay] IPN thanh toán thành công cho đơn đã huỷ ${order.code} — cần hoàn tiền thủ công`)
    }
    return { RspCode: "02", Message: "Order already confirmed" }
  }

  const res = await db.order.updateMany({
    where: { id: order.id, status: "PENDING", paymentStatus: "PENDING" },
    data: { paymentStatus: "FAILED" },
  })
  return res.count === 1 ? { RspCode: "00", Message: "Confirm Success" } : { RspCode: "02", Message: "Order already confirmed" }
}

// Cộng thêm 2 phút đệm so với hạn link để IPN đến muộn kịp ghi nhận trước khi đơn bị huỷ.
const CANCEL_GRACE_MINUTES = 2

/**
 * Huỷ các đơn VNPAY quá hạn thanh toán chưa trả tiền và hoàn tồn kho. Gọi bằng cron/route có secret
 * (`/api/cron/expire-orders`). An toàn khi chạy nhiều lần/đồng thời: lõi huỷ có điều kiện trạng thái trong câu UPDATE.
 */
export async function expireUnpaidVnpayOrders(now: Date = new Date()): Promise<{ cancelled: number }> {
  const cutoff = new Date(now.getTime() - (PAYMENT_WINDOW_MINUTES + CANCEL_GRACE_MINUTES) * 60_000)
  const due = await db.order.findMany({
    where: { paymentMethod: "VNPAY", status: "PENDING", paymentStatus: { in: ["PENDING", "FAILED"] }, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true },
  })

  let cancelled = 0
  for (const { id } of due) {
    try {
      await cancelExpiredOrder(id)
      cancelled += 1
    } catch (e) {
      // Đã được thanh toán / huỷ trong lúc chờ → bỏ qua.
      if (e instanceof OrderError && (e.code === "CANNOT_CANCEL" || e.code === "ORDER_NOT_FOUND")) continue
      throw e
    }
  }
  return { cancelled }
}


