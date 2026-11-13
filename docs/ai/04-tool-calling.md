# 04 · Tool Calling

LLM không chạm DB. Nó chỉ **đề nghị** gọi tool; server thực thi tool bằng cách gọi **service thật** với quyền của người dùng hiện tại; kết quả (đã lọc trường) quay lại LLM. Mọi tool có Zod schema cho đầu vào và đầu ra.

Cột "Service" dưới đây là hàm **thật** trong code (xem `docs/architecture.md`). Bảng mô tả đúng tập tool đóng hiện có (10 tool); lý do các khác biệt so với thiết kế ban đầu (nhận **tên** sản phẩm thay vì slug, `applyFilters` không nhận tham số) ở mục 7.

## 1. Bảng tool

Loại: **Đọc** (không đổi dữ liệu) · **Ghi** (đổi dữ liệu) · **UI** (điều khiển giao diện, không đụng server).
`ctx` = ngữ cảnh người dùng do route `/api/ai/chat` dựng (xem mục 4–5), **không phải tham số do LLM cung cấp**.

| Tool | Mô tả cho LLM (rút gọn) | Input (Zod) | Output | Service | Loại | Xác nhận |
|---|---|---|---|---|---|---|
| `searchProducts` | "Tìm sản phẩm theo mô tả của khách (loại đồ, màu, size, dịp, mức giá)…" | `{ query: string(≤200), maxResults?: int(1–12, mặc định 6) }` | Cho model: `{ total, shown, items:[{name,slug,price,category,colors}], understood: string[], relaxed: string[] }`; thẻ sản phẩm (có ảnh) đi riêng vào luồng chat | **ĐÃ CÓ** `search/search.service.searchProducts` (`tools/search-products.ts`) | Đọc | Không |
| `applyFilters` | "Lọc trang danh sách theo đúng điều khách vừa yêu cầu… Không cần truyền tham số" | `{}`: **không nhận giá trị lọc nào từ model** (mục 7) | `{ ok, total, note }`; hành động `setFilters { q: <câu của khách> }` đi vào luồng chat | `tools/apply-filters.ts`: đặt `q` = câu của khách (≤100 ký tự), đếm bằng `searchProducts`; trang `/products?q=` hiểu câu bằng code (`search/intent.ts`) | UI | Không |
| `getProductDetail` | "Lấy chi tiết một sản phẩm: mô tả, chất liệu, size và màu còn hàng, giá…" | `{ product: string(≤120) }` (tên sản phẩm khách nhắc tới; model 4B hay bịa slug nên `resolveProduct` tự đổi sang slug thật, mơ hồ thì hỏi lại) | `{ name, slug, brand, category, gender, material, style, occasion, description(≤400), priceFrom, priceTo, variants:[{id,size,color,price,inStock}], hasSizeChart }` (bỏ `sku`, số tồn chính xác) | `getProductBySlug(slug thật)` | Đọc | Không |
| `getSizeRecommendation` | "Gợi ý size… Chỉ cần tên sản phẩm khách nhắc tới" | `getSizeRecommendationInputSchema` = `sizeAdviceInputSchema` đổi `productSlug` thành `product: string(≤120)` (tên hoặc slug thật) | Cho model: `{ status, recommendedSize, alternativeSize, confidence, reasons, missingFields, stock, message }`; thẻ size + bảng size đi vào luồng chat (trừ `need_info`) | `tools/resolve-product.ts` (tên → slug thật; mơ hồ thì `AMBIGUOUS_PRODUCT`) rồi **ĐÃ CÓ** `advisor/size.service.adviseSizeForProduct` | Đọc | Không |
| `addToCart` | "Chuẩn bị thêm một sản phẩm vào giỏ… chỉ hiện thẻ xác nhận, CHƯA thêm" | `{ product: string(≤120, tên hoặc slug thật), size?, color?, quantity: int(1–99, mặc định 1) }` (không nhận `variantId`/`userId` từ model) | Cho model: `{ status:"pending_confirmation", summary, note }`; thẻ xác nhận đi vào luồng chat (sự kiện `confirm`) | `tools/add-to-cart.ts`: `resolveProduct` → `getProductBySlug` → code chọn biến thể còn hàng; tạo bản ghi ở `core/confirmations.ts`. **Không gọi `addItem`**; `addItem` chỉ chạy ở `chat/confirm.ts` (`POST /api/ai/confirm`) | **Ghi** | **Bắt buộc** (mục 3) |
| `viewCart` | "Xem giỏ hàng hiện tại của khách…" | `{}` | `{ itemCount, subtotal, items:[{name,size,color,quantity,unitPrice,lineTotal,warnings:string[]}] }` | `getCart({ userId })` (userId từ ngữ cảnh) | Đọc | Không |
| `getOutfitSuggestion` | "Phối thành một bộ đồ còn hàng theo dịp, giới tính, mùa, ngân sách khách nói…" | `{ product?: string(≤120) }` (tên sản phẩm khách đã chọn sẵn, chỉ nhận khi khách đã nói; **không nhận** dịp, giới tính, ngân sách từ model) | Cho model: `{ title, occasion, items:[{slot,name,color,price}], totalPrice, missing, note }`; thẻ bộ đồ (ảnh, lý do, tổng tiền) đi vào luồng chat (sự kiện `outfit`) | `advisor/outfit.service.suggestOutfit` (hàm thuần `outfit.ts`; điều kiện từ `ctx.userHistory`, 3 câu gần nhất của khách) | Đọc | Không |
| `getOrderStatus` | "Tra trạng thái đơn hàng của khách… không đưa mã thì gọi ngay, không hỏi lại" | `{ orderCode?: string(≤40) }` (chuỗi rỗng coi như không có) | `{ code, status, paymentMethod, paymentStatus, createdAt, subtotal, shippingFee, total, items, history:[{status,at,note}] }` (không địa chỉ, SĐT, ghi chú đơn, tên người xử lý) | Có mã: **ĐÃ CÓ** `getOrderByCode(userId, code)`; không mã: `listOrders(userId,{pageSize:1})` + `getOrderDetail` | Đọc | Không |
| `openCart` | "Mở ngăn kéo giỏ hàng." | `{}` | `{ ok, ui: { type: "openCart" } }` | – (client gọi `useCartUi.getState().setOpen(true)` trong `src/stores/cart-ui.ts`) | UI | Không |
| `navigate` | "Đưa khách tới một trang trong cửa hàng." | `{ to: enum | path pattern theo whitelist }` | `{ ok, ui: { type: "navigate", to } }` | – (client `router.push`) | UI | Không |

