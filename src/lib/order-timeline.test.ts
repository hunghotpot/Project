import { describe, expect, it } from "vitest"
import { buildTimeline, canCancelStatus, type HistoryEntry } from "./order-timeline"
import { parseOrderListFilters, serializeOrderListFilters } from "./validators/order-list"

const at = (iso: string) => new Date(`2026-11-09T${iso}:00Z`)
const entry = (to: HistoryEntry["toStatus"], time: string, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  fromStatus: null,
  toStatus: to,
  actorType: "SYSTEM",
  actorName: null,
  note: null,
  createdAt: at(time),
  ...over,
})

describe("buildTimeline", () => {
  it("đơn đang giao: 2 bước đã xong, bước giao hàng là hiện tại, bước cuối chưa tới", () => {
    const steps = buildTimeline("SHIPPING", [
      entry("PENDING", "07:30", { actorType: "CUSTOMER", actorName: "Nguyễn Văn A" }),
      entry("CONFIRMED", "10:00"),
      entry("SHIPPING", "12:00", { actorType: "ADMIN", actorName: "Admin" }),
    ])
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ["Đã đặt đơn", "done"],
      ["Đã xác nhận", "done"],
      ["Đang giao hàng", "current"],
      ["Hoàn thành", "upcoming"],
    ])
    expect(steps[0]).toMatchObject({ actor: "Nguyễn Văn A", at: at("07:30") })
    expect(steps[2].actor).toBe("Admin")
    expect(steps[3].at).toBeNull()
  })

  it("lấy người đổi theo loại khi không có tên; hiển thị 'Hệ thống' cho IPN/job", () => {
    const steps = buildTimeline("CONFIRMED", [entry("PENDING", "07:00", { actorType: "CUSTOMER" }), entry("CONFIRMED", "07:05")])
    expect(steps[0].actor).toBe("Khách hàng")
    expect(steps[1].actor).toBe("Hệ thống")
  })

  it("đơn hoàn thành: mọi bước done/current, không bước nào upcoming", () => {
    const steps = buildTimeline("DELIVERED", [entry("PENDING", "07:00"), entry("CONFIRMED", "08:00"), entry("SHIPPING", "09:00"), entry("DELIVERED", "10:00")])
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"])
  })

  it("đơn huỷ: giữ các bước đã qua, bỏ bước chưa tới, thêm bước 'Đã hủy' kèm lý do", () => {
    const steps = buildTimeline("CANCELLED", [
      entry("PENDING", "07:00"),
      entry("CANCELLED", "07:20", { actorType: "CUSTOMER", note: "Đổi ý size" }),
    ])
    expect(steps.map((s) => [s.label, s.state])).toEqual([
      ["Đã đặt đơn", "done"],
      ["Đã hủy", "cancelled"],
    ])
    expect(steps[1]).toMatchObject({ note: "Đổi ý size", actor: "Khách hàng" })
  })

  it("không có lịch sử (dữ liệu cũ) vẫn dựng được, chỉ thiếu thời gian", () => {
    const steps = buildTimeline("CONFIRMED", [])
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming"])
    expect(steps.every((s) => s.at === null)).toBe(true)
  })
})

describe("canCancelStatus", () => {
  it("chỉ PENDING và CONFIRMED", () => {
    expect(["PENDING", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED"].map((s) => canCancelStatus(s as never))).toEqual([true, true, false, false, false])
  })
})

describe("parseOrderListFilters", () => {
  it("mặc định, không phân biệt hoa thường, giá trị sai rơi về mặc định", () => {
    expect(parseOrderListFilters({})).toEqual({ status: undefined, q: undefined, page: 1, pageSize: 5 })
    expect(parseOrderListFilters({ status: "shipping", page: "3", q: "  áo  " })).toMatchObject({ status: "SHIPPING", page: 3, q: "áo" })
    expect(parseOrderListFilters({ status: "hack", page: "abc", pageSize: "9999" })).toEqual({ status: undefined, q: undefined, page: 1, pageSize: 5 })
  })

  it("round-trip qua URL, bỏ giá trị mặc định", () => {
    const f = parseOrderListFilters({ status: "PENDING", q: "ao thun", page: "2" })
    const sp = serializeOrderListFilters(f)
    expect(sp.toString()).toBe("status=PENDING&q=ao+thun&page=2")
    expect(parseOrderListFilters(sp)).toEqual(f)
    expect(serializeOrderListFilters(parseOrderListFilters({})).toString()).toBe("")
  })
})
