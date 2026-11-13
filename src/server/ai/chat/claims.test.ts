import { describe, expect, it } from "vitest"
import { BARE_CONFIRMATION_REPLY, CLAIM_FALLBACK, detectUngroundedClaim, isBareConfirmation, RETRY_PLAN, isOutfitPlan, outfitReplyText, retryPlanFor } from "./claims"

const detect = (text: string, hasKnowledge = false) => detectUngroundedClaim(text, { hasKnowledge })

describe("detectUngroundedClaim", () => {
  it("bắt câu khẳng định đã có thẻ xác nhận hoặc đã thêm vào giỏ (lỗi thật đã gặp)", () => {
    for (const t of [
      "Bạn muốn thêm 4 cái áo thun cotton trắng dáng dài size S không? Hãy bấm Xác nhận trên thẻ để hoàn tất!",
      "Bạn đã được hiển thị thẻ xác nhận. Vui lòng bấm Xác nhận để thêm vào giỏ.",
      "Mình đã thêm 2 áo vào giỏ hàng cho bạn rồi nhé.",
      "Chỉ cần bấm “Xác nhận” là xong",
      "Đã thêm áo sơ mi vào giỏ hàng",
    ]) {
      expect(detect(t), t).toBe("confirmation")
    }
  })

  it("bắt câu kể giá, danh sách size, còn/hết hàng khi không có kiến thức làm nền", () => {
    for (const t of [
      "Áo thun cotton trắng giá 199.000đ, bạn muốn mua không?",
      "Có áo dưới 500k như sau",
      "Sản phẩm có các size: S, M, L, XL. Bạn muốn size nào?",
      "Size M và L còn hàng",
      "Áo này hết hàng rồi",
    ]) {
      expect(detect(t), t).toBe("catalog")
    }
  })

  it("không bắt giá và size khi câu trả lời dựa trên kiến thức (chính sách nêu giá là hợp lệ)", () => {
    expect(detect("Miễn phí vận chuyển cho đơn từ 500.000 đ. Nguồn: Vận chuyển", true)).toBeNull()
    expect(detect("Nếu nằm giữa size M và L thì chọn size lớn hơn", true)).toBeNull()
  })

  it("câu khẳng định đã thêm vào giỏ luôn cần bằng chứng, kể cả khi có kiến thức", () => {
    expect(detect("Mình đã thêm áo vào giỏ hàng rồi", true)).toBe("confirmation")
  })

  it("không bắt câu hỏi lại, từ chối, chào hỏi hay hướng dẫn thông thường", () => {
    for (const t of [
      "Bạn muốn thêm sản phẩm gì? Vui lòng nói rõ tên sản phẩm, size, màu và số lượng nhé!",
      "Mình không thể đặt hàng thay bạn. Bạn vui lòng thanh toán tại /checkout.",
      "Xin chào! Mình là trợ lý mua sắm.",
      "Mình chưa có thông tin này. Bạn xem các trang chính sách ở cuối website nhé.",
      "Mình chưa tạo được thẻ xác nhận nên chưa thêm gì vào giỏ.",
    ]) {
      expect(detect(t), t).toBeNull()
    }
  })

  it("câu phủ định trung thực không bị coi là khẳng định, nhưng câu hỏi \"không?\" rồi nhắc bấm thẻ vẫn bị bắt", () => {
    expect(detect("Chưa có thẻ xác nhận nào để bạn bấm. Bạn cho mình biết size nhé.")).toBeNull()
    expect(detect("Mình chưa thêm gì vào giỏ hàng.")).toBeNull()
    expect(detect("Bạn muốn thêm áo size S không? Hãy bấm Xác nhận trên thẻ để hoàn tất.")).toBe("confirmation")
  })

  it("câu thay thế của chính cổng không tự kích hoạt lại cổng", () => {
    expect(detect(CLAIM_FALLBACK.catalog)).toBeNull()
    expect(detect(CLAIM_FALLBACK.confirmation)).toBeNull()
  })
})