Tool nên có thêm (tuỳ chọn, giai đoạn sau): `updateCartQuantity` / `removeFromCart` (gọi `updateQuantity` / `removeItem`, **Ghi**, cần xác nhận), (`getOutfitSuggestion` đã làm ở B1.8). **Không** đưa vào v1: `createOrder`, `cancelOrder`, `reorder`, mọi thứ liên quan thanh toán — hướng khách tới `/checkout` hoặc trang đơn hàng bằng tool `navigate`.

### Quy tắc viết tool
- Tên động từ tiếng Anh, mô tả bằng tiếng Việt đủ để LLM biết **khi nào KHÔNG dùng**.
- Output chỉ chứa trường cần thiết (không `userId`, không email, không địa chỉ, không token). Dùng DTO "Lite", không trả nguyên object Prisma.
- Mọi input qua `schema.parse` ở server dù SDK đã kiểm; lỗi trả về dạng có cấu trúc (mục 4.2), không ném thô.

## 2. Cơ chế AI thao tác giao diện

```
Server (route /api/ai/chat, streamText)           Client (component chat)
 tool call: applyFilters({maxPrice:500000,...}) ──► stream part "tool-result"
        server kiểm schema, trả {ui:{type:"setFilters",...}}
                                                   ▼
                                       uiActionSchema.safeParse(result.ui)  ← whitelist
                                                   ▼
                              handler theo type: router.push / setOpen / ...
```

### Whitelist UI action (Zod, **đã làm 2026-11-13**: `src/lib/ai/ui-actions.ts`)
```ts
export const uiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setFilters"), filters: productFilterSchema }),       // -> URL /products?...
  z.object({ type: z.literal("openCart") }),
  z.object({ type: z.literal("navigate"), to: z.string().max(120).regex(ALLOWED_PATH) }),
])
// ALLOWED_PATH chỉ khớp: ^/(products(/[a-z0-9-]+)?|categories/[a-z0-9-]+|cart|checkout|account(/orders(/[A-Za-z0-9]+)?)?)$
```
Không có `showProducts`: kết quả `searchProducts` hiện bằng **thẻ sản phẩm** (sự kiện `products`, mục 2.1) chứ không phải hành động giao diện. `uiActionHref(action)` dựng đường dẫn (`setFilters` qua `serializeProductFilters`).
Quy tắc phía client:
1. Client chỉ thực thi action **có trong union trên**; `type` lạ, URL tuyệt đối, `javascript:`, đường dẫn ngoài regex ⇒ bỏ qua + log.
2. `setFilters`: dựng URL bằng `serializeProductFilters(parsed)` (hàm có sẵn `src/lib/validators/product-filter.ts`) rồi `router.push("/products?"+qs)`. Khi đang ở trang danh sách có thể gọi `useProductFilters().update(...)` (hook đã được viết để AI dùng lại; xem comment đầu file `src/hooks/use-product-filters.ts`). Bộ lọc vẫn nằm hoàn toàn trong URL (đúng `project.md`).
3. `openCart`: `useCartUi.getState().setOpen(true)` (store hiện có).
4. Action **không bao giờ** thực hiện thao tác ghi; ghi chỉ đi qua đường xác nhận (mục 3).
5. Client không tin nội dung tool-result khác ngoài `ui` đã qua schema; văn bản của LLM render dạng text thuần (không `dangerouslySetInnerHTML`).

Hình dạng thẻ hiển thị kết quả tool (thẻ size, thẻ bộ đồ, thẻ xác nhận) đã chốt ở `03-rag-advisor.md` mục 8.

### 2.1 Định dạng luồng trả lời (NDJSON, **đã làm**)
`/api/ai/chat` trả `application/x-ndjson`: mỗi dòng một sự kiện, schema ở `src/lib/ai/chat-events.ts` (dùng chung server và client):

| `type` | Nội dung | Do ai sinh |
|---|---|---|
| `text` | `delta`: mẩu chữ của model | model |
| `ui` | `action`: hành động giao diện (đã qua `uiActionSchema`) | tool `applyFilters`, `openCart`, `navigate` |
| `products` | `items`: thẻ sản phẩm rút gọn (slug, tên, giá, ảnh, màu) | tool `searchProducts` |
| `size` | `advice` + `chart` + `categoryName`: thẻ size và bảng size | tool `getSizeRecommendation` (trừ `need_info`) |
| `outfit` | `data`: thẻ bộ đồ (tiêu đề, dịp, các món có ảnh, màu, giá, lý do, tổng tiền, nguồn kiến thức, ô còn thiếu) | tool `getOutfitSuggestion` |
| `confirm` | `data`: thẻ xác nhận (id, tiêu đề, dòng mô tả, tổng tiền, số phút hiệu lực) | tool `addToCart` |
| `error` | không có | handler, khi model đứt giữa chừng sau khi đã có dữ liệu |

