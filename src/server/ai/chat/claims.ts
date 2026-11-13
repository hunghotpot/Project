/*
 * Cổng kiểm chứng câu trả lời (docs/ai/05-safety-and-guardrails.md). Model 4B ở các lượt nối tiếp ("gợi ý cho tôi đi", "có size gì",
 * "S", "4") hay KHÔNG gọi tool mà vẫn trả lời như thể đã có dữ liệu: nói "bấm Xác nhận trên thẻ" khi chưa có thẻ nào, kể tên sản
 * phẩm, size, giá tự bịa, hoặc xuất ra JSON lạ (đo: 0/5 lần gọi tool ở lượt nối tiếp, dù nhắc trong prompt).
 * Cổng nhìn vào CẢ câu của khách (khách xin gợi ý, hỏi size/giá, trả lời tiếp khi đang mua thì bắt buộc phải có tool) lẫn chữ của
 * model (khẳng định cần bằng chứng). Khi lượt đó chưa gọi tool nào mà vi phạm, handler thử lại một lần với tập tool bị thu hẹp (đo:
 * 5/5 lần gọi đúng, kể cả đủ tên, size, màu, số lượng), và nếu vẫn không được thì thay bằng câu trung thực.
 * Hàm thuần, test không cần model.
 */

export type ClaimKind = "confirmation" | "catalog" | "junk"

// --- Chữ của model ---------------------------------------------------------------------------------------------------------