describe("RETRY_PLAN", () => {
  it("thu hẹp tool đúng việc: xác nhận chỉ addToCart, catalog chỉ tìm và xem chi tiết (không có tool ghi)", () => {
    expect(RETRY_PLAN.confirmation.tools).toEqual(["addToCart"])
    expect(retryPlanFor("confirmation", "S").tools).toEqual(["addToCart"])
    expect(retryPlanFor("catalog", "gợi ý cho tôi đi").tools).toEqual(["searchProducts"])
    expect(retryPlanFor("catalog", "tìm áo sơ mi").tools).toEqual(["searchProducts"])
    for (const q of ["có size gì", "áo này màu nào", "giá bao nhiêu", "còn hàng không"]) expect(retryPlanFor("catalog", q).tools, q).toEqual(["getProductDetail"])
    for (const q of ["mình cao 1m65 nặng 55kg mặc quần jeans nữ size nào", "70kg mặc size gì", "áo sơ mi poplin công sở mình cao 1m70 thì mặc size gì"]) {
      expect(retryPlanFor("catalog", q).tools, q).toEqual(["getSizeRecommendation"])
    }
    for (const q of ["đơn hàng gần nhất của mình ở đâu", "tra đơn FS-20261112-0001"]) expect(retryPlanFor("catalog", q).tools, q).toEqual(["getOrderStatus"])
    for (const kind of ["confirmation", "catalog"] as const) expect(RETRY_PLAN[kind].note).toContain("LƯU Ý LƯỢT NÀY")
  })
})

describe("detectUngroundedClaim: theo câu của khách", () => {
  const withUser = (text: string, userText: string, extra: { hasKnowledge?: boolean; previousAssistant?: string } = {}) =>
    detectUngroundedClaim(text, { hasKnowledge: false, userText, ...extra })

  it("khách xin gợi ý hoặc tìm sản phẩm: bắt buộc có tool, kể cả khi model chỉ kể tên (không giá, không size)", () => {
    const invented = "Mình gợi ý một sản phẩm: Áo thun cotton trắng dáng dài. Bạn muốn thêm sản phẩm này không?"
    for (const q of ["gợi ý cho tôi đi", "tìm cho mình áo sơ mi", "đề xuất vài món", "cho mình xem đồ đi làm", "có mẫu nào đẹp không", "có size gì", "giá bao nhiêu", "còn hàng không"]) {
      expect(withUser(invented, q), q).toBe("catalog")
    }
  })

  it("số đo để chọn size và câu hỏi về đơn hàng cũng bắt buộc có tool", () => {
    for (const q of ["mình cao 1m65 nặng 55kg mặc quần jeans nữ size nào", "70kg mặc size gì", "đơn hàng gần nhất của mình đang ở đâu", "tra đơn FS-20261112-0001"]) {
      expect(withUser("Bạn nên chọn size 30.", q, { hasKnowledge: true }), q).toBe("catalog")
    }
  })

  it("câu hỏi về kiến thức hoặc chính sách không bị coi là cần tool", () => {
    for (const q of ["áo linen giặt thế nào", "ship bao nhiêu", "đổi trả trong mấy ngày", "hôm nay giá vàng bao nhiêu", "chào bạn"]) {
      expect(withUser("Giặt khoảng 30°C, không sấy.", q, { hasKnowledge: true }), q).toBeNull()
    }
  })

  it("khách hỏi size/giá vẫn cần tool dù có khối kiến thức (kiến thức chung không phải dữ liệu của sản phẩm)", () => {
    expect(withUser("Các size thường gặp là S, M, L.", "có size gì", { hasKnowledge: true })).toBe("catalog")
  })

  it("khách trả lời ngắn cho câu hỏi mua hàng ('S', '4', 'màu trắng'): phải qua tool thêm vào giỏ", () => {
    const asked = "Bạn muốn thêm áo sơ mi poplin công sở vào giỏ không? Size nào và số lượng là bao nhiêu?"
    for (const reply of ["S", "4", "màu trắng", "size M, 2 cái"]) {
      expect(withUser("Bạn có thể nói rõ hơn không ạ?", reply, { previousAssistant: asked }), reply).toBe("confirmation")
    }
  })

  it("không coi là trả lời mua hàng khi câu liền trước không hỏi về mua, hoặc câu của khách dài hay là câu hỏi", () => {
    expect(withUser("Ok", "S", { previousAssistant: "Giặt máy ở 30°C là được." })).toBeNull()
    expect(withUser("Ok", "S", { previousAssistant: "Bạn muốn thêm vào giỏ" })).toBeNull() // câu trước không phải câu hỏi
    expect(withUser("Ok", "mình muốn hỏi thêm về chất liệu của sản phẩm này và cách bảo quản", { previousAssistant: "Bạn muốn mua không?" })).toBeNull()
    expect(withUser("Ok", "size này có vừa không?", { previousAssistant: "Bạn muốn mua không?" })).toBeNull()
  })

  it("lần kiểm sau khi thử lại chỉ xét chữ của model: câu hỏi lại hợp lệ được qua", () => {
    expect(detect("Bạn muốn size nào và màu gì để mình thêm vào giỏ?")).toBeNull()
  })
})