Tool đẩy sự kiện qua `ctx.emit`; model **không thấy** nội dung thẻ nên ít tốn ngữ cảnh và không tự sửa được dữ liệu thẻ. Lỗi trước sự kiện đầu tiên: HTTP 502 như cũ; lỗi sau đó: sự kiện `error` (không dùng `controller.error` vì nó vứt dữ liệu đang chờ trong hàng đợi). Client (`lib/ai/chat-client.ts`) bỏ qua dòng hỏng hoặc sai schema, kể cả hành động ngoài whitelist (có test). **Thứ tự hiển thị phía client**: thẻ (sản phẩm, size, bộ đồ, xác nhận) tới TRƯỚC chữ (tool chạy xong rồi model mới viết), nhưng `use-assistant` chỉ gắn thẻ bên dưới ô chữ sau khi câu trả lời đã xong, nếu không ô thẻ chiếm chỗ làm ô chữ đang chảy bị đẩy lên trên (đã đo: 100 lần cập nhật chữ rồi mới tới thẻ). Hành động giao diện (`ui`) vẫn chạy ngay khi tới. Số bước tool tối đa là `AI_MAX_TOOL_STEPS` (mặc định 3); bước cuối không gửi tool nào để lượt nào cũng kết thúc bằng chữ.

## 3. Xác nhận cho tool ghi (`addToCart`)

Hai pha, không để LLM tự quyết:
1. Pha đề nghị: tool `addToCart` **không gọi `addItem`**. Server kiểm biến thể tồn tại/còn hàng (đọc), tạo `confirmation` `{ id, userId, variantId, quantity, exp = now+5 phút }`, lưu (Redis, dùng một lần) hoặc ký token ngắn hạn bằng `jose` (đã có) kèm `jti` lưu Redis. Trả `pending_confirmation` + `summary` (tên, size, màu, số lượng, đơn giá do server lấy).
2. Pha thực thi: client hiện thẻ "Thêm vào giỏ? [Xác nhận] [Huỷ]". Khi khách bấm, client gọi **`POST /api/ai/confirm`** (route riêng, không đi qua LLM) ⇒ server kiểm `confirmationId` thuộc về đúng user, chưa dùng, chưa hết hạn ⇒ gọi `addItem(ctx, variantId, quantity)` ⇒ trả `CartView` và client mở cart drawer.

Lý do: đảm bảo ghi chỉ xảy ra sau hành động của người dùng trên UI, dù prompt bị tiêm lệnh. Nếu SDK có cơ chế "tool approval" tích hợp, vẫn giữ kiểm tra phía server như trên.

### 3.1 Triển khai (B1.7, **đã làm 2026-11-13**)
- **Pha 1** (`tools/add-to-cart.ts`): model đưa tên sản phẩm, size, màu, số lượng khách nói. Code đổi tên thành slug thật (`resolveProduct`), chọn biến thể còn hàng khớp size (so bằng `core/size-match.ts`: không phân biệt hoa thường/dấu, "Free" và "freesize" khớp "Free size", L không khớp XL) và màu; mơ hồ thì `NEED_SIZE_OR_COLOR` (kèm lựa chọn còn hàng), không có thì `VARIANT_NOT_AVAILABLE`, quá tồn kho thì `INSUFFICIENT_STOCK`; **không bao giờ tạo thẻ** khi còn mơ hồ. Hợp lệ thì lưu bản ghi `{ variantId, quantity }` vào `core/confirmations.ts` và phát thẻ; model chỉ nhận "chờ khách bấm Xác nhận, không nói là đã thêm". Model không đưa `variantId` (model 4B hay bịa id), nên không thể bắt tool ghi vào biến thể tuỳ ý.
- **Kho xác nhận** (`core/confirmations.ts`): Redis (`SET … EX 300`, lấy ra bằng `GETDEL` nguyên tử), rơi về bộ nhớ khi Redis lỗi. Khoá chứa `userId` (`ai:confirm:<userId>:<id>`) nên người khác có biết id cũng không lấy được; id ngẫu nhiên 128 bit; dùng một lần; hết hạn sau 5 phút. Test gồm Redis thật: 8 yêu cầu đồng thời chỉ một yêu cầu lấy được.
- **Pha 2** (`POST /api/ai/confirm`, `chat/confirm.ts`): body `{ confirmationId, action: "confirm" | "cancel" }`; route chỉ xác thực (401), kiểm cờ AI (503), Zod (400) rồi giao cho handler; `userId` lấy từ phiên. Handler giới hạn 20 thao tác/phút, **lấy ra và xoá bản ghi trước khi ghi**, rồi mới gọi `addItem({ userId }, variantId, quantity)`. Không có hoặc đã dùng hoặc của người khác hoặc hết hạn: 410 `CONFIRMATION_INVALID`; hết hàng sau khi thẻ hiện: 409 với lý do của `cart.service`; huỷ: 200 và bản ghi bị xoá. `addItem` chỉ được gọi ở đúng một chỗ này trong tầng AI (test: không tool nào gọi `addItem`).
- **Giao diện**: thẻ `ConfirmCard` (đã có) nối với `use-assistant.decide`: bấm Xác nhận thì gọi route, báo kết quả bằng một tin của trợ lý, làm mới cache giỏ (`CART_KEY`) và mở ngăn kéo giỏ.

## 4. Service cần refactor nhỏ trước khi làm AI

Đã xác nhận từ code hiện tại:

