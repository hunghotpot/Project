// Sinh nội dung mã VietQR (chuẩn EMVCo/NAPAS "chuyển nhanh 247 tới tài khoản") để mọi app ngân hàng quét được.
// Hàm thuần, không phụ thuộc request; việc vẽ ảnh QR nằm ở nơi gọi.

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — checksum bắt buộc ở cuối payload EMVCo. */
export function crc16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

export interface VietQrInput {
  /** Mã BIN ngân hàng thụ hưởng (vd MB Bank = 970422). */
  bankBin: string
  accountNo: string
  /** VND, số nguyên > 0 → QR có số tiền cố định. */
  amount: number
  /** Nội dung chuyển khoản. */
  content: string
}

export function buildVietQrPayload({ bankBin, accountNo, amount, content }: VietQrInput): string {
  const beneficiary = tlv("00", bankBin) + tlv("01", accountNo)
  const merchantAccount = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA")

  const body =
    tlv("00", "01") +
    tlv("01", "12") + // 12 = QR động (có số tiền)
    tlv("38", merchantAccount) +
    tlv("53", "704") + // VND
    tlv("54", String(Math.round(amount))) +
    tlv("58", "VN") +
    tlv("62", tlv("08", content.slice(0, 25))) +
    "6304"
  return body + crc16(body)
}