describe("detectUngroundedClaim: JSON lạ và 'xác nhận' bằng chữ", () => {
  it("bắt câu trả lời là JSON thô (lỗi thật: `{ \"error\": \"not implemented\" }`)", () => {
    for (const t of ['{ "error": "not implemented" }', '  { "error": "Không có dữ liệu xác nhận" }', '[{"a":1}]']) {
      expect(detect(t), t).toBe("junk")
    }
  })

  it("không bắt câu có ngoặc nhưng không bắt đầu bằng JSON", () => {
    expect(detect("Mình có {một} gợi ý cho bạn")).toBeNull()
  })

  it("bắt câu bảo khách 'xác nhận' bằng chữ, vì chỉ nút trên thẻ mới có tác dụng", () => {
    expect(detect("Hãy xác nhận để mình giúp bạn thêm nhé!")).toBe("confirmation")
    expect(detect("Vui lòng xác nhận giúp mình")).toBe("confirmation")
  })

  it("câu thay thế cho JSON lạ không tự kích hoạt cổng", () => {
    expect(detect(CLAIM_FALLBACK.junk)).toBeNull()
  })
})

describe("ranh giới từ tiếng Việt", () => {
  it("nhận ra từ kết thúc bằng chữ có dấu ('gợi ý', 'giỏ', 'gì') — `\b` của JS không làm được việc này", () => {
    const withUser = (userText: string, previousAssistant?: string) => detectUngroundedClaim("ok", { hasKnowledge: false, userText, previousAssistant })
    expect(withUser("gợi ý")).toBe("catalog")
    expect(withUser("có gì")).toBe("catalog")
    expect(withUser("size gì")).toBe("catalog")
    expect(withUser("đề xuất")).toBe("catalog")
    expect(withUser("S", "Bạn có muốn bỏ thêm vào giỏ không?")).toBe("confirmation")
    expect(withUser("S", "Bạn muốn size nào?")).toBe("confirmation")
  })

  it("không khớp giữa chừng một từ khác ('tìm' trong 'bảo tìm', 'mua' trong 'mua' là ok nhưng 'muối' không)", () => {
    expect(detectUngroundedClaim("ok", { hasKnowledge: true, userText: "hãy kiểm tra muối" })).toBeNull()
    expect(detectUngroundedClaim("ok", { hasKnowledge: true, userText: "giặt tay hay giặt máy" })).toBeNull()
  })
})