| # | Vị trí | Vấn đề | Việc cần làm | Mức |
|---|---|---|---|---|
| 1 | `catalog.service.ts` `listProducts` / `productWhere` | ~~Không có lọc `season`; `gender` loại UNISEX~~ | **Đã làm (2026-11-11):** `season` (mảng, `hasSome`) trong `productFilterSchema` + `productWhere`; `listProducts(input, { includeUnisex })` để nam/nữ gồm cả UNISEX, mặc định `false` nên giao diện web không đổi. Có test tích hợp `catalog.service.integration.test.ts` | Xong |
| 2 | `catalog.service.ts` | Không có cách giới hạn theo **danh sách id có thứ tự** (kết quả vector) | **Đã làm (2026-11-13):** `listProducts(input, { onlyIds })`: luôn giữ thứ tự danh sách (không có `keepOrder`), phân trang theo thứ tự đó, id trùng chỉ tính một lần; 7 test tích hợp | Xong |
| 3 | `catalog.service.ts` `getProductBySlug` | ~~Truy vấn `SizeChart` nằm inline~~ | **Đã làm:** `getSizeChart(categoryId, brand)` và `getSizeChartInfo` (kèm cờ bảng riêng của brand), `pickSizeChartRows` ở `src/lib/size-chart.ts`; advisor dùng chung | Xong |
| 4 | `order.service.ts` | Không có tra cứu theo **mã đơn**; chỉ `getOrder/getOrderDetail(userId, orderId)` theo id | Thêm `getOrderByCode(userId, code): OrderDetailView \| null` (vẫn ràng buộc `userId`) | Nhỏ |
| 5 | Lỗi: `AddressNotFoundError` | Không có trường `code`; còn `ZodError` có thể ném từ `listOrders`, `getNewProducts`… | Tạo `src/server/ai/core/errors.ts` với `toToolError(e): { ok:false, code, message, details? }` ánh xạ `AuthError/CartError/OrderError/AddressNotFoundError/ZodError`; không đổi các class gốc | Nhỏ |
| 6 | `server/cart/http.ts` | `withCartErrors`/`jsonError` gắn với HTTP (`NextResponse`) | Không dùng lại cho AI; dùng `toToolError`. Có thể giữ nguyên file | – |
| 7 | `server/auth/rate-limit.ts` | Chỉ dùng cho **đăng nhập**, lưu `Map` trong bộ nhớ, khoá theo `ip|email` | Viết limiter tổng quát dùng Redis (INCR+EXPIRE) cho `/api/ai/*` (`05`) | Vừa |
| 8 | `lib/validators/ai.ts` | **Đã có**, nhưng mới chỉ có `sizeAdviceInputSchema` | Thêm schema tool, `searchIntentSchema`, đầu ra advisor (`sizeRecommendationSchema`). `uiActionSchema` đặt riêng ở `src/lib/ai/ui-actions.ts` (không import server, để client dùng được), không nằm trong file này | Vừa |

Đã ổn, **không cần sửa**: `cart.service` (nhận `CartContext`, lỗi `CartError` có `code` + `available`), `order.service` (`userId`/`{id}` thuần, `OrderError` có `code` + `shortages`), `address.service` (theo `userId`), `auth/session.getCurrentUser` (đọc cookie ở tầng vào). Service không phụ thuộc request/cookie; chỉ route AI mới được đọc cookie.

Lưu ý nhỏ: chữ ký không đồng nhất (`userId: string` vs `user: {id}`), không ảnh hưởng tool; chỉ cần nhớ khi viết wrapper.

## 5. Khách chưa đăng nhập

**Đã chốt (2026-11-10): không có giỏ khách; giỏ hàng và trợ lý AI đều cần tài khoản.** Giỏ khách đã bị gỡ khỏi code và DB (migration `drop_cart_guest_session`); `CartContext` chỉ còn `{ userId }`.

- Route `/api/ai/*` và mọi Server Action của AI (hiện có `getSizeAdviceAction`) bắt buộc `getCurrentUser()`; chưa đăng nhập ⇒ từ chối, không chạy tool nào.
- UI: khách bấm nút tròn của trợ lý (góc phải dưới) hoặc "Tư vấn size" ở trang sản phẩm được chuyển sang `/login?next=<trang hiện tại>` (cùng cách nút giỏ hàng đang làm); ô chat chỉ được dựng cho người đã đăng nhập (đã làm trong `assistant-widget`, `ask-size-button`).
- Hệ quả: không cần tool trả `UNAUTHENTICATED` cho từng tool, không cần rate limit riêng cho khách; mọi giới hạn tính theo `userId`. Phiên hết hạn giữa chừng ⇒ action trả lỗi "đăng nhập lại" và client chuyển sang đăng nhập.

## 6. Tiêu chí hoàn thành bước Tool Calling
- Mỗi tool trong bảng có test: input hợp lệ/không hợp lệ, chưa đăng nhập bị từ chối, lỗi có cấu trúc.
- Kịch bản kiểm tra tool call đúng đạt ngưỡng ở `06-evaluation.md`.
- Không tồn tại đường nào ghi vào giỏ mà không qua `POST /api/ai/confirm` (test tự động).
- Client từ chối mọi UI action ngoài whitelist (test đơn vị cho `uiActionSchema` với đầu vào xấu: URL ngoài, `type` lạ, path ngoài regex).

## 7. Trạng thái triển khai và kết quả đo (2026-11-13)
**Đã làm (B1.6, tool đọc và giao diện)**: 8 tool trong `src/server/ai/tools/` (mỗi tool một file mỏng, `index.ts` là tập đóng, `context.ts` có `ToolContext { userId, userText, config, emit }` và `runTool` đổi mọi lỗi thành `{ ok:false, code, message }`), `lib/ai/ui-actions.ts`, `lib/ai/chat-events.ts`, thẻ `components/assistant/products-card.tsx`, hook `use-assistant` thực thi hành động. **B1.7 đã làm sau đó** (mục 3.1): `addToCart` và `/api/ai/confirm`. **Chưa làm**: `getOutfitSuggestion` (B1.8).

