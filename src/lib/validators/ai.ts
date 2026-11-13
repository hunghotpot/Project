import { z } from "zod"
import { ALLOWED_PATH } from "@/lib/ai/ui-actions"

/*
 * Zod schema cho tầng AI (docs/ai/03-rag-advisor.md, 04-tool-calling.md). Đầu vào tư vấn size, yêu cầu chat, siêu dữ liệu kiến thức và tool đọc;
 * schema còn lại (outfit, xác nhận ghi...) sẽ thêm vào đây khi làm tới.
 */

// Khoảng hợp lệ cũng là khoảng của form nhập số đo ở UI (size-info-card).
const measure = (min: number, max: number) => z.number().min(min).max(max).optional()

export const sizeAdviceInputSchema = z.object({
  productSlug: z.string().trim().min(1).max(100),
  heightCm: measure(100, 230),
  weightKg: measure(25, 250),
  chestCm: measure(60, 160),
  waistCm: measure(45, 160),
  hipCm: measure(60, 170),
  fit: z.enum(["tight", "regular", "loose"]).default("regular"),
})

export type SizeAdviceRequest = z.input<typeof sizeAdviceInputSchema>

/*
 * Yêu cầu chat (`POST /api/ai/chat`): lịch sử gồm các lượt chữ, tin cuối là của người dùng. Chỉ chữ, không có thẻ (thẻ do server
 * dựng từ tool, không do client gửi lên). Giới hạn độ dài đặt ở đây là trần cứng; `AI_MAX_INPUT_CHARS` có thể siết thêm ở server.
 */
export const MAX_CHAT_MESSAGE_CHARS = 1000
export const MAX_CHAT_MESSAGES = 20
/** Câu trả lời của trợ lý được gửi lại làm ngữ cảnh nên cho dài hơn tin người dùng. */
const MAX_ASSISTANT_MESSAGE_CHARS = 4000

const userMessage = z.object({ role: z.literal("user"), text: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS) })
/** Tối đa số dòng và độ dài mỗi dòng mô tả thẻ đã hiện (dấu vết tool trong lịch sử, xem docs/ai/04 mục 7.4). */
export const MAX_SHOWN_ITEMS = 8
export const MAX_SHOWN_CHARS = 200

const assistantMessage = z.object({
  role: z.literal("assistant"),
  text: z.string().trim().min(1).max(MAX_ASSISTANT_MESSAGE_CHARS),
  /** Các thẻ (sản phẩm, size, bộ đồ, xác nhận) trợ lý đã hiện kèm câu trả lời này; chỉ để model hiểu "cái đầu tiên", "thêm đi". */
  shown: z.array(z.string().trim().min(1).max(MAX_SHOWN_CHARS)).max(MAX_SHOWN_ITEMS).optional(),
})

export const chatRequestSchema = z.object({
  messages: z
    .array(z.discriminatedUnion("role", [userMessage, assistantMessage]))
    .min(1)
    .max(MAX_CHAT_MESSAGES)
    // `.at(-1)?`: Zod 4 vẫn chạy refine khi mảng rỗng (đã trượt `.min(1)`), nên không được giả định có phần tử.
    .refine((m) => m.at(-1)?.role === "user", { message: "Tin nhắn cuối phải của người dùng" }),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

/*
 * Siêu dữ liệu của một đoạn kiến thức (dòng `<!-- meta: {...} -->` trong docs/ai/knowledge/*.md, xem README ở đó).
 * `strict`: tên khoá lạ (gõ sai) làm lỗi ngay khi nạp thay vì bị bỏ qua.
 */
export const KNOWLEDGE_TYPES = ["care", "styling", "policy", "faq"] as const
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]

export const knowledgeMetaSchema = z
  .object({
    categories: z.array(z.string()).optional(),
    gender: z.enum(["men", "women", "unisex"]).optional(),
    seasons: z.array(z.enum(["xuân", "hè", "thu", "đông"])).optional(),
    materials: z.array(z.string()).optional(),
    occasions: z.array(z.string()).optional(),
    /** tra-cuu: đã đối chiếu nguồn bên ngoài; kinh-nghiem: kiến thức chung chưa đối chiếu riêng. */
    basis: z.enum(["tra-cuu", "kinh-nghiem"]).optional(),
  })
  .strict()

export type KnowledgeMeta = z.infer<typeof knowledgeMetaSchema>

/*
 * Tool của trợ lý (docs/ai/04-tool-calling.md). Đầu vào do LLM sinh nên luôn `parse` lại ở server; không có tham số nào là userId/role.
 * Đầu ra (DTO rút gọn) cho thẻ trên giao diện cũng khai báo ở đây để client kiểm lại trước khi vẽ.
 */
export const searchProductsInputSchema = z.object({
  /** Mô tả tự nhiên của khách, vd "áo sơ mi trắng đi làm dưới 500k". */
  query: z.string().trim().min(1).max(200),
  maxResults: z.number().int().min(1).max(12).default(6),
})

/*
 * Tool applyFilters không nhận giá trị lọc nào từ model: model 4B bịa giá, giới tính, bỏ sót size và điền bừa danh mục/chất liệu/mùa
 * (đo ở docs/ai/04 mục 7), nên điều kiện lấy bằng code từ câu của khách (xem tools/apply-filters.ts).
 */
export const applyFiltersInputSchema = z.object({})

/** Tool tư vấn size nhận TÊN sản phẩm (hoặc slug thật), không nhận slug thô: model 4B hay bịa slug nên server tự đổi tên thành slug thật. */
export const getSizeRecommendationInputSchema = sizeAdviceInputSchema.omit({ productSlug: true }).extend({
  product: z.string().trim().min(1).max(120).describe("Tên sản phẩm khách nhắc tới (hoặc slug nếu đã có từ kết quả tìm); không tự bịa slug"),
})

/** Nhận TÊN sản phẩm (hoặc slug thật) như tool size/giỏ: model 4B hay bịa slug (đo: `ao-so-mi-poplin-con-guo`). */
export const getProductDetailInputSchema = z.object({
  product: z.string().trim().min(1).max(120).describe("Tên sản phẩm khách nhắc tới (hoặc slug nếu đã có từ kết quả tìm); không tự bịa slug"),
})

/** `orderCode` bỏ trống (kể cả chuỗi rỗng, model 4B hay gửi `""`): lấy đơn gần nhất của khách. */
export const getOrderStatusInputSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || undefined),
})