describe("trả lời mua hàng chặt hơn và gõ chữ 'xác nhận'", () => {
  const detectWith = (userText: string, previousAssistant: string) => detectUngroundedClaim("ok", { hasKnowledge: false, userText, previousAssistant })

  it("khách mở một yêu cầu mới thì không bị coi là trả lời ô trống", () => {
    const asked = "Bạn muốn thêm sản phẩm nào vào giỏ hàng không?"
    for (const q of ["thêm đại 1 sản phẩm cho tôi", "mua giúp mình áo thun", "cho mình cái khác", "mở giỏ giúp mình"]) {
      expect(detectWith(q, asked), q).toBeNull()
    }
  })

  it("trợ lý chỉ hỏi chung chung về giỏ hoặc chính sách thì 'có', 'ừ' không bị coi là trả lời mua hàng", () => {
    expect(detectWith("có", "Bạn muốn xem giỏ hàng không?")).toBeNull()
    expect(detectWith("S", "Bạn muốn tìm hiểu thêm về chính sách không?")).toBeNull()
  })

  it("khi trợ lý đang hỏi size, màu, số lượng thì câu ngắn của khách là trả lời mua hàng", () => {
    expect(detectWith("S", "Bạn chọn size nào?")).toBe("confirmation")
    expect(detectWith("trắng", "Bạn thích màu gì?")).toBe("confirmation")
    expect(detectWith("4", "Số lượng là bao nhiêu?")).toBe("confirmation")
  })

  it("ý xin gợi ý/hỏi dữ liệu được ưu tiên hơn ý trả lời mua hàng", () => {
    expect(detectWith("gợi ý cho tôi đi", "Bạn muốn thêm sản phẩm nào vào giỏ hàng không?")).toBe("catalog")
  })

  it("nhận ra khách chỉ gõ chữ 'xác nhận' và không nhầm với câu dài hơn", () => {
    for (const t of ["Xác nhận", "xác nhận.", " đồng ý ", "chốt!"]) expect(isBareConfirmation(t), t).toBe(true)
    for (const t of ["xác nhận đơn FS-20261110-0003 giúp mình", "mình muốn xác nhận lại size", "ok", "đồng ý với chính sách không?"]) expect(isBareConfirmation(t), t).toBe(false)
    expect(BARE_CONFIRMATION_REPLY).toContain("nút Xác nhận trên thẻ")
    expect(detect(BARE_CONFIRMATION_REPLY)).toBeNull() // câu cố định không tự kích hoạt cổng
  })
})

describe("danh sách size trong chữ của model (lỗi thật: 'Size có sẵn cho các sản phẩm trên: - S, M, L, XL')", () => {
  it("bắt danh sách size dù cách xa chữ 'size'", () => {
    for (const t of [
      "Size có sẵn cho các sản phẩm trên: - S, M, L, XL",
      "Các size có trong sản phẩm thường là: S, M, L, XL. Bạn chọn size nào?",
      "Có M / L còn hàng",
      "Chỉ còn S và M",
    ]) {
      expect(detect(t), t).toBe("catalog")
    }
  })

  it("không bắt chữ thường hoặc một size đơn lẻ", () => {
    for (const t of ["Bạn chọn size M nhé", "Mình mặc size L thì vừa", "Chào, mình là m, l, s đây"]) {
      expect(detect(t), t).toBeNull()
    }
  })
})

describe("ý định phối đồ", () => {
  const withUser = (userText: string) => detectUngroundedClaim("Bạn nên mặc áo sơ mi trắng.", { hasKnowledge: true, userText })

  it("khách xin phối đồ thì bắt buộc có tool, kể cả có khối kiến thức; thử lại chỉ với tool phối đồ", () => {
    for (const q of ["Phối đồ đi làm", "phối cả bộ cho mình", "đi đám cưới mặc gì", "cho mình outfit đi biển", "nên mặc gì đi họp"]) {
      expect(withUser(q), q).toBe("catalog")
      expect(retryPlanFor("catalog", q).tools, q).toEqual(["getOutfitSuggestion"])
    }
  })

  it("câu hỏi size hoặc giặt ủi chứa 'mặc' không bị nhầm thành phối đồ", () => {
    expect(retryPlanFor("catalog", "mình cao 1m70 nặng 65kg mặc size gì").tools).toEqual(["getSizeRecommendation"])
    expect(withUser("áo linen giặt thế nào")).toBeNull()
  })
})

