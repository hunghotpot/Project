# 04 · Tool Calling

LLM không chạm DB. Nó chỉ **đề nghị** gọi tool; server thực thi tool bằng cách gọi **service thật** với quyền của người dùng hiện tại; kết quả (đã lọc trường) quay lại LLM. Mọi tool có Zod schema cho đầu vào và đầu ra.

Cột "Service" dưới đây là hàm **thật** trong code (xem `docs/architecture.md`) hoặc ghi **CHƯA CÓ** nếu cần viết mới.

## 1. Bảng tool

Loại: **Đọc** (không đổi dữ liệu) · **Ghi** (đổi dữ liệu) · **UI** (điều khiển giao diện, không đụng server).
`ctx` = ngữ cảnh người dùng do route `/api/ai/chat` dựng (xem mục 4–5), **không phải tham số do LLM cung cấp**.

| Tool | Mô tả cho LLM (rút gọn) | Input (Zod) | Output | Service | Loại | Xác nhận |
|---|---|---|---|---|---|---|
| `searchProducts` | "Tìm sản phẩm theo mô tả tự nhiên của khách. Dùng khi khách muốn tìm/gợi ý sản phẩm." | `{ query: string(≤200), maxResults?: number(1–12, mặc định 8) }` | `{ items: ProductCardLite[], total, appliedFilters, relaxed?: string[] }` | `search.service.searchProducts` (**CHƯA CÓ**, nội bộ gọi `listProducts`) | Đọc | Không |
| `applyFilters` | "Cập nhật bộ lọc trên trang danh sách (giá, size, màu, giới tính…). Chỉ dùng giá trị có trong kho." | `Partial<ProductFilters>` rút gọn: `{ category?, q?, size?[], color?[], material?[], style?[], occasion?[], gender?, minPrice?, maxPrice?, inStock?, sort? }` (tái dùng `productFilterSchema`) | `{ ok, ui: { type: "setFilters", filters } }` | Không gọi service ghi; kiểm bằng `productFilterSchema.parse`; có thể trả thêm `total` từ `listProducts` | UI | Không |
| `getProductDetail` | "Lấy chi tiết một sản phẩm theo slug: mô tả, chất liệu, biến thể còn hàng." | `{ slug: string(≤100) }` | `{ name, slug, brand, material, style, occasion, gender, category, price range, variants:[{id,size,color,price,inStock}] , hasSizeChart }` (bỏ `sku`, `stock` chính xác nếu không cần) | `getProductBySlug(slug)` | Đọc | Không |
| `getSizeRecommendation` | "Gợi ý size theo chiều cao/cân nặng/số đo. Nếu thiếu thông tin, hỏi lại khách." | `sizeAdviceInputSchema` (`03-rag-advisor.md`) | `sizeRecommendationSchema` | `advisor.service.getSizeRecommendation` (**CHƯA CÓ**; dùng `getProductBySlug` hoặc hàm `getSizeChart` sau refactor) | Đọc | Không |
| `addToCart` | "Thêm một biến thể vào giỏ. Chỉ gọi sau khi khách đã chọn rõ size/màu/số lượng." | `{ variantId: string(1–64), quantity: int(1–99) }` | Lần gọi đầu: `{ status: "pending_confirmation", confirmationId, summary }`; sau xác nhận: `CartView` rút gọn | `addItem(ctx, variantId, quantity)` | **Ghi** | **Bắt buộc** (mục 3) |
| `viewCart` | "Xem giỏ hàng hiện tại của khách." | `{}` | `{ items:[{name,size,color,quantity,unitPrice,lineTotal,warnings}], itemCount, subtotal }` | `getCart(ctx)` | Đọc | Không |
| `getOrderStatus` | "Tra cứu trạng thái đơn của khách (theo mã đơn, hoặc đơn gần nhất)." | `{ orderCode?: string(≤40) }` | `{ code, status, paymentStatus, createdAt, total, items, history }` (không trả địa chỉ đầy đủ/SĐT) | Có mã: `getOrderByCode(userId, code)` (**CHƯA CÓ**, tạm: `listOrders(userId, { q: code, pageSize: 1 })` rồi `getOrderDetail(userId, id)`); không mã: `listRecentOrders(userId, 1)` | Đọc | Không |
| `openCart` | "Mở ngăn kéo giỏ hàng." | `{}` | `{ ok, ui: { type: "openCart" } }` | – (client gọi `useCartUi.getState().setOpen(true)` trong `src/stores/cart-ui.ts`) | UI | Không |
| `navigate` | "Đưa khách tới một trang trong cửa hàng." | `{ to: enum | path pattern theo whitelist }` | `{ ok, ui: { type: "navigate", to } }` | – (client `router.push`) | UI | Không |

