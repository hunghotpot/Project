# Kiến trúc hệ thống (hiện trạng code)

Tài liệu mô tả đúng code đang có tại thời điểm viết (2026-11-10). Chỗ nào chưa có ghi **CHƯA CÓ**. Quy ước kiến trúc gốc: `CLAUDE.md`, `.claude/rules/project.md`. Trạng thái tính năng: `docs/status-customer.md`.

## 1. Sơ đồ các lớp

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ UI (Server Component / Client Component)                                       │
│  src/app/(shop)/**/page.tsx, src/components/**, hooks/*, stores/*              │
│  - Client KHÔNG import src/server/ (đã kiểm: 0 vi phạm)                         │
│  - Bộ lọc sản phẩm: trạng thái nằm trong URL (use-product-filters)             │
│  - Giỏ hàng client: TanStack Query + optimistic (use-cart) gọi /api/cart       │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ form submit / fetch / Server Component gọi thẳng service
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ Tầng vào: Route Handler (src/app/api/**) và Server Action (src/app/actions/*) │
│  - Chỉ: đọc request/cookie → validate Zod (src/lib/validators/*) → gọi service │
│  - Cầu nối request → context: server/auth/session.ts (getCurrentUser,          │
│    requireUser, requireAdmin), server/cart/context.ts (resolveCartContext),    │
│    server/cart/http.ts (đổi CartError → JSON)                                   │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ truyền context thuần (userId / {userId} / CartContext), KHÔNG truyền request
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ Service (src/server/services/*.service.ts)  — "server-only"                    │
│  auth · address · catalog · cart · order · payment                             │
│  - Chứa toàn bộ nghiệp vụ, kiểm quyền sở hữu (where userId), transaction      │
│  - Ném lỗi có mã (AuthError, CartError, OrderError) hoặc AddressNotFoundError  │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ Prisma Client (src/server/db.ts)
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ PostgreSQL 16 (+ extension vector, unaccent)  ·  Redis (CHƯA được code dùng)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Thư mục phụ trợ: `src/lib/` (hàm thuần dùng chung server/client: `cart.ts`, `order.ts`, `shipping.ts`, `product-variants.ts`, `format.ts`, `care.ts`), `src/lib/validators/` (Zod), `src/types/` (DTO), `src/server/payment/` (ký VNPay, VietQR), `src/server/auth/` (jwt, session, rate-limit).

Giai đoạn AI sẽ thêm một **tầng vào thứ ba** (route `/api/ai/*`) đứng cùng cấp với Route/Action, và cũng chỉ gọi service (xem `docs/ai/00-overview.md`).

## 2. Tầng vào hiện có

### Server Action (`src/app/actions/`)
| Action | File | Gọi service |
|---|---|---|
| `registerAction(input, next?)`, `loginAction(input, next?)`, `logoutAction()` | `auth.ts` | `auth.service` (`register`, `login`, `logout`) |
| `updateProfileAction`, `changePasswordAction`, `createAddressAction`, `updateAddressAction(id, input)`, `deleteAddressAction(id)`, `setDefaultAddressAction(id)` | `account.ts` | `auth.service`, `address.service` |
| `placeOrderAction(input)` | `checkout.ts` | `order.service.createOrder` |
| `cancelOrderAction(input)`, `reorderAction(orderId)` | `orders.ts` | `order.service.cancelOrder`, `reorder` |

### Route Handler (`src/app/api/`)
| Route | Method | Quyền | Gọi |
|---|---|---|---|
| `/api/cart` | GET | đăng nhập (khách → 401) | `cart.getCart` |
| `/api/cart/items` | POST | đăng nhập | `cart.addItem` |
| `/api/cart/items/[variantId]` | PATCH, DELETE | đăng nhập | `cart.updateQuantity`, `cart.removeItem` |
| `/api/auth/me` | GET | cookie | `getCurrentUser` |
| `/api/auth/refresh` | GET | refresh cookie (do middleware chuyển hướng tới) | `auth.refresh` |
| `/api/payment/vnpay/pay` | GET | đăng nhập | `payment.getVnpayPayUrl` |
| `/api/payment/vnpay/return` | GET | công khai (chỉ hiển thị) | `payment.verifyReturn`, `findOrderIdByCode` |
| `/api/payment/vnpay/ipn` | GET | chữ ký VNPay | `payment.handleIPN` |
| `/api/cron/expire-orders` | GET | `Authorization: Bearer CRON_SECRET` | `payment.expireUnpaidVnpayOrders` |

Trang Server Component (`src/app/(shop)/**`) gọi service trực tiếp để đọc dữ liệu (catalog, giỏ, đơn). `src/middleware.ts` chặn `/account/*` (cần đăng nhập) và `/admin/*` (cần role ADMIN); route `/admin` **CHƯA CÓ**.

## 3. Danh mục service

Ký hiệu quyền: **Public** = không cần đăng nhập; **User** = nhận `userId` và tự ràng buộc dữ liệu theo user; **Admin/System** = không kiểm quyền sở hữu, tầng gọi phải tự bảo đảm.

### 3.1 `catalog.service.ts` — Public (chỉ đọc, chỉ sản phẩm `isActive`)
| Hàm | Chữ ký | Trả về | Lỗi |
|---|---|---|---|
| `getNavCategories` | `()` | `NavCategory[]` | – |
| `getHomeCategories` | `()` | `CategoryCardData[]` | – |
| `getNewProducts` | `(limit = 8)` | `ProductCardData[]` | `ZodError` nếu `limit` sai (`sectionLimitSchema`) |
| `getFeaturedProducts` | `(limit = 8)` | `ProductCardData[]` | như trên |
| `getCategoryBySlug` | `(slug: string)` | `CategoryDetail \| null` | – |
| `listProducts` | `(input: ProductFilterInput = {})` | `ProductListResult` (`items`, `total`, `page`, `pageSize`, `pageCount`, `facets`) | không ném lỗi do input (schema dùng `.catch` rơi về mặc định) |
| `getProductBySlug` | `(slug: string)` | `ProductDetail \| null` (kèm `variants` có `stock`, `sizeChart`) | – |
| `getRelatedProducts` | `(product: Pick<ProductDetail,"id"\|"categoryId"\|"style">, limit = 4)` | `ProductCardData[]` | `ZodError` nếu `limit` sai |

Ghi chú: tìm từ khoá `q` chạy bằng `unaccent(lower(...)) LIKE` trên `name + brand + tags + category.name`, **mọi từ phải khớp** (AND, tối đa 8 từ). Không có full-text index, không có vector. Facet trả `sizes`, `colors`, `materials`, `styles`, `genders`, `occasions`, `price`.

### 3.2 `cart.service.ts` — User hoặc khách (qua `CartContext`)
`type CartContext = { userId: string } | { sessionId: string }` — service **không đọc cookie/headers**.

| Hàm | Chữ ký | Trả về | Lỗi (`CartError.code`) |
|---|---|---|---|
| `getCart` | `(ctx)` | `CartView` | `ITEM_NOT_FOUND` nếu ctx rỗng |
| `addItem` | `(ctx, variantId, quantity)` | `CartView` | `INVALID_QUANTITY`, `VARIANT_NOT_FOUND`, `OUT_OF_STOCK`, `INSUFFICIENT_STOCK` (kèm `available`) |
| `addItemsClamped` | `(ctx, lines: {variantId, quantity}[])` | `ClampedAddResult` (`added`, `skipped`) | `INVALID_QUANTITY` |
| `updateQuantity` | `(ctx, variantId, quantity)` (0 = xoá dòng) | `CartView` | `INVALID_QUANTITY`, `ITEM_NOT_FOUND`, `VARIANT_NOT_FOUND`, `INSUFFICIENT_STOCK` |
| `removeItem` | `(ctx, variantId)` (idempotent) | `CartView` | – |
| `clearCart` | `(ctx)` | `CartView` (rỗng) | – |
| `mergeGuestCart` | `(userId, sessionId)` | `CartView` | – (**không được gọi ở đâu trong app**) |

Chỉ kiểm tồn kho, không giữ chỗ. `MAX_LINE_QUANTITY = 99` (`src/lib/cart.ts`).

### 3.3 `order.service.ts` — User (mọi hàm đọc/ghi theo `userId`), trừ nhóm Admin/System
| Hàm | Chữ ký | Trả về | Lỗi (`OrderError.code`) |
|---|---|---|---|
| `createOrder` | `(user: {id}, input: CreateOrderInput)` | `OrderDetail` | `PAYMENT_METHOD_UNAVAILABLE`, `EMPTY_CART`, `ADDRESS_NOT_FOUND`, `OUT_OF_STOCK` (kèm `shortages`) |
| `cancelOrder` | `(user: {id}, orderId, reason?)` | `OrderDetail` | `ORDER_NOT_FOUND`, `CANNOT_CANCEL` |
| `getOrder` | `(userId, orderId)` | `OrderDetail \| null` | – |
| `getOrderDetail` | `(userId, orderId)` | `OrderDetailView \| null` (có `history`, `inStock` từng dòng) | – |
| `listOrders` | `(userId, input: OrderListFilterInput = {})` | `OrderListResult` (lọc `status`, `q` = mã đơn hoặc tên sản phẩm, phân trang, `counts`) | `ZodError` nếu input sai |
| `listRecentOrders` | `(userId, limit = 5)` | `OrderSummary[]` | – |
| `countOrders` | `(userId)` | `number` | – |
| `reorder` | `(user: {id}, orderId)` | `ReorderResult` | `ORDER_NOT_FOUND` |
| *Admin/System* `changeOrderStatus` | `(orderId, to, actor: OrderActor, note?)` | `void` | `INVALID_STATUS_CHANGE`, `ORDER_NOT_FOUND` — **không kiểm chủ đơn** |
| *System* `cancelExpiredOrder` | `(orderId)` | `void` | `CANNOT_CANCEL`, `ORDER_NOT_FOUND` |
| *Nội bộ* `recordStatusChange` | `(tx, orderId, from, to, actor, note?)` | `void` | – |

`CreateOrderInput = { addressId? ; newAddress?: AddressInput ; paymentMethod: "COD"|"BANK_TRANSFER"|"VNPAY" ; note? }`. `createOrder` chạy trong một `$transaction`: trừ kho bằng `updateMany({stock >= qty})`, snapshot giá vào `OrderItem`, cấp mã `FS-YYYYMMDD-NNNN`, xoá giỏ. Người khác truy cập đơn không phải của mình luôn nhận NOT_FOUND/`null`. Giỏ của đơn lấy theo `userId` (không dùng `sessionId`).

### 3.4 `payment.service.ts` — User / công khai (VNPay)
| Hàm | Chữ ký | Trả về | Lỗi |
|---|---|---|---|
| `getVnpayPayUrl` | `(userId, orderId, ipAddr)` | `string` (URL ký) | `OrderError`: `ORDER_NOT_FOUND`, `CANNOT_PAY`, `PAYMENT_EXPIRED` |
| `createPaymentUrl` | `(order, opts?)` | `string` | `Error` nếu thiếu cấu hình VNPay |
| `verifyReturn` | `(params, config?)` | `VnpayReturnResult` (không đụng DB) | `Error` nếu thiếu cấu hình |
| `findOrderIdByCode` | `(code)` | `string \| null` | – |
| `handleIPN` | `(params, config?)` | `IpnResponse` (`RspCode`, `Message`) | – (lỗi trả bằng mã) |
| `expireUnpaidVnpayOrders` | `(now?)` | `{ cancelled: number }` | – |

### 3.5 `address.service.ts` — User
`listAddresses(userId): AddressDTO[]`, `createAddress(userId, input: AddressInput)`, `updateAddress(userId, id, input)`, `deleteAddress(userId, id)`, `setDefaultAddress(userId, id)`. Lỗi: `AddressNotFoundError` (**không có trường `code`**).

### 3.6 `auth.service.ts` — Public / User
`startSession(userId)`, `register(input)`, `login(input, {ip})`, `logout(refreshToken?)`, `refresh(refreshToken)` → `AuthSession`; `getUserById(id)` → `PublicUser | null`; `updateProfile(userId, input)` → `PublicUser`; `changePassword(userId, input)` → `void`. Lỗi `AuthError.code`: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`, `WRONG_PASSWORD`, `USER_NOT_FOUND`. `PublicUser = { id, email, name, phone, role }` (không có `passwordHash`).

## 4. Dữ liệu (Prisma)

Model: `User`, `RefreshToken`, `Address`, `Category` (cây 2 cấp), `Product`, `ProductImage`, `ProductVariant`, `SizeChart`, `Cart`, `CartItem`, `OrderSequence`, `Order`, `OrderItem`, `OrderStatusHistory`. Extension `vector` và `unaccent` đã bật qua migration. **CHƯA CÓ**: bảng/cột embedding, bảng hội thoại AI, bảng khuyến mãi/voucher, cột mùa-trong-bộ-lọc (`Product.season` có trong DB nhưng `productFilterSchema` không có trường `season`).

## 5. Những điểm cần nhớ khi thêm tầng AI
1. Mọi logic mới đi qua service; route AI chỉ validate + gọi service (cùng quy tắc `project.md`).
2. Service giỏ/đơn/địa chỉ đã nhận context thuần nên AI gọi lại được; chi tiết chỗ cần refactor ở `docs/ai/04-tool-calling.md`.
3. `listProducts` + `productFilterSchema` là điểm vào duy nhất của tìm kiếm có cấu trúc; tìm ngữ nghĩa phải trả kết quả cùng kiểu `ProductListResult` để UI tái dùng.
