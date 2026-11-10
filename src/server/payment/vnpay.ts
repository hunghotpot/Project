import { createHmac, timingSafeEqual } from "node:crypto"

/*
 * Phần thuần của tích hợp VNPay (API 2.1.0): ký/kiểm chữ ký HMAC-SHA512, dựng URL thanh toán, mã giao dịch.
 * Không đọc env, không chạm DB, không log: hash secret và tham số chỉ đi qua hàm này, không bao giờ ra log.
 */

export type VnpParams = Record<string, string>

// Đúng như code mẫu của VNPay: encodeURIComponent rồi đổi %20 thành "+".
const encode = (v: string) => encodeURIComponent(v).replace(/%20/g, "+")

/** Chuỗi key=value (đã encode) nối bằng "&", sắp xếp tăng dần theo key. Dùng cho cả ký lẫn URL. */
export function sortedQuery(params: VnpParams): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${encode(k)}=${encode(params[k])}`)
    .join("&")
}

/** Các tham số tham gia chữ ký: chỉ vnp_*, bỏ vnp_SecureHash / vnp_SecureHashType. */
function signable(params: VnpParams): VnpParams {
  const out: VnpParams = {}
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType") out[k] = v
  }
  return out
}

export function sign(params: VnpParams, hashSecret: string): string {
  return createHmac("sha512", hashSecret).update(Buffer.from(sortedQuery(signable(params)), "utf-8")).digest("hex")
}

/** So chữ ký nhận được với chữ ký tính lại, thời gian không phụ thuộc nội dung (chống timing attack). */
export function verifySignature(params: VnpParams, hashSecret: string): boolean {
  const received = params.vnp_SecureHash?.toLowerCase()
  if (!received) return false
  const expected = Buffer.from(sign(params, hashSecret), "utf-8")
  const actual = Buffer.from(received, "utf-8")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function buildPaymentUrl(baseUrl: string, params: VnpParams, hashSecret: string): string {
  const data = signable(params)
  return `${baseUrl}?${sortedQuery(data)}&vnp_SecureHash=${sign(data, hashSecret)}`
}

const DATE_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

/** yyyyMMddHHmmss theo giờ Việt Nam (GMT+7) — định dạng ngày của VNPay. */
export function formatVnpDate(date: Date): string {
  const p = Object.fromEntries(DATE_PARTS.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`
}

/**
 * Mã giao dịch (vnp_TxnRef): VNPay yêu cầu duy nhất mỗi lần thanh toán nên có hậu tố thời gian để thanh toán lại được.
 * FS-20261110-0011 → "FS202611100011T1699999999" (chỉ chữ + số, đọc ngược về mã đơn được).
 */
export function makeTxnRef(orderCode: string, now: Date): string {
  return `${orderCode.replaceAll("-", "")}T${Math.floor(now.getTime() / 1000)}`
}

export function orderCodeFromTxnRef(txnRef: string | undefined): string | null {
  const m = /^FS(\d{8})(\d{4,})T\d+$/.exec(txnRef ?? "")
  return m ? `FS-${m[1]}-${m[2]}` : null
}

/** IPv6 loopback / IPv4-mapped → IPv4 (VNPay sandbox chỉ nhận IPv4 hợp lệ). */
export function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return "127.0.0.1"
  const v = ip.trim()
  if (v === "::1") return "127.0.0.1"
  return v.startsWith("::ffff:") ? v.slice(7) : v
}

/** Tham số query (một hoặc nhiều giá trị) → chỉ giữ giá trị đầu của mỗi khoá. */
export function toVnpParams(input: URLSearchParams | Record<string, string | string[] | undefined>): VnpParams {
  const out: VnpParams = {}
  if (input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) if (!(k in out)) out[k] = v
  } else {
    for (const [k, v] of Object.entries(input)) {
      const first = Array.isArray(v) ? v[0] : v
      if (first !== undefined) out[k] = first
    }
  }
  return out
}

/** Thông báo tiếng Việt cho mã vnp_ResponseCode thường gặp. */
export const VNPAY_RESPONSE_MESSAGE: Record<string, string> = {
  "00": "Giao dịch thành công",
  "07": "Giao dịch bị nghi ngờ gian lận",
  "09": "Thẻ/tài khoản chưa đăng ký Internet Banking",
  "10": "Xác thực thông tin thẻ/tài khoản sai quá 3 lần",
  "11": "Đã hết thời gian chờ thanh toán",
  "12": "Thẻ/tài khoản bị khoá",
  "13": "Sai mật khẩu xác thực giao dịch (OTP)",
  "24": "Bạn đã huỷ giao dịch",
  "51": "Tài khoản không đủ số dư",
  "65": "Tài khoản vượt hạn mức giao dịch trong ngày",
  "75": "Ngân hàng đang bảo trì",
  "79": "Nhập sai mật khẩu thanh toán quá số lần quy định",
}