describe("câu trả lời cố định cho phối đồ do server tự chạy", () => {
  it("nhận ra kế hoạch phối đồ và dựng câu theo kết quả tool", () => {
    expect(isOutfitPlan(retryPlanFor("catalog", "phối đồ đi làm"))).toBe(true)
    expect(isOutfitPlan(retryPlanFor("catalog", "gợi ý cho tôi đi"))).toBe(false)
    expect(isOutfitPlan(retryPlanFor("confirmation", "S"))).toBe(false)
    expect(outfitReplyText({ ok: true, title: "Bộ đồ đi làm cho nữ", totalPrice: 898000 })).toContain("898.000")
    expect(outfitReplyText({ ok: false, code: "NEED_GENDER" })).toContain("nam, nữ hay unisex")
    expect(outfitReplyText({ ok: false, code: "OVER_BUDGET" })).toContain("ngân sách")
    expect(outfitReplyText({ ok: false, code: "NO_OUTFIT" })).toContain("chưa đủ món")
    expect(outfitReplyText(undefined)).toBe(CLAIM_FALLBACK.catalog)
  })
})

describe("ý định thêm vào giỏ (lỗi thật: 'Không có sản phẩm X còn hàng' dù còn, không gọi tool)", () => {
  const ctx = (userText: string, hasKnowledge = true) => ({ hasKnowledge, userText })

  it.each([
    "thêm áo sơ mi slim fit không nhăn size M màu trắng vào giỏ giúp mình",
    "cho mình áo thun đen size L vào giỏ",
    "Thêm 2 cái quần jeans vào giỏ hàng",
    "bỏ cái đó vào giỏ đi",
    "nhét thêm mũ bucket vào giỏ",
  ])("khách %j: bắt buộc có tool addToCart, kể cả khi có khối kiến thức và câu trả lời trông vô hại", (userText) => {
    expect(detectUngroundedClaim("Không có sản phẩm này còn hàng. Bạn muốn tìm mẫu khác không?", ctx(userText))).toBe("confirmation")
    expect(detectUngroundedClaim("Bạn cho mình biết size nhé", ctx(userText))).toBe("confirmation")
  })

  it.each(["xem giỏ hàng giúp mình", "mở giỏ hàng", "xoá áo khỏi giỏ", "áo này giặt thế nào"])(
    "câu %j không phải yêu cầu thêm vào giỏ",
    (userText) => {
      expect(detectUngroundedClaim("Mình chưa có thông tin này.", ctx(userText))).toBeNull()
    },
  )

  it("hỏi nội dung giỏ ('giỏ hàng của mình có gì') là câu cần tool xem giỏ (catalog), không phải yêu cầu thêm vào giỏ", () => {
    expect(detectUngroundedClaim("Giỏ của bạn có 2 món.", ctx("giỏ hàng của mình có gì"))).toBe("catalog")
  })

  it("yêu cầu tự đủ nghĩa: lần thử lại chỉ gửi câu của khách (standalone); câu trả lời ngắn 'S' hay lỗi do model nói thì không", () => {
    expect(retryPlanFor("confirmation", "thêm áo slim fit size M vào giỏ").standalone).toBe(true)
    expect(retryPlanFor("confirmation", "S").standalone).toBeUndefined()
    expect(retryPlanFor("catalog", "áo này size gì").standalone).toBeUndefined()
  })

  it("kế hoạch thử lại thu hẹp còn đúng tool addToCart", () => {
    expect(retryPlanFor("confirmation", "thêm áo vào giỏ").tools).toEqual(["addToCart"])
  })
})