**Kết quả đo** bằng `npm run ai:chat-check` (11 câu mẫu qua `handleChat` với Ollama thật, in tool đã gọi và câu trả lời; không nằm trong `npm test`), qwen3:4b-instruct trên Ollama:

1. **Prompt dài làm model 4B bỏ qua tool.** Cùng 7 câu cần tool, mỗi câu 3 lần: prompt 8 quy tắc nhắc tên từng tool gọi đúng **2/21**; prompt ngắn chỉ dặn "gọi công cụ phù hợp NGAY, không viết gì trước khi gọi" đạt **21/21**. Nên `SYSTEM_PROMPT` giữ dưới 2.500 ký tự (có test), tên và cách dùng tool nằm ở `description` của tool. Thêm quy tắc vào prompt thì phải chạy lại `ai:chat-check`.
2. **Ollama không hỗ trợ `toolChoice`** (provider bỏ qua và báo `unsupported`): không ép được tool bằng `required`/`none`. Bước cuối gỡ tool bằng `activeTools: []` (có test: bước cuối gửi 0 tool).
3. **Model hay gửi chuỗi rỗng thay vì bỏ trống** (`{"orderCode":""}`), SDK từ chối trước khi chạy tool, model quay sang hỏi khách mã đơn. Schema coi chuỗi rỗng là "không có"; handler ghi log `tool … bị từ chối` khi gặp lỗi kiểu này. (Lỗi này che khuất khi đo chỉ đếm lượt "model gọi tool": phải đếm lượt tool thật sự chạy.)
4. **Model bịa slug sản phẩm** (`somi-poplin-cung-170`, `jeans-women-2023`). `getSizeRecommendation` nhận **tên** sản phẩm; `resolveProduct` chỉ dùng slug có thật, còn lại tìm theo tên và chỉ chọn khi mọi từ khách nói có trong đúng một tên sản phẩm. Nhiều sản phẩm khớp: trả `AMBIGUOUS_PRODUCT` để model hỏi lại, không đoán (sai sản phẩm là sai bảng size).
5. **Model bịa điều kiện lọc cứng**: đặt `maxPrice: 500000` và `gender: "unisex"` khi khách không nói, bỏ sót `size M` ở 4/4 lần, rồi điền `category: "apparel"`, `material: "cotton"`, `season: "summer"` (0 sản phẩm). Nên `applyFilters` **không nhận tham số nào từ model**; trang `/products?q=<câu khách>` hiểu câu bằng code (giới tính, giá, size, màu, loại đồ) như đường tìm kiếm thông minh. Giới hạn: mỗi lần gọi thay toàn bộ bộ lọc theo câu **vừa nói**, không cộng dồn với điều kiện ở lượt trước.
6. `temperature` đặt 0,1 (mặc định của Ollama là 0,8).

**Kết quả sau chỉnh sửa**: `ai:chat-check` **11/11 ba lần liên tiếp**; câu về giặt linen, giá vàng và nhờ thêm vào giỏ không gọi tool (nhờ thêm vào giỏ được trả lời "mình không làm được, bạn tự bấm"); 1–5 giây mỗi lượt trên RTX 3050 6 GB. Thử thêm: đòi in chỉ dẫn hệ thống, đòi tới `/admin/orders`, nhờ huỷ đơn, đòi xem giỏ của người khác bằng id đều bị từ chối hoặc hướng dẫn tự làm; tra mã đơn không tồn tại trả "không tìm thấy".

**Hạn chế còn lại**: câu size không nêu rõ sản phẩm ("quần jeans nữ") được gán cho sản phẩm duy nhất khớp tên (câu trả lời nói rõ tên sản phẩm); mới đo 11 câu mẫu, cần bộ `ai:eval` ở B1.10; trợ lý chưa biết khách đang xem sản phẩm nào khi mở chat từ trang sản phẩm; thẻ size trong chat không có nút "Chọn size" (chỉ có ở khung mở từ trang sản phẩm).

### 7.1 Kết quả đo B1.7
- Nối thêm `addToCart` làm prompt dài thêm một quy tắc; `ai:chat-check` (13 câu, thêm 3 câu mua hàng) vẫn đạt: câu đủ tên, size, màu, số lượng gọi `addToCart` và ra thẻ xác nhận (model nói "bấm Xác nhận trên thẻ", không nói đã thêm); câu thiếu size và màu thì model hỏi lại, chưa gọi tool; "đặt hàng giúp mình" bị từ chối và chỉ tới `/checkout`. Size và màu hết hàng được báo đúng kèm các lựa chọn còn hàng (dữ liệu thật: M · Trắng của áo poplin đang hết hàng).
- **Kiểm trình duyệt**: thẻ xác nhận hiện mà giỏ chưa đổi (kiểm bằng `GET /api/cart`); bấm Xác nhận thì giỏ có thêm đúng dòng (Trắng, L, ×2), ngăn kéo giỏ mở; gọi `/api/ai/confirm` với id bịa trả 410; body có `variantId`/`quantity` tự thêm và id sai định dạng trả 400.
- Hạn chế: bản ghi chờ xác nhận mất khi Redis lỗi và tiến trình khởi động lại (khách chỉ cần nhờ lại); thêm vào giỏ cộng dồn với số lượng đã có (theo `addItem`), nếu vượt tồn kho thì báo 409 lúc xác nhận; chưa có `updateCartQuantity`/`removeFromCart`.