Tool nên có thêm (tuỳ chọn, giai đoạn sau): `updateCartQuantity` / `removeFromCart` (gọi `updateQuantity` / `removeItem`, **Ghi**, cần xác nhận), `getOutfitSuggestion` (Mix & Match). **Không** đưa vào v1: `createOrder`, `cancelOrder`, `reorder`, mọi thứ liên quan thanh toán — hướng khách tới `/checkout` hoặc trang đơn hàng bằng tool `navigate`.

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

### Whitelist UI action (Zod, đề xuất)
```ts
// src/lib/ai/ui-actions.ts  (CHƯA CÓ)
export const uiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setFilters"), filters: productFilterSchema }),       // -> URL /products?...
  z.object({ type: z.literal("openCart") }),
  z.object({ type: z.literal("navigate"), to: z.string().regex(ALLOWED_PATH) }),
  z.object({ type: z.literal("showProducts"), slugs: z.array(z.string().max(100)).max(12) }),
])
// ALLOWED_PATH chỉ khớp: ^/(products(/[a-z0-9-]+)?|categories/[a-z0-9-]+|cart|checkout|account/orders(/[A-Za-z0-9]+)?|account)$
```
Quy tắc phía client:
1. Client chỉ thực thi action **có trong union trên**; `type` lạ, URL tuyệt đối, `javascript:`, đường dẫn ngoài regex ⇒ bỏ qua + log.
2. `setFilters`: dựng URL bằng `serializeProductFilters(parsed)` (hàm có sẵn `src/lib/validators/product-filter.ts`) rồi `router.push("/products?"+qs)`. Khi đang ở trang danh sách có thể gọi `useProductFilters().update(...)` (hook đã được viết để AI dùng lại; xem comment đầu file `src/hooks/use-product-filters.ts`). Bộ lọc vẫn nằm hoàn toàn trong URL (đúng `project.md`).
3. `openCart`: `useCartUi.getState().setOpen(true)` (store hiện có).
4. Action **không bao giờ** thực hiện thao tác ghi; ghi chỉ đi qua đường xác nhận (mục 3).
5. Client không tin nội dung tool-result khác ngoài `ui` đã qua schema; văn bản của LLM render dạng text thuần (không `dangerouslySetInnerHTML`).

## 3. Xác nhận cho tool ghi (`addToCart`)

Hai pha, không để LLM tự quyết:
1. Pha đề nghị: tool `addToCart` **không gọi `addItem`**. Server kiểm biến thể tồn tại/còn hàng (đọc), tạo `confirmation` `{ id, userId|sessionId, variantId, quantity, exp = now+5 phút }`, lưu (Redis, dùng một lần) hoặc ký token ngắn hạn bằng `jose` (đã có) kèm `jti` lưu Redis. Trả `pending_confirmation` + `summary` (tên, size, màu, số lượng, đơn giá do server lấy).
2. Pha thực thi: client hiện thẻ "Thêm vào giỏ? [Xác nhận] [Huỷ]". Khi khách bấm, client gọi **`POST /api/ai/confirm`** (route riêng, không đi qua LLM) ⇒ server kiểm `confirmationId` thuộc về đúng user/session, chưa dùng, chưa hết hạn ⇒ gọi `addItem(ctx, variantId, quantity)` ⇒ trả `CartView` và client mở cart drawer.

Lý do: đảm bảo ghi chỉ xảy ra sau hành động của người dùng trên UI, dù prompt bị tiêm lệnh. Nếu SDK có cơ chế "tool approval" tích hợp, vẫn giữ kiểm tra phía server như trên.

## 4. Service cần refactor nhỏ trước khi làm AI

Đã xác nhận từ code hiện tại:

