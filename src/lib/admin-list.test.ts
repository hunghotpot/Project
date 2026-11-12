import { describe, expect, it } from "vitest"
import { buildListHref, pageRange, pageWindow } from "@/lib/admin-list"

describe("buildListHref", () => {
  it("giữ các khoá khác, ghi đè khoá trong patch, bỏ khoá rỗng", () => {
    expect(buildListHref("/admin/orders", { status: "PENDING", page: "3", q: "an" }, { page: 2 })).toBe("/admin/orders?status=PENDING&q=an&page=2")
    expect(buildListHref("/admin/orders", { status: "PENDING", page: "3" }, { status: undefined, page: undefined })).toBe("/admin/orders")
    expect(buildListHref("/admin/orders", { q: "x" }, { q: "" })).toBe("/admin/orders")
  })

  it("giữ nhiều giá trị của cùng một khoá", () => {
    expect(buildListHref("/p", { size: ["M", "L"] }, { page: 1 })).toBe("/p?size=M&size=L&page=1")
  })

  it("mã hoá ký tự đặc biệt", () => {
    expect(buildListHref("/p", {}, { q: "áo thun" })).toBe("/p?q=%C3%A1o+thun")
  })
})

describe("pageWindow", () => {
  it("bám quanh trang hiện tại và không vượt biên", () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(6, 10)).toEqual([4, 5, 6, 7, 8])
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10])
  })

  it("ít trang hơn cửa sổ; trang ngoài biên được kẹp lại; không có trang", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
    expect(pageWindow(99, 3)).toEqual([1, 2, 3])
    expect(pageWindow(0, 0)).toEqual([])
  })
})

describe("pageRange", () => {
  it("tính khoảng đang hiển thị", () => {
    expect(pageRange(1, 5, 18)).toEqual({ from: 1, to: 5 })
    expect(pageRange(4, 5, 18)).toEqual({ from: 16, to: 18 })
  })

  it("rỗng hoặc trang vượt tổng → null", () => {
    expect(pageRange(1, 5, 0)).toBeNull()
    expect(pageRange(9, 5, 18)).toBeNull()
  })
})