### 7.2 Lỗi thật của khách và cổng kiểm chứng (B1.7, 2026-11-13)
**Lỗi báo từ chạy thật**: khách xin "gợi ý cho tôi đi" rồi trả lời tiếp "có size gì", "S", "4". Model **không gọi tool nào** mà tự kể sản phẩm ("Áo thun cotton trắng dáng dài" không có trong cửa hàng), tự kể size ("S, M, L, XL"), rồi nói "bấm Xác nhận trên thẻ" **khi chưa có thẻ nào**. Khách gõ chữ "Xác nhận" thì model xuất ra `{ "error": "not implemented" }`. Đo lại trên đúng hội thoại này: ở các lượt nối tiếp model gọi tool **0/5 lần** (prompt không cứu được vì lịch sử gửi lên chỉ có chữ, không còn dấu vết tool nên model bắt chước chính các câu trả lời không dùng tool của mình).

**Điều đã đo và dẫn tới thiết kế**: thu hẹp tập tool còn đúng một tool cần dùng và nhắc ngay lượt đó thì model gọi đúng **5/5** (kể cả `addToCart` với đủ `product`, `size`, `color`, `quantity` lấy từ các lượt trước); hai tool trong tập thì hay bỏ qua cả hai.

**Cổng kiểm chứng** (`chat/claims.ts` + `chat/handler.ts`, hàm thuần có test):
1. Chữ của model được **giữ lại** cho tới khi biết lượt đó có gọi tool hay không (khi tool được gọi thì chữ chảy thẳng ra như cũ). Lượt không gọi tool mới bị kiểm.
2. Bị coi là vi phạm khi: model nói đã có thẻ xác nhận, bảo khách "xác nhận" bằng chữ, hoặc nói "đã thêm vào giỏ"; xuất JSON thô (`junk`); kể giá, danh sách size, còn/hết hàng khi không có khối kiến thức làm nền; **hoặc khách vừa hỏi điều chỉ tool mới trả lời đúng** (xin gợi ý, tìm sản phẩm, hỏi size/màu/giá/còn hàng, nêu số đo để chọn size, hỏi đơn hàng) hay trả lời ngắn cho câu hỏi mua hàng của trợ lý ("S", "4", "màu trắng").
3. Vi phạm thì **thử lại tối đa 2 lần** với tập tool chỉ còn đúng tool hợp ý khách (`retryPlanFor`: số đo → `getSizeRecommendation`, đơn hàng → `getOrderStatus`, size/màu/giá/còn hàng → `getProductDetail`, xin gợi ý/tìm → `searchProducts`, mua hàng → `addToCart`) kèm lời nhắc "LƯU Ý LƯỢT NÀY". Vẫn không gọi tool thì chỉ câu **hỏi lại** ("bạn muốn sản phẩm nào?") được giữ; câu khẳng định bị thay bằng câu trung thực (`CLAIM_FALLBACK`), thẻ xác nhận giả không bao giờ tới khách.
4. Khách chỉ gõ chữ "xác nhận/đồng ý/chốt": trả lời cố định "bạn bấm nút Xác nhận trên thẻ…", không gọi model (chỉ nút trên thẻ mới ghi giỏ).
5. `getProductDetail` nhận **tên** sản phẩm như tool size và giỏ (model bịa slug `ao-so-mi-poplin-con-guo`). Mọi ngoại lệ trong bước xử lý đều kết thúc luồng thay vì treo.

**Lưu ý kỹ thuật**: `\b` của JavaScript chỉ hiểu chữ ASCII ("gợi ý", "giỏ", "gì" kết thúc bằng chữ có dấu nên `\b` không bao giờ khớp), nên mọi ranh giới từ tiếng Việt dùng lookaround Unicode (`(?<![\p{L}\p{N}])`, cờ `u`).

**Kết quả đo sau khi thêm cổng** (`npm run ai:chat-check`): hội thoại lỗi của khách (8 lượt, chạy 3 lần): không còn thẻ xác nhận giả, không còn JSON lạ, "gợi ý cho tôi đi" ra thẻ sản phẩm thật 5/6 lần; gõ "Xác nhận" luôn ra câu cố định; khi khách nêu rõ tên sản phẩm, size, màu, số lượng thì `addToCart` dùng đúng tên sản phẩm thật và báo đúng khi hết hàng. **Bộ 13 câu mẫu 11–12/13**: thất bại còn lại là câu size theo số đo mà model không gọi tool kể cả sau thử lại (khi đó khách nhận câu trung thực "chưa tra được", không phải size bịa); chạy riêng từng câu thì 3/3 gọi đúng, chỉ trong cả bộ thì hay hỏng (chưa tìm ra nguyên nhân, nghi do bộ nhớ đệm của Ollama).
**Hạn chế còn lại**: thử lại tốn thêm 3–6 giây ở đường lỗi; câu trả lời không gọi tool bị giữ tới khi model xong nên mất hiệu ứng chữ chảy ở các lượt không dùng tool; model hay trả lời "bạn muốn loại gì?" thay vì gọi tool tìm kiếm cho câu "gợi ý đi" (hợp lệ nhưng chưa hay); lịch sử gửi lên model vẫn chỉ có chữ, nên khi khách nối tiếp mà không nêu tên sản phẩm thì model phải hỏi lại. Hướng cải thiện (B1.9/B1.10): gửi kèm tóm tắt kết quả tool vào lịch sử, hoặc để server tự chạy tool khi đã chắc ý định.

