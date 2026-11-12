/*
 * Mốc thời gian theo giờ Việt Nam (UTC+7, không có giờ mùa hè) cho thống kê Admin. Hàm thuần.
 * Tuần bắt đầu từ thứ Hai (T2…CN) như biểu đồ trong Figma.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Thứ tự hiển thị của biểu đồ tuần: T2 … CN. */
export const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const

/** 0h00 (giờ VN) của ngày chứa `date`, trả về dưới dạng thời điểm thực (UTC). */
export function startOfVnDay(date: Date): Date {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - VN_OFFSET_MS)
}

/** 0h00 thứ Hai (giờ VN) của tuần chứa `date`. */
export function startOfVnWeek(date: Date): Date {
  const dayStart = startOfVnDay(date)
  const weekday = new Date(dayStart.getTime() + VN_OFFSET_MS).getUTCDay() // 0 = Chủ nhật
  return new Date(dayStart.getTime() - ((weekday + 6) % 7) * DAY_MS)
}

/** 0h00 ngày mùng 1 (giờ VN) của tháng chứa `date`, cộng thêm `monthOffset` tháng. */
export function startOfVnMonth(date: Date, monthOffset = 0): Date {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + monthOffset, 1) - VN_OFFSET_MS)
}

export function addVnDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** Ngày giờ VN dạng YYYY-MM-DD. */
export function vnDateKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

export interface AdminDateRanges {
  todayStart: Date
  tomorrowStart: Date
  yesterdayStart: Date
  weekStart: Date
  nextWeekStart: Date
  monthStart: Date
  nextMonthStart: Date
  prevMonthStart: Date
}

export function adminDateRanges(now: Date): AdminDateRanges {
  const todayStart = startOfVnDay(now)
  const weekStart = startOfVnWeek(now)
  return {
    todayStart,
    tomorrowStart: addVnDays(todayStart, 1),
    yesterdayStart: addVnDays(todayStart, -1),
    weekStart,
    nextWeekStart: addVnDays(weekStart, 7),
    monthStart: startOfVnMonth(now),
    nextMonthStart: startOfVnMonth(now, 1),
    prevMonthStart: startOfVnMonth(now, -1),
  }
}

/** % thay đổi so với kỳ trước, làm tròn 1 chữ số; null khi kỳ trước = 0 (không có cơ sở so sánh). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}