// Khẳng định đã có thẻ xác nhận, đã thêm vào giỏ, hoặc bảo khách "xác nhận" bằng chữ (chỉ bấm nút trên thẻ mới có tác dụng).
const CONFIRMATION =
  /xác nhận (?:trên|ở|vào) thẻ|bấm\s+(?:nút\s+)?["“'‘]?xác nhận|thẻ xác nhận|(?:hãy|vui lòng|xin)\s+xác nhận\b|xác nhận để|đã (?:được )?thêm\b[^.\n]{0,60}giỏ/i

// Câu phủ định trung thực ("chưa có thẻ xác nhận nào", "chưa thêm gì vào giỏ") không phải là khẳng định. Dấu câu cắt vế: "…không? Hãy bấm
// Xác nhận trên thẻ" vẫn là khẳng định.
const NEGATED = /\b(?:chưa|không|chẳng)\b[^.?!\n]{0,30}(?:thẻ|thêm|giỏ)/i

// Khẳng định dữ liệu cửa hàng: giá tiền, danh sách size, còn/hết hàng. Chỉ đúng khi tool tìm hoặc xem chi tiết vừa chạy.
const PRICE = /\d[\d.,]*\s?(?:đ|₫|vnđ|vnd|k\b|nghìn|triệu)/i
// Hai size viết hoa liền nhau trở lên ("S, M, L, XL", "M / L"); phân biệt hoa thường để không nhầm với chữ thường tiếng Việt.
const SIZE_TOKEN = String.raw`(?:XXXL|XXL|XL|XXS|XS|S|M|L)`
const SIZE_LIST = new RegExp(String.raw`(?<![\p{L}\p{N}])${SIZE_TOKEN}(?:\s*(?:,|/|và|hoặc)\s*${SIZE_TOKEN})+(?![\p{L}\p{N}])`, "u")
const STOCK = /\b(?:còn|hết) hàng\b/i

// Model đôi khi xuất JSON thô (vd `{ "error": "not implemented" }`) làm câu trả lời: khách không bao giờ nên thấy.
const JSON_LEAK = /^\s*[{[]/

// --- Câu của khách ---------------------------------------------------------------------------------------------------------

// Khách xin gợi ý, tìm sản phẩm, hoặc hỏi dữ liệu cửa hàng (size, màu, giá, còn hàng): chỉ trả lời đúng được bằng tool.
// Lưu ý: `\b` của JavaScript chỉ hiểu chữ ASCII ("gợi ý" kết thúc bằng "ý" nên `\b` không bao giờ khớp), nên dùng ranh giới theo chữ Unicode.
const START = String.raw`(?<![\p{L}\p{N}])`
const END = String.raw`(?![\p{L}\p{N}])`
const WANTS_PRODUCTS = new RegExp(
  [
    `${START}(?:gợi ý|đề xuất|tìm)${END}`,
    `${START}có (?:những |các )?(?:gì|mẫu|sản phẩm|loại|màu|size)${END}`,
    `${START}(?:còn|hết) (?:hàng|size)${END}`,
    `${START}(?:size|màu) (?:gì|nào)${END}`,
    `${START}giá (?:bao nhiêu|thế nào|sao)${END}`,
    `${START}bao nhiêu tiền${END}`,
    `${START}cho (?:mình|tôi|em) xem${END}`,
  ].join("|"),
  "iu",
)
// Khách nêu số đo để chọn size (cần getSizeRecommendation) hoặc hỏi về đơn hàng (cần getOrderStatus): cũng chỉ trả lời đúng được bằng tool.
const MEASUREMENT = new RegExp(`(?:cao|nặng)\\s*\\d|\\d\\s*(?:kg|cm)${END}|${START}mặc size${END}|\\d\\s?m\\s?\\d{2}(?!\\d)`, "iu")
const OUTFIT_QUESTION = new RegExp(`${START}(?:phối đồ|phối cả bộ|bộ đồ|outfit|mix|mặc gì|mặc đồ gì|nên mặc|cả bộ)${END}`, "iu")
const ORDER_QUESTION = new RegExp(`${START}(?:đơn hàng|mã đơn|tra đơn)${END}|FS-\\d`, "iu")

// Câu hỏi mua hàng của trợ lý đang chờ khách điền: hỏi size, màu, số lượng, hoặc hỏi có muốn thêm vào giỏ không.
const PURCHASE_QUESTION = new RegExp(`${START}(?:size|màu|số lượng|thêm[^?.!]{0,40}giỏ|mua)${END}`, "iu")
// Câu mở đầu một yêu cầu mới (không phải trả lời một ô trống): "thêm đại 1 sản phẩm", "cho mình xem…".
const NEW_REQUEST = new RegExp(`^\\s*(?:thêm|mua|cho|đặt|gợi ý|tìm|xem|mở|đưa|lọc)${END}`, "iu")
// Khách yêu cầu thêm sản phẩm vào giỏ ("thêm áo X size M vào giỏ", "cho mình áo Y vào giỏ"): chỉ làm đúng được bằng tool addToCart.
// Lỗi thật (2026-11-14): sau một lượt trợ lý báo "không có size M còn hàng", model 4B lặp lại kiểu trả lời đó cho sản phẩm khác mà không gọi
// tool ("Không có sản phẩm X còn hàng" dù còn). Luật "câu có chữ còn/hết hàng mà chưa gọi tool" bị tắt khi có khối kiến thức, nên cần luật
// theo ý định của khách, không phụ thuộc chữ model viết.
const ADD_TO_CART = new RegExp(`${START}(?:thêm|cho|bỏ|để|nhét|đưa)${END}[^.?!\\n]{0,80}?${START}vào giỏ${END}`, "iu")
// Khách gõ chữ "xác nhận" thay vì bấm nút trên thẻ.
const BARE_CONFIRM = /^\s*(?:xác nhận|đồng ý|chốt)\s*[.!]*\s*$/iu
const MAX_REPLY_CHARS = 40

export interface ClaimContext {
  /** Câu trả lời đang dựa trên khối kiến thức (chính sách có thể nêu giá như "miễn phí ship từ 500.000 đ"). */
  hasKnowledge: boolean
  /** Câu cuối của khách; bỏ trống để chỉ kiểm chữ của model (dùng cho lần kiểm sau khi đã thử lại). */
  userText?: string
  /** Câu trả lời liền trước của trợ lý, để nhận ra khách đang trả lời tiếp một câu hỏi mua hàng. */
  previousAssistant?: string
}

/** Khách trả lời ngắn cho câu hỏi mua hàng của trợ lý ("S", "4", "màu trắng"): phải đi qua tool thêm vào giỏ, không để model tự nói. */
function isPurchaseReply({ userText, previousAssistant }: ClaimContext): boolean {
  if (!userText || !previousAssistant) return false
  const text = userText.trim()
  return (
    text.length > 0 &&
    text.length <= MAX_REPLY_CHARS &&
    !text.includes("?") &&
    !NEW_REQUEST.test(text) &&
    previousAssistant.includes("?") &&
    PURCHASE_QUESTION.test(previousAssistant)
  )
}

/** Khách chỉ gõ "xác nhận": chỉ nút trên thẻ mới thêm được vào giỏ, nên trả lời cố định thay vì để model tự nói (đã thấy nó xuất JSON lạ). */
export const isBareConfirmation = (userText: string) => BARE_CONFIRM.test(userText)

export const BARE_CONFIRMATION_REPLY =
  "Để thêm vào giỏ, bạn bấm nút Xác nhận trên thẻ nhé (gõ chữ thì mình chưa làm được). Nếu chưa thấy thẻ, bạn nói lại tên sản phẩm, size, màu và số lượng để mình tạo lại thẻ."

/**
 * Loại vi phạm trong lượt này (null nếu không có). Chỉ gọi khi lượt đó chưa gọi tool nào.
 * Câu khẳng định đã thêm vào giỏ luôn cần bằng chứng; giá và size trong chữ của model chỉ bị coi là dữ liệu cửa hàng khi không có
 * khối kiến thức làm nền; nhưng khách hỏi trực tiếp về sản phẩm, size, giá thì luôn cần tool, kể cả có kiến thức.
 */
export function detectUngroundedClaim(text: string, ctx: ClaimContext): ClaimKind | null {
  if (JSON_LEAK.test(text)) return "junk"
  if (CONFIRMATION.test(text) && !NEGATED.test(text)) return "confirmation"
  if (ctx.userText && ADD_TO_CART.test(ctx.userText)) return "confirmation"
  if (ctx.userText && (WANTS_PRODUCTS.test(ctx.userText) || MEASUREMENT.test(ctx.userText) || ORDER_QUESTION.test(ctx.userText) || OUTFIT_QUESTION.test(ctx.userText))) return "catalog"
  if (isPurchaseReply(ctx)) return "confirmation"
  if (!ctx.hasKnowledge && (PRICE.test(text) || SIZE_LIST.test(text) || STOCK.test(text))) return "catalog"
  return null
}

/** Lần thử lại: chỉ để lại các tool phù hợp và nhắc đúng việc cần làm (đo: tập tool hẹp là điều làm model gọi được). Không có kế hoạch cho `junk`. */
export const RETRY_PLAN: Record<Exclude<ClaimKind, "junk">, { tools: string[]; note: string }> = {
  confirmation: {
    tools: ["addToCart"],
    note: "\n\nLƯU Ý LƯỢT NÀY: chưa có thẻ xác nhận nào. Khách đang muốn thêm sản phẩm vào giỏ: hãy gọi công cụ thêm vào giỏ NGAY với tên sản phẩm, size, màu, số lượng khách đã nói (kể cả ở các lượt trước). Công cụ sẽ báo nếu còn thiếu gì để bạn hỏi lại. Tuyệt đối không nói là đã có thẻ hay đã thêm vào giỏ.",
  },
  catalog: {
    tools: ["searchProducts", "getProductDetail"],
    note: "\n\nLƯU Ý LƯỢT NÀY: khách đang cần dữ liệu thật của cửa hàng. Hãy gọi công cụ phù hợp rồi mới trả lời; không tự kể sản phẩm, giá, size, tồn kho hay tình trạng đơn hàng.",
  },
}

// Khách hỏi về MỘT sản phẩm (size, màu, giá, còn hàng) thì cần xem chi tiết; còn xin gợi ý hoặc tìm thì cần tìm kiếm.
const ABOUT_ONE_PRODUCT = new RegExp(`${START}(?:size|màu|giá|còn hàng|hết hàng|bao nhiêu tiền)${END}`, "iu")

/**
 * Kế hoạch thử lại cho `kind`. Với `catalog`, chỉ để lại MỘT tool hợp ý khách (đo: một tool duy nhất làm model gọi 5/5 lần, hai tool thì
 * model hay bỏ qua cả hai).
 */
function catalogTool(userText: string): string {
  if (MEASUREMENT.test(userText)) return "getSizeRecommendation"
  if (ORDER_QUESTION.test(userText)) return "getOrderStatus"
  if (OUTFIT_QUESTION.test(userText)) return "getOutfitSuggestion"
  return ABOUT_ONE_PRODUCT.test(userText) ? "getProductDetail" : "searchProducts"
}

export interface RetryPlan {
  tools: string[]
  note: string
  /**
   * Yêu cầu của khách tự đủ nghĩa ("thêm áo X size M vào giỏ"): lần thử lại chỉ gửi câu đó, bỏ các tin của trợ lý. Đo: sau một lượt
   * trợ lý từ chối ("không có size M còn hàng") model bắt chước câu từ chối cho sản phẩm khác mà không gọi tool, kể cả khi tập tool đã thu hẹp.
   */
  standalone?: boolean
}

export function retryPlanFor(kind: Exclude<ClaimKind, "junk">, userText: string): RetryPlan {
  if (kind === "catalog") return { ...RETRY_PLAN.catalog, tools: [catalogTool(userText)] }
  return ADD_TO_CART.test(userText) ? { ...RETRY_PLAN[kind], standalone: true } : RETRY_PLAN[kind]
}

/** Câu thay thế khi thử lại vẫn không có bằng chứng: nói thật điều chưa làm được và hỏi lại thông tin cần. */
export const CLAIM_FALLBACK: Record<ClaimKind, string> = {
  confirmation: "Mình chưa tạo được thẻ xác nhận nên chưa thêm gì vào giỏ. Bạn cho mình biết tên sản phẩm, size, màu và số lượng muốn thêm nhé.",
  catalog: "Mình chưa tra được thông tin này từ cửa hàng. Bạn nói rõ tên sản phẩm giúp mình nhé, hoặc dùng ô tìm kiếm trên website.",
  junk: "Mình chưa hiểu ý bạn. Bạn nói lại giúp mình, ví dụ tên sản phẩm bạn quan tâm hoặc điều bạn muốn làm nhé.",
}

/** Tool phối đồ không cần tham số từ model, nên khi model vẫn không chịu gọi sau khi thử lại thì server tự chạy tool (xem handler). */
export const isOutfitPlan = (plan: { tools: string[] }) => plan.tools.length === 1 && plan.tools[0] === "getOutfitSuggestion"

/** Câu trả lời cố định cho kết quả tool phối đồ do server tự chạy (thẻ bộ đồ đã được tool phát riêng). */
export function outfitReplyText(result: { ok: boolean; code?: string; message?: string; title?: string; totalPrice?: number } | undefined): string {
  if (!result) return CLAIM_FALLBACK.catalog
  if (result.ok) {
    const total = typeof result.totalPrice === "number" ? ` (tổng ${new Intl.NumberFormat("vi-VN").format(result.totalPrice)} đ)` : ""
    return `Mình đã phối "${result.title ?? "bộ đồ"}"${total}, bạn xem thẻ bên dưới nhé. Bạn chọn size ở từng sản phẩm trước khi thêm vào giỏ.`
  }
  if (result.code === "NEED_GENDER") return "Bạn muốn phối đồ cho nam, nữ hay unisex? Nói thêm dịp, mùa hoặc ngân sách (nếu có) để mình phối đúng ý bạn nhé."
  if (result.code === "OVER_BUDGET") return "Hiện chưa có bộ nào còn hàng trong ngân sách này. Bạn tăng ngân sách một chút hoặc đổi dịp được không?"
  return "Hiện chưa đủ món còn hàng để phối thành bộ cho yêu cầu này. Bạn thử đổi dịp hoặc giới tính nhé."
}
