import { describe, expect, it } from "vitest"
import { buildOutfit, isNeutral, planSlots, slotOf, type OutfitCandidate, type OutfitRequest, type OutfitSlot } from "./outfit"

let seq = 0
function item(slot: OutfitSlot, over: Partial<OutfitCandidate> = {}): OutfitCandidate {
  const id = over.id ?? `p${++seq}`
  return {
    id,
    name: over.name ?? `${slot} ${id}`,
    slug: over.slug ?? id,
    slot,
    style: "casual",
    occasion: [],
    season: [],
    price: 200_000,
    image: null,
    colors: [{ name: "Trắng", sizes: ["S", "M", "L"] }],
    ...over,
  }
}
const req = (over: Partial<OutfitRequest> = {}): OutfitRequest => ({ gender: "men", occasions: [], seasons: [], ...over })
const slotsOf = (r: ReturnType<typeof buildOutfit>) => (r.ok ? r.plan.picks.map((p) => p.slot) : [])

describe("slotOf", () => {
  it("ánh xạ danh mục lá sang ô phối", () => {
    expect(slotOf("ao-thun-nam")).toBe("top")
    expect(slotOf("ao-so-mi-nu")).toBe("top")
    expect(slotOf("quan-jeans-nu")).toBe("bottom")
    expect(slotOf("quan-unisex")).toBe("bottom")
    expect(slotOf("quan-tay-kaki-nam")).toBe("bottom")
    expect(slotOf("vay-dam")).toBe("dress")
    expect(slotOf("ao-khoac-nam")).toBe("outer")
    expect(slotOf("vest-du-tiec-nam")).toBe("outer")
    expect(slotOf("phu-kien")).toBe("accessory")
    expect(slotOf("nam")).toBeNull()
    expect(slotOf("khong-co")).toBeNull()
  })
})

describe("planSlots (quy tắc phối)", () => {
  const all = new Set<OutfitSlot>(["top", "bottom", "dress", "outer", "accessory"])

  it("nam: áo + quần; nữ đi làm: áo + quần; nữ dự tiệc, hẹn hò: váy đầm", () => {
    expect(planSlots(req({ gender: "men", occasions: ["đi làm"] }), all).required).toEqual(["top", "bottom"])
    expect(planSlots(req({ gender: "women", occasions: ["đi làm"] }), all).required).toEqual(["top", "bottom"])
    expect(planSlots(req({ gender: "women", occasions: ["dự tiệc"] }), all).required).toEqual(["dress"])
    expect(planSlots(req({ gender: "women", occasions: ["hẹn hò"] }), all).required).toEqual(["dress"])
  })

  it("không có váy trong kho thì nữ dự tiệc quay về áo + quần", () => {
    expect(planSlots(req({ gender: "women", occasions: ["dự tiệc"] }), new Set(["top", "bottom"])).required).toEqual(["top", "bottom"])
  })

  it("thêm áo khoác khi trời lạnh hoặc dịp trang trọng; luôn cho phép phụ kiện", () => {
    expect(planSlots(req({ seasons: ["đông"] }), all).wanted).toEqual(["outer", "accessory"])
    expect(planSlots(req({ occasions: ["đi phỏng vấn"] }), all).wanted).toEqual(["outer", "accessory"])
    expect(planSlots(req({ seasons: ["hè"], occasions: ["đi chơi"] }), all).wanted).toEqual(["accessory"])
  })

  it("món đã chọn quyết định kiểu bộ", () => {
    expect(planSlots(req({ gender: "women", anchor: item("dress") }), all).required).toEqual(["dress"])
    expect(planSlots(req({ gender: "women", occasions: ["dự tiệc"], anchor: item("top") }), all).required).toEqual(["top", "bottom"])
  })
})

