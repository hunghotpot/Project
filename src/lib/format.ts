const vnNumber = new Intl.NumberFormat("vi-VN")

/** 2800000 → "2.800.000 đ" (đúng dạng hiển thị trong Figma). */
export function formatVnd(amount: number): string {
  return `${vnNumber.format(amount)} đ`
}

const TZ = "Asia/Ho_Chi_Minh"
const vnDate = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" })
const vnParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function parts(date: Date) {
  return Object.fromEntries(vnParts.formatToParts(date).map((p) => [p.type, p.value]))
}

/** 2026-10-27 → "27/10/2026" (giờ Việt Nam). */
export function formatDate(date: Date): string {
  return vnDate.format(date)
}

/** → "09/11/2026 14:30" (ngày trước giờ, giờ Việt Nam). */
export function formatDateTime(date: Date): string {
  const p = parts(date)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** → "09/11 14:30" — nhãn ngắn trên timeline. */
export function formatDayMonthTime(date: Date): string {
  const p = parts(date)
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`
}

export const GENDER_LABEL = {
  MEN: "Nam",
  WOMEN: "Nữ",
  UNISEX: "Unisex",
} as const

/** Product.style lưu slug tiếng Anh; hiển thị bằng nhãn tiếng Việt. */
export const STYLE_LABEL: Record<string, string> = {
  casual: "Thường ngày",
  formal: "Lịch sự",
  streetwear: "Đường phố",
  "smart-casual": "Smart casual",
  minimalist: "Tối giản",
  vintage: "Cổ điển",
  sporty: "Thể thao",
  korean: "Hàn Quốc",
  elegant: "Thanh lịch",
  bohemian: "Bohemian",
}