### 7.3 Mix & Match (B1.8, 2026-11-13)
- Thêm tool thứ 10 `getOutfitSuggestion` (`tools/get-outfit-suggestion.ts`), thẻ `outfit` trong luồng NDJSON, `ToolContext.userHistory` (3 câu gần nhất của khách để nhớ dịp đã nói ở lượt trước khi khách chỉ trả lời "nữ"). Chi tiết thuật toán ở `03-rag-advisor.md` mục 4.1.
- **Quyết định theo số đo**: model gọi tool này nhưng thường truyền tên sản phẩm bịa ("áo thun cotton trắng") nên tham số `product` chỉ được nhận khi khách đã nói tên đó; mọi điều kiện khác lấy bằng code. Khi model vẫn không chịu gọi tool sau các lần thử lại của cổng kiểm chứng, **server tự chạy tool** (tool không cần tham số của model) và trả câu cố định (`outfitReplyText`); thẻ bộ đồ vẫn do tool phát.
- Cổng kiểm chứng nhận thêm ý định phối đồ (phối đồ, cả bộ, outfit, mặc gì, nên mặc): lượt không gọi tool thì thử lại với đúng tool phối đồ.
- **Đo** (`npm run ai:chat-check`, thêm 2 câu phối đồ, 15 câu): hội thoại "Phối đồ đi làm" rồi "nữ" ra thẻ bộ đồ đúng (đi làm, nữ, 4 món, tổng tiền khớp tổng các món); "gợi ý outfit đi biển cho nam dưới 1 triệu" ra bộ 927.000 đ; "đi đám cưới nên mặc gì" hỏi lại nam hay nữ. Bộ 15 câu 14/15 (còn câu size theo số đo hay hỏng khi chạy cả bộ, đã nêu ở mục 7.2). **Kiểm trình duyệt**: bấm gợi ý "Phối đồ đi làm" thì trợ lý hỏi nam hay nữ, trả lời "nữ" thì hiện thẻ bộ đồ (ảnh, màu, giá, ô áo, quần, phụ kiện, tổng cộng, nguồn kiến thức, nút "Xem từng món"), không có nút "Thêm cả bộ".

### 7.4 Dấu vết thẻ trong lịch sử và lỗi "ình" (B1, 2026-11-14)
**Vấn đề.** Model chỉ nhận chữ của các lượt trước. Câu trả lời của nó thường chỉ tóm tắt ("bạn xem thẻ bên dưới nhé") và để thẻ hiện danh sách, nên lượt sau ("thêm cái đầu tiên", "cái thứ hai còn size nào") model không biết đang nói tới món nào, thường tìm kiếm lại hoặc đoán sai.

**Cách làm (server không lưu trạng thái):**
- Trình duyệt mô tả các thẻ đã hiện bằng `describeShownCards` (`lib/ai/chat-client.ts`): "Sản phẩm 1 (cái đầu tiên): … (giá)", "… (cái thứ ba, cái cuối cùng)", tư vấn size, bộ đồ, và thẻ xác nhận (ghi rõ "khách CHƯA bấm, chưa thêm"). Nhãn thứ tự viết bằng chữ vì model 4B đếm "cái thứ ba", "cái cuối" hay nhầm.
- Gửi kèm tin nhắn trợ lý CUỐI trong trường tuỳ chọn `shown` (`chatRequestSchema`: tối đa 8 dòng, mỗi dòng ≤ 200 ký tự). Các lượt cũ hơn không gửi.
- Server (`chat/handler.ts`, `chat/prompts.ts`) chỉ dùng `shown` của tin nhắn trợ lý NGAY TRƯỚC câu hỏi, đặt trong khối `<da_hien>` có ranh giới như `<kien_thuc>`: là DỮ LIỆU, không phải chỉ thị; mỗi dòng bị bỏ dấu ngoặc nhọn và xuống dòng, che email/SĐT (nội dung do trình duyệt gửi nên không đáng tin hơn lời khách). Khối kèm một câu dặn: hiểu "cái đó/cái đầu tiên/thêm đi" là món tương ứng, gọi thẳng công cụ với đúng tên món, không tìm lại. Chỉ dẫn gốc vẫn dưới 2.500 ký tự (khối thêm động).
- Chỉ ảnh hưởng bước chọn tên món; mọi quyền hạn vẫn do server giữ (`addToCart` vẫn chỉ tạo thẻ, tên được đổi sang biến thể thật bằng code), nên `shown` giả mạo không thêm được gì vào giỏ.

**Đo** (qwen3:4b-instruct, tin nhắn trợ lý chỉ tóm tắt, không nêu tên; 4 lần mỗi ca, tính đúng tool VÀ đúng món): không có dấu vết **0/12**; có dấu vết bản đầu (đánh số 1, 2, 3) 5/12 ("cái thứ hai" 4/4, "cái đầu tiên" 1/4, "cái cuối" 0/4: model tìm lại hoặc chọn nhầm món thứ hai); thêm nhãn thứ tự bằng chữ và dặn không tìm lại **12/12**.

**Lỗi "ình" thay vì "mình" ở đầu câu.** Điều tra: ghi lại mẩu chữ thô ở ba tầng. Ollama THỰC SỰ gửi "ình" làm mẩu đầu tiên (1/5 lượt với câu từ chối ngắn, có khi lặp "ình mình…"); SDK và code ghép luồng chuyển nguyên văn; gọi thẳng API Ollama với prompt đơn giản (kể cả có tool) thì 12/12 đúng. Kết luận: lỗi của model trong đầu vào đầy đủ của chat, không sửa tận gốc được. `chat/text-repair.ts` sửa ở mẩu chữ đầu tiên của câu trả lời ("ình" đứng riêng → "mình"; "ình mình…" → bỏ "ình" thừa); "ình" không bao giờ là từ mở đầu hợp lệ trong tiếng Việt nên an toàn. Chạy lại ca lỗi 6 lần với model thật: 0 lần "ình".