export const navigateInputSchema = z.object({ to: z.string().trim().max(120).regex(ALLOWED_PATH) })

export const sizeRecommendationSchema = z.object({
  status: z.enum(["recommended", "between_two", "need_info", "out_of_range", "no_chart"]),
  productName: z.string().nullable(),
  recommendedSize: z.string().nullable(),
  alternativeSize: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  reasons: z.array(z.string()),
  missingFields: z.array(z.enum(["heightCm", "weightKg", "chestCm", "waistCm", "hipCm"])),
  stock: z.object({ size: z.string(), available: z.boolean(), colors: z.array(z.string()) }).nullable(),
  message: z.string().nullable(),
})

export const sizeChartRowSchema = z.object({
  size: z.string(),
  chest: z.number().nullable(),
  waist: z.number(),
  hip: z.number(),
  heightMin: z.number(),
  heightMax: z.number(),
  weightMin: z.number(),
  weightMax: z.number(),
})

/** Thẻ sản phẩm rút gọn hiện trong chat. */
export const productCardLiteSchema = z.object({
  slug: z.string().max(100),
  name: z.string().max(200),
  /** VND */
  price: z.number().int().nonnegative(),
  categoryName: z.string().max(100),
  image: z.object({ url: z.string().max(500), alt: z.string().max(200) }).nullable(),
  colors: z.array(z.string().max(40)).max(8),
})

export type ProductCardLite = z.infer<typeof productCardLiteSchema>

/*
 * Tool GHI duy nhất: addToCart (docs/ai/04-tool-calling.md mục 3). Model đưa TÊN sản phẩm, size, màu và số lượng khách nói; server
 * tự đổi thành biến thể thật (model 4B hay bịa id/slug) và chỉ tạo thẻ xác nhận, việc ghi giỏ nằm ở POST /api/ai/confirm.
 */
const blankToUndefined = (v: string | undefined) => v || undefined

export const addToCartInputSchema = z.object({
  product: z.string().trim().min(1).max(120).describe("Tên sản phẩm khách muốn thêm (hoặc slug thật)"),
  size: z.string().trim().max(20).optional().transform(blankToUndefined).describe("Size khách chọn, ví dụ M; bỏ trống nếu khách chưa nói"),
  color: z.string().trim().max(40).optional().transform(blankToUndefined).describe("Màu khách chọn, ví dụ Trắng; bỏ trống nếu khách chưa nói"),
  quantity: z.number().int().min(1).max(99).default(1),
})

/** Nội dung thẻ xác nhận hiện trong chat (khớp `ConfirmView` ở types/assistant). */
export const confirmViewSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200),
  lines: z.array(z.string().max(300)).max(10),
  /** VND */
  total: z.number().int().nonnegative(),
  expiresInMinutes: z.number().int().positive().max(60),
})

/** `POST /api/ai/confirm`: chỉ khách bấm nút trên giao diện mới gọi; không đi qua model. */
export const confirmRequestSchema = z.object({
  confirmationId: z.string().regex(/^[0-9a-f]{32}$/),
  action: z.enum(["confirm", "cancel"]),
})

export type ConfirmRequest = z.infer<typeof confirmRequestSchema>

/*
 * Tool getOutfitSuggestion (Mix & Match). Model chỉ đưa tên sản phẩm khách đã chọn sẵn (nếu có); giới tính, dịp, mùa, ngân sách, size
 * lấy bằng code từ câu của khách (model 4B hay bịa các điều kiện này, xem docs/ai/04 mục 7).
 */
export const getOutfitSuggestionInputSchema = z.object({
  product: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(blankToUndefined)
    .describe("Tên sản phẩm khách đã chọn và muốn phối thêm; bỏ trống nếu khách chỉ nói dịp hoặc phong cách"),
})

/** Thẻ bộ đồ hiện trong chat (khớp `OutfitView` ở types/assistant); giá và tổng tiền do code tính. */
export const outfitViewSchema = z.object({
  title: z.string().max(80),
  occasion: z.string().max(60).nullable(),
  seasons: z.array(z.string().max(20)).max(4),
  items: z
    .array(
      z.object({
        slot: z.enum(["top", "bottom", "dress", "outer", "accessory"]),
        slug: z.string().max(100),
        name: z.string().max(200),
        image: z.object({ url: z.string().max(500), alt: z.string().max(200) }).nullable(),
        variantLabel: z.string().max(80),
        price: z.number().int().nonnegative(),
        reason: z.string().max(200).nullable(),
      }),
    )
    .min(1)
    .max(5),
  totalPrice: z.number().int().nonnegative(),
  knowledgeSources: z.array(z.string().max(200)).max(5),
  missingSlots: z.array(z.string().max(60)).max(5),
  note: z.string().max(200).nullable(),
})