| # | Vị trí | Vấn đề | Việc cần làm | Mức |
|---|---|---|---|---|
| 1 | `catalog.service.ts` `listProducts` / `productWhere` | **Không có lọc `season`**; `gender` so sánh bằng nên `men` loại `UNISEX` | Thêm `season` (mảng, `hasSome`) vào `productFilterSchema` + `productWhere`; thêm tuỳ chọn/hàm cho "nam hoặc unisex" mà **không đổi hành vi UI hiện tại** | Nhỏ |
| 2 | `catalog.service.ts` | Không có cách giới hạn theo **danh sách id có thứ tự** (kết quả vector) | Thêm tham số thứ hai `opts?: { onlyIds?: string[]; keepOrder?: boolean }` cho `listProducts`, tái dùng `productWhere` + `toProductCard` | Nhỏ–vừa |
| 3 | `catalog.service.ts` `getProductBySlug` (dòng ~341–368) | Truy vấn `SizeChart` nằm **inline**, không export | Tách `getSizeChart(categoryId, brand)` rồi để `getProductBySlug` gọi lại; advisor dùng chung | Nhỏ |
| 4 | `order.service.ts` | Không có tra cứu theo **mã đơn**; chỉ `getOrder/getOrderDetail(userId, orderId)` theo id | Thêm `getOrderByCode(userId, code): OrderDetailView \| null` (vẫn ràng buộc `userId`) | Nhỏ |
| 5 | Lỗi: `AddressNotFoundError` | Không có trường `code`; còn `ZodError` có thể ném từ `listOrders`, `getNewProducts`… | Tạo `src/server/ai/errors.ts` với `toToolError(e): { ok:false, code, message, details? }` ánh xạ `AuthError/CartError/OrderError/AddressNotFoundError/ZodError`; không đổi các class gốc | Nhỏ |
| 6 | `server/cart/http.ts` | `withCartErrors`/`jsonError` gắn với HTTP (`NextResponse`) | Không dùng lại cho AI; dùng `toToolError`. Có thể giữ nguyên file | – |
| 7 | `server/cart/context.ts` `resolveCartContext()` | Trả `null` cho khách; không có khái niệm session ẩn danh | Xem mục 5 | Vừa |
| 8 | `server/auth/rate-limit.ts` | Chỉ dùng cho **đăng nhập**, lưu `Map` trong bộ nhớ, khoá theo `ip|email` | Viết limiter tổng quát dùng Redis (INCR+EXPIRE) cho `/api/ai/*` (`05`) | Vừa |
| 9 | `lib/validators/ai.ts` | **CHƯA CÓ** | Tạo schema tool, `searchIntentSchema`, `uiActionSchema`, đầu ra advisor | Mới |
| 10 | `auth.ts` (Server Action) | Không gọi `mergeGuestCart` sau `login/register` | Chỉ cần nếu chọn giỏ ẩn danh (mục 5, phương án B) | Tuỳ |

Đã ổn, **không cần sửa**: `cart.service` (nhận `CartContext`, lỗi `CartError` có `code` + `available`), `order.service` (`userId`/`{id}` thuần, `OrderError` có `code` + `shortages`), `address.service` (theo `userId`), `auth/session.getCurrentUser` (đọc cookie ở tầng vào). Service không phụ thuộc request/cookie; chỉ route AI mới được đọc cookie.

Lưu ý nhỏ: chữ ký không đồng nhất (`userId: string` vs `user: {id}`), không ảnh hưởng tool; chỉ cần nhớ khi viết wrapper.

## 5. Khách chưa đăng nhập (giỏ ẩn danh)

Hiện trạng: `/api/cart/*` trả 401 `UNAUTHENTICATED` cho khách; trang `/cart` chuyển sang `/login`; `cart.service` **đã** hỗ trợ `{ sessionId }` và `mergeGuestCart(userId, sessionId)`, bảng `Cart.sessionId` + ràng buộc CHECK tồn tại, nhưng không nơi nào dùng (xem `docs/status-customer.md`).

**Phương án A (đề xuất cho v1, khớp hành vi hiện tại)**
- Khách dùng được: `searchProducts`, `applyFilters`, `getProductDetail`, `getSizeRecommendation`, `openCart`, `navigate`.
- Tool cần tài khoản (`viewCart`, `addToCart`, `getOrderStatus`) trả `{ ok:false, code:"UNAUTHENTICATED", action: { type:"navigate", to:"/login?next=/..." } }`; LLM giải thích ngắn gọn và UI hiện nút "Đăng nhập". Không cần đổi service.

**Phương án B (nếu bạn chọn hoàn thiện giỏ khách)**
1. Route AI/giỏ phát cookie `guest_session` (UUID ngẫu nhiên, `httpOnly`, `sameSite=lax`) khi cần; `resolveCartContext()` trả `{ sessionId }` khi chưa đăng nhập.
2. `addToCart` dùng `CartContext` `{ sessionId }`; xác nhận gắn với session.
3. `loginAction/registerAction` gọi `mergeGuestCart(user.id, sessionId)` rồi xoá cookie.
4. Mở `/cart` và `/api/cart` cho khách; dọn giỏ khách cũ bằng job (dựa `Cart.updatedAt`, **CHƯA CÓ**).
5. Rate limit theo IP/session chặt hơn; `getOrderStatus` vẫn bắt buộc đăng nhập.
Phương án B chỉ làm khi quyết định #4 ở `00-overview.md` là "cho phép"; đây là thay đổi hành vi toàn app, không chỉ AI.

## 6. Tiêu chí hoàn thành bước Tool Calling
- Mỗi tool trong bảng có test: input hợp lệ/không hợp lệ, quyền (khách vs user), lỗi có cấu trúc.
- Kịch bản kiểm tra tool call đúng đạt ngưỡng ở `06-evaluation.md`.
- Không tồn tại đường nào ghi vào giỏ mà không qua `POST /api/ai/confirm` (test tự động).
- Client từ chối mọi UI action ngoài whitelist (test đơn vị cho `uiActionSchema` với đầu vào xấu: URL ngoài, `type` lạ, path ngoài regex).