### 7.5 Giao diện chat kiểu Messenger (2026-11-14)
- **Chấm "đang soạn"** (3 chấm nhảy lần lượt, `TypingDots` trong `components/assistant/message-bubble.tsx`) thay cho chữ nhấp nháy; chữ "Đang soạn…" vẫn có cho trình đọc màn hình.
- **Bong bóng mới** (cả của khách lẫn của trợ lý) hiện bằng mờ dần + phóng nhẹ + trượt lên, xuất phát từ góc đuôi bong bóng (`animate-in` của tw-animate-css). Tin có sẵn lúc mở khung chat là lịch sử nên KHÔNG chạy lại hiệu ứng (`AssistantPanel` ghi nhớ id tin lúc mở).
- **Thẻ hiện SAU tin nhắn**, nở chiều cao từ 0 trong 500 ms kèm mờ dần và trượt xuống nhẹ, các thẻ liền nhau lần lượt cách 180 ms (`components/assistant/reveal.tsx`, nở bằng `grid-rows` 0fr → 1fr nên không cần đo chiều cao). Khung chat bám đáy bằng `ResizeObserver` trên phần nội dung (chiều cao đổi lúc nào thì bám lúc đó: chữ dài ra, chấm "đang soạn" thành chữ, thẻ nở từng khung hình) nên người xem thấy thẻ "trượt xuống"; khách đã kéo lên đọc tin cũ (cách đáy > 120 px) thì không bị giật xuống, trừ khi vừa gửi tin mới. Bản đầu dùng vòng `requestAnimationFrame` đếm 1,1 giây và đã gặp một lần thẻ bị cắt ở đáy (trình duyệt đứng hình lúc tải, vòng đếm hết trước khi thẻ nở xong) nên đổi sang `ResizeObserver`, không phụ thuộc thời gian.
- **Chữ đậm**: model hay viết `**đậm**` dù khung chat không render markdown; `lib/ai/chat-text.ts` (`splitBold`) vẽ đậm thật, bỏ dấu `**` thừa kể cả khi câu đang gõ dở. Chỉ hỗ trợ đúng **đậm**, không HTML. Chữ của khách giữ nguyên từng ký tự.
- Tất cả hiệu ứng tắt khi người dùng chọn giảm chuyển động (`prefers-reduced-motion`).
- Đo trên trình duyệt thật: thẻ danh sách nở 122 → 388 → 452 → 462 px trong khoảng 450 ms, độ mờ 0,26 → 1, khung chat lệch đáy 0–1 px suốt lúc nở; đóng rồi mở lại khung chat: 0 bong bóng chạy lại hiệu ứng.
- **Trạng thái thẻ xác nhận nằm trong tin nhắn** (`MessagePart` `confirm.resolved`: `confirming`, `added`, `cancelled`, `failed`; store `resolveConfirm`), không còn nằm trong state của thẻ: trước đây đóng rồi mở lại khung chat làm thẻ đã Huỷ hiện lại nút Xác nhận/Huỷ. Thẻ giờ báo kết quả thật ("Đã thêm vào giỏ hàng", "Đã huỷ", "Chưa thêm được…"), và mô tả thẻ gửi cho model (`describeShownCards`) phản ánh quyết định của khách ("ĐÃ thêm", "khách đã huỷ, KHÔNG thêm") để model không tưởng thẻ còn chờ.

### 7.6 Lỗi "Không có sản phẩm X còn hàng" dù còn (2026-11-14)
Phát hiện khi kiểm trình duyệt: sau một lượt trợ lý đúng khi báo "không có size M màu trắng còn hàng" (poplin), khách yêu cầu thêm một sản phẩm KHÁC (slim fit, còn hàng) và model đáp "Không có sản phẩm … còn hàng" mà **không gọi tool** (nhật ký: "không gọi tool"). Model 4B bắt chước câu từ chối liền trước. Tái hiện 3/3 bằng `ai:chat-check --convo`.
- **Vì sao cổng kiểm chứng để lọt:** luật "chữ có còn/hết hàng mà chưa gọi tool" bị tắt khi truy xuất được khối kiến thức (kiến thức hợp lệ có thể nêu giá/chính sách), và câu "thêm … vào giỏ" thường kéo theo một đoạn kiến thức.
- **Sửa 1, luật theo ý định (`chat/claims.ts` `ADD_TO_CART`):** khách nói "thêm/cho/bỏ/để/nhét/đưa … vào giỏ" thì lượt đó BẮT BUỘC có tool `addToCart`, không phụ thuộc chữ model viết và không bị tắt bởi khối kiến thức. Lần thử lại chỉ giữ tool `addToCart`; kiểm lại sau khi thử lại coi như không có kiến thức, nên câu khẳng định "hết hàng" không qua được, chỉ câu HỎI LẠI (thiếu size/màu) mới được giữ.
- **Sửa 2, thử lại tự đủ nghĩa (`RetryPlan.standalone`):** chỉ với yêu cầu "thêm … vào giỏ" tự đủ nghĩa, lần thử lại chỉ gửi câu hỏi cuối của khách, bỏ các tin của trợ lý để model không có mẫu để bắt chước.
- **Đo** (qwen3:4b-instruct, chuỗi hội thoại gây lỗi, 3 lần): chỉ có sửa 1: 0/3 ra thẻ (khách nhận câu xin lỗi trung thực "Mình chưa tra được…" thay vì câu bịa); thêm sửa 2: **3/3 ra thẻ xác nhận**. Bộ 15 câu mẫu không hồi quy (vẫn 14/15, trượt ca size theo số đo đã biết). Đã kiểm lại trên trình duyệt thật: cùng yêu cầu giờ ra thẻ.
- Cái giá: lượt vi phạm tốn thêm một lần gọi model (khoảng 3–6 giây) vì phải thử lại.
