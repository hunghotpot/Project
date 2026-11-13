import { describe, expect, it } from "vitest"
import { splitBold } from "./chat-text"

const t = (text: string, bold = false) => ({ text, bold })

describe("splitBold", () => {
  it("chữ thường giữ nguyên", () => {
    expect(splitBold("Xin chào bạn")).toEqual([t("Xin chào bạn")])
    expect(splitBold("")).toEqual([])
  })

  it("**đậm** thành đoạn đậm, bỏ dấu sao", () => {
    expect(splitBold("Vui lòng bấm **Xác nhận** trên thẻ")).toEqual([t("Vui lòng bấm "), t("Xác nhận", true), t(" trên thẻ")])
  })

  it("nhiều đoạn đậm và đoạn đậm đứng đầu/cuối", () => {
    expect(splitBold("**Áo A** và **Áo B**")).toEqual([t("Áo A", true), t(" và "), t("Áo B", true)])
  })

  it("câu đang gõ dở: dấu ** chưa đóng bị bỏ, không hiện dấu sao", () => {
    expect(splitBold("Vui lòng bấm **Xác")).toEqual([t("Vui lòng bấm Xác")])
    expect(splitBold("Vui lòng bấm **")).toEqual([t("Vui lòng bấm ")])
    expect(splitBold("**")).toEqual([])
  })

  it("không xuyên qua xuống dòng và không đụng dấu sao đơn", () => {
    expect(splitBold("**a\nb**")).toEqual([t("a\nb")])
    expect(splitBold("giá * 2 và 5*3")).toEqual([t("giá * 2 và 5*3")])
  })

  it("chữ tiếng Việt có dấu và xuống dòng được giữ nguyên", () => {
    expect(splitBold("Dòng 1\n- **Áo sơ mi** (499.000đ)")).toEqual([t("Dòng 1\n- "), t("Áo sơ mi", true), t(" (499.000đ)")])
  })

  it("không bao giờ sinh thẻ HTML: nội dung giống thẻ vẫn là chữ", () => {
    expect(splitBold("<b>x</b> **y**")).toEqual([t("<b>x</b> "), t("y", true)])
  })
})
