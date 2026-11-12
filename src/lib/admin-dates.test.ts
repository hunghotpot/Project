import { describe, expect, it } from "vitest"
import { adminDateRanges, percentChange, startOfVnDay, startOfVnMonth, startOfVnWeek, vnDateKey } from "./admin-dates"

describe("mốc thời gian giờ Việt Nam", () => {
  it("startOfVnDay: 20h UTC đã sang ngày hôm sau theo giờ VN", () => {
    // 2026-11-12T20:00Z = 03:00 ngày 13/11 giờ VN
    expect(startOfVnDay(new Date("2026-11-12T20:00:00Z")).toISOString()).toBe("2026-11-12T17:00:00.000Z")
    // 2026-11-12T16:59Z = 23:59 ngày 12/11 giờ VN
    expect(startOfVnDay(new Date("2026-11-12T16:59:00Z")).toISOString()).toBe("2026-11-11T17:00:00.000Z")
  })

  it("startOfVnWeek: thứ Hai là ngày đầu tuần, Chủ nhật thuộc tuần trước", () => {
    // 12/11/2026 là thứ Năm → thứ Hai 9/11
    expect(vnDateKey(startOfVnWeek(new Date("2026-11-12T05:00:00Z")))).toBe("2026-11-09")
    // Chủ nhật 15/11 vẫn thuộc tuần bắt đầu 9/11
    expect(vnDateKey(startOfVnWeek(new Date("2026-11-15T10:00:00Z")))).toBe("2026-11-09")
    // Thứ Hai 9/11 0h05 giờ VN (= 8/11 17:05Z)
    expect(vnDateKey(startOfVnWeek(new Date("2026-11-08T17:05:00Z")))).toBe("2026-11-09")
    // Chủ nhật 8/11 23:59 giờ VN (= 8/11 16:59Z) còn thuộc tuần trước
    expect(vnDateKey(startOfVnWeek(new Date("2026-11-08T16:59:00Z")))).toBe("2026-11-02")
  })

  it("startOfVnMonth: qua ranh giới tháng/năm", () => {
    // 31/10 17:30Z = 1/11 00:30 giờ VN
    expect(vnDateKey(startOfVnMonth(new Date("2026-10-31T17:30:00Z")))).toBe("2026-11-01")
    expect(vnDateKey(startOfVnMonth(new Date("2026-01-15T00:00:00Z"), -1))).toBe("2025-12-01")
    expect(vnDateKey(startOfVnMonth(new Date("2026-12-15T00:00:00Z"), 1))).toBe("2027-01-01")
  })

  it("adminDateRanges khớp nhau", () => {
    const r = adminDateRanges(new Date("2026-11-12T05:00:00Z"))
    expect(vnDateKey(r.todayStart)).toBe("2026-11-12")
    expect(vnDateKey(r.yesterdayStart)).toBe("2026-11-11")
    expect(vnDateKey(r.nextWeekStart)).toBe("2026-11-16")
    expect(vnDateKey(r.monthStart)).toBe("2026-11-01")
    expect(vnDateKey(r.prevMonthStart)).toBe("2026-10-01")
    expect(vnDateKey(r.nextMonthStart)).toBe("2026-12-01")
  })
})

describe("percentChange", () => {
  it("tính % và làm tròn 1 chữ số", () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(101, 300)).toBe(-66.3)
  })
  it("kỳ trước bằng 0 → null", () => {
    expect(percentChange(100, 0)).toBeNull()
  })
})
