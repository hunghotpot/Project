import { describe, expect, it } from "vitest"
import { createLeadRepair, repairLeadingFragment } from "./text-repair"

describe("repairLeadingFragment", () => {
  it.each([
    ["ình không thể xem giỏ hàng", "mình không thể xem giỏ hàng"],
    ["ình mình chưa có thông tin", "mình chưa có thông tin"],
    ["ình   mình không thể", "mình không thể"],
    ["ình", "mình"],
  ])("%j → %j", (input, expected) => {
    expect(repairLeadingFragment(input)).toBe(expected)
  })

  it.each(["mình không thể", "Mình không biết", "Hiện tại giỏ hàng trống", "", "ìnhh không", "ìn", "bình thường", "Ình"])("không đụng %j", (text) => {
    expect(repairLeadingFragment(text)).toBe(text)
  })

  it("chỉ sửa ở ĐẦU câu: 'ình' ở giữa câu giữ nguyên", () => {
    expect(repairLeadingFragment("bạn ơi ình lạ quá")).toBe("bạn ơi ình lạ quá")
  })
})

describe("createLeadRepair (trên luồng chữ)", () => {
  const run = (deltas: string[]) => {
    const r = createLeadRepair()
    return [...deltas.map((d) => r.push(d)), r.flush()].join("")
  }

  it("mẩu đầu 'ình' rồi ' không': thành 'mình không'", () => {
    expect(run(["ình", " không", " thể"])).toBe("mình không thể")
  })

  it("dạng lặp 'ình' rồi ' mình': bỏ 'ình' thừa", () => {
    expect(run(["ình", " mình", " chưa", " có"])).toBe("mình chưa có")
  })

  it("luồng chỉ có 'ình': flush trả 'mình', không bỏ sót", () => {
    expect(run(["ình"])).toBe("mình")
  })

  it("luồng đúng ('m', 'ình') và chữ thường: giữ nguyên, phát ngay không chờ", () => {
    const r = createLeadRepair()
    expect(r.push("m")).toBe("m")
    expect(r.push("ình")).toBe("ình")
    expect(run(["Hiện", " tại"])).toBe("Hiện tại")
  })

  it("khoảng trắng đầu được phát ngay, mẩu có chữ đầu tiên mới được kiểm", () => {
    expect(run([" ", "ình", " không"])).toBe(" mình không")
  })

  it("chỉ kiểm mẩu chữ đầu tiên: 'ình' ở mẩu sau không bị sửa", () => {
    expect(run(["Chào", "ình", " ạ"])).toBe("Chàoình ạ")
  })
})