describe("buildOutfit", () => {
  it("nam đi làm: chọn một áo và một quần hợp dịp, tổng tiền do code cộng", () => {
    const top = item("top", { occasion: ["đi làm"], price: 399_000 })
    const bottom = item("bottom", { occasion: ["đi làm"], price: 499_000 })
    const r = buildOutfit(req({ occasions: ["đi làm"] }), [top, item("top", { price: 100_000 }), bottom, item("bottom", { price: 150_000 })])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.picks.map((p) => p.candidate.id)).toEqual([top.id, bottom.id]) // hợp dịp thắng món rẻ hơn
    expect(r.plan.totalPrice).toBe(898_000)
    expect(r.plan.missingSlots).toEqual([])
  })

  it("nữ dự tiệc: váy đầm là món chính, không có áo + quần", () => {
    const r = buildOutfit(
      req({ gender: "women", occasions: ["dự tiệc"] }),
      [item("dress", { occasion: ["dự tiệc"] }), item("top"), item("bottom"), item("accessory", { name: "Túi" })],
    )
    expect(slotsOf(r)).toEqual(["dress", "accessory"])
  })

  it("trời lạnh: thêm áo khoác; không có áo khoác thì báo thiếu thay vì nhồi món khác", () => {
    const base = [item("top"), item("bottom")]
    expect(slotsOf(buildOutfit(req({ seasons: ["đông"] }), [...base, item("outer", { season: ["đông"] })]))).toEqual(["top", "bottom", "outer"])
    const r = buildOutfit(req({ seasons: ["đông"] }), base)
    expect(r.ok && r.plan.missingSlots).toEqual(["outer"])
  })

  it("không có phụ kiện thì không báo thiếu (món thêm)", () => {
    const r = buildOutfit(req(), [item("top"), item("bottom")])
    expect(r.ok && r.plan.missingSlots).toEqual([])
  })

  it("thiếu một ô bắt buộc (không có quần): vẫn trả những món có và báo thiếu quần", () => {
    const r = buildOutfit(req(), [item("top"), item("accessory")])
    expect(r.ok).toBe(true)
    expect(r.ok && r.plan.missingSlots).toEqual(["bottom"])
  })

  it("không đủ món để thành bộ (chỉ một món) hoặc không có món: no_items", () => {
    expect(buildOutfit(req(), [item("top")])).toEqual({ ok: false, reason: "no_items" })
    expect(buildOutfit(req(), [])).toEqual({ ok: false, reason: "no_items" })
  })

  it("ngân sách: chọn bộ trong ngân sách dù không phải bộ điểm cao nhất; không bộ nào vừa thì over_budget", () => {
    const pricey = item("top", { occasion: ["đi làm"], price: 900_000 })
    const cheap = item("top", { price: 150_000 })
    const bottom = item("bottom", { price: 200_000 })
    const r = buildOutfit(req({ occasions: ["đi làm"], budget: 500_000 }), [pricey, cheap, bottom])
    expect(r.ok && r.plan.picks.map((p) => p.candidate.id)).toEqual([cheap.id, bottom.id])
    expect(r.ok && r.plan.totalPrice).toBeLessThanOrEqual(500_000)
    expect(buildOutfit(req({ budget: 100_000 }), [pricey, cheap, bottom])).toEqual({ ok: false, reason: "over_budget" })
  })

  it("món đã chọn sẵn luôn nằm trong bộ và các món khác phối quanh nó", () => {
    const anchor = item("bottom", { name: "Quần kaki be", colors: [{ name: "Be", sizes: ["M"] }] })
    const r = buildOutfit(req({ anchor }), [item("top", { price: 300_000 }), item("top", { price: 100_000 })])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.picks.some((p) => p.candidate.id === anchor.id)).toBe(true)
    expect(r.plan.picks.find((p) => p.candidate.id === anchor.id)?.reason).toContain("Sản phẩm bạn đã chọn")
    expect(slotsOf(r).sort()).toEqual(["bottom", "top"])
  })

  it("món đã chọn là váy đầm: không thêm áo và quần", () => {
    const anchor = item("dress")
    const r = buildOutfit(req({ gender: "women", anchor }), [item("top"), item("bottom"), item("accessory")])
    expect(slotsOf(r)).toEqual(["dress", "accessory"])
  })

  it("size khách nói: bỏ màu không còn size đó, bỏ cả món nếu không màu nào còn", () => {
    const noM = item("top", { id: "no-m", colors: [{ name: "Trắng", sizes: ["S"] }] })
    const hasM = item("top", { id: "has-m", price: 500_000, colors: [{ name: "Đen", sizes: ["M"] }] })
    const bottom = item("bottom")
    const r = buildOutfit(req({ size: "m" }), [noM, hasM, bottom])
    expect(r.ok && r.plan.picks[0].candidate.id).toBe("has-m")
    expect(r.ok && r.plan.picks[0].color).toBe("Đen")
  })

  it("món không còn màu nào (hết hàng) không bao giờ được chọn", () => {
    const soldOut = item("top", { id: "sold-out", colors: [] })
    const r = buildOutfit(req(), [soldOut, item("top", { id: "ok" }), item("bottom")])
    expect(r.ok && r.plan.picks.map((p) => p.candidate.id)).not.toContain("sold-out")
  })

  it("màu: ưu tiên màu trung tính và tránh hai màu nổi trong cùng một bộ", () => {
    const top = item("top", { id: "t", colors: [{ name: "Đỏ", sizes: ["M"] }, { name: "Trắng", sizes: ["M"] }] })
    const bottom = item("bottom", { id: "b", colors: [{ name: "Hồng", sizes: ["M"] }, { name: "Đen", sizes: ["M"] }] })
    const r = buildOutfit(req(), [top, bottom])
    expect(r.ok && r.plan.picks.map((p) => p.color)).toEqual(["Trắng", "Đen"])
  })

  it("cùng phong cách phối được ưu tiên hơn lệch phong cách khi các điều kiện khác ngang nhau", () => {
    const formalTop = item("top", { id: "ft", style: "formal" })
    const streetTop = item("top", { id: "st", style: "streetwear" })
    const formalBottom = item("bottom", { id: "fb", style: "formal" })
    const r = buildOutfit(req(), [streetTop, formalTop, formalBottom])
    expect(r.ok && r.plan.picks.map((p) => p.candidate.id)).toEqual(["ft", "fb"])
  })

  it("kết quả ổn định: cùng đầu vào cho cùng bộ, không phụ thuộc thứ tự ứng viên", () => {
    const pool = [item("top", { id: "a" }), item("top", { id: "b" }), item("bottom", { id: "c" }), item("bottom", { id: "d" }), item("accessory", { id: "e" })]
    const ids = (r: ReturnType<typeof buildOutfit>) => (r.ok ? r.plan.picks.map((p) => p.candidate.id) : [])
    expect(ids(buildOutfit(req(), pool))).toEqual(ids(buildOutfit(req(), [...pool].reverse())))
  })

  it("lý do do code dựng từ thuộc tính thật, tối đa 200 ký tự, không có câu bịa", () => {
    const top = item("top", { occasion: ["đi làm"], season: ["hè"], style: "formal" })
    const bottom = item("bottom", { occasion: ["đi làm"], style: "formal" })
    const r = buildOutfit(req({ occasions: ["đi làm"], seasons: ["hè"] }), [top, bottom])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const reason = r.plan.picks[0].reason
    expect(reason).toContain("Hợp dịp đi làm")
    expect(reason).toContain("hợp mùa hè")
    expect(reason).toContain("trung tính")
    for (const p of r.plan.picks) expect(p.reason.length).toBeLessThanOrEqual(200)
  })

  it("tối đa 5 món", () => {
    const pool = [item("top"), item("bottom"), item("outer"), item("accessory")]
    const r = buildOutfit(req({ seasons: ["đông"] }), pool)
    expect(r.ok && r.plan.picks.length).toBeLessThanOrEqual(5)
  })
})

describe("isNeutral", () => {
  it("nhận màu trung tính của cửa hàng", () => {
    for (const c of ["Trắng", "Đen", "Xám", "Xanh navy", "Be", "Kem"]) expect(isNeutral(c)).toBe(true)
    for (const c of ["Đỏ", "Hồng", "Vàng", "Tím lavender"]) expect(isNeutral(c)).toBe(false)
  })
})
