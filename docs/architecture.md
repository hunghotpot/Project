# Kiến trúc hệ thống (hiện trạng code)

Tài liệu mô tả đúng code đang có (viết 2026-11-10, cập nhật 2026-11-12: thêm tầng Admin). Chỗ nào chưa có ghi **CHƯA CÓ**. Quy ước kiến trúc gốc: `CLAUDE.md`, `.claude/rules/project.md`. Trạng thái tính năng: `docs/status-customer.md`.

## 1. Sơ đồ các lớp

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ UI (Server Component / Client Component)                                       │
│  src/app/(shop)/**/page.tsx, src/components/**, hooks/*, stores/*              │
│  - Client KHÔNG import src/server/ (kiểm lại 2026-11-12: 0 vi phạm)                         │
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
│  auth · address · catalog · cart · order · payment · admin-*                   │
│  - Chứa toàn bộ nghiệp vụ, kiểm quyền sở hữu (where userId), transaction      │
│  - Ném lỗi có mã (AuthError, CartError, OrderError) hoặc AddressNotFoundError  │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ Prisma Client (src/server/db.ts)
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ PostgreSQL 16 (+ extension vector, unaccent)  ·  Redis (CHƯA được code dùng)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Thư mục phụ trợ: `src/lib/` (hàm thuần dùng chung server/client: `cart.ts`, `order.ts`, `shipping.ts`, `product-variants.ts`, `format.ts`, `care.ts`), `src/lib/validators/` (Zod), `src/types/` (DTO), `src/server/payment/` (ký VNPay, VietQR), `src/server/auth/` (jwt, session, admin, rate-limit), `src/server/ai/advisor/` (tư vấn size, đã chạy thật, xem 3.8), `src/server/uploads.ts` (hàm thuần kiểm tra ảnh tải lên). Hàm thuần riêng cho Admin ở `src/lib/`: `admin-list.ts`, `admin-dates.ts`, `inventory.ts`, `customer-tier.ts`.

**Tầng Admin** (từ 2026-11-12) dùng đúng các lớp trên: giao diện ở `src/app/(admin)/admin/**` + `src/components/admin/**`, Server Action `src/app/actions/admin-*.ts`, route `/api/admin/uploads`, nghiệp vụ ở `src/server/services/admin-*.service.ts`. Service Admin **không tự kiểm quyền**: tầng gọi phải kiểm bằng `getAdminUser()` (`src/server/auth/admin.ts`) trước khi gọi. Chi tiết ở mục 2.1 và 3.7.

Giai đoạn AI sẽ thêm một **tầng vào thứ ba** (route `/api/ai/*`) đứng cùng cấp với Route/Action, và cũng chỉ gọi service (xem `docs/ai/00-overview.md`).

## 2. Tầng vào hiện có

### Server Action (`src/app/actions/`)
| Action | File | Gọi service |
|---|---|---|
| `registerAction(input, next?)`, `loginAction(input, next?)`, `logoutAction()` | `auth.ts` | `auth.service` (`register`, `login`, `logout`) |
| `updateProfileAction`, `changePasswordAction`, `createAddressAction`, `updateAddressAction(id, input)`, `deleteAddressAction(id)`, `setDefaultAddressAction(id)` | `account.ts` | `auth.service`, `address.service` |
| `placeOrderAction(input)` | `checkout.ts` | `order.service.createOrder` |
| `cancelOrderAction(input)`, `reorderAction(orderId)` | `orders.ts` | `order.service.cancelOrder`, `reorder` |
| `getSizeAdviceAction(input)` (cần đăng nhập, không dùng LLM) | `size-advice.ts` | `ai/advisor/size.service.adviseSizeForProduct` |

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

Trang Server Component (`src/app/(shop)/**`) gọi service trực tiếp để đọc dữ liệu (catalog, giỏ, đơn). `src/middleware.ts` chặn `/account/*` (cần đăng nhập) và `/admin/*` (cần role ADMIN); layout `/admin` đọc lại DB bằng `requireAdmin()`.

### 2.1 Tầng Admin
| Server Action (`src/app/actions/`) | Việc | Service |
|---|---|---|
| `admin-orders.ts`: `approveOrderAction`, `advanceOrderAction`, `cancelOrderAction`, `markBankTransferPaidAction` | Duyệt/giao/hoàn thành, huỷ, xác nhận đã nhận chuyển khoản | `admin-order.service` |
| `admin-products.ts`: `saveProductAction`, `setProductActiveAction`, `deleteProductAction`, `adjustStockAction` | Tạo/sửa/ẩn/xoá sản phẩm, nhập kho | `admin-product.service` |
| `admin-customers.ts`: `lockCustomerAction`, `unlockCustomerAction`, `createCustomerAction` | Khoá/mở khoá, tạo tài khoản khách | `admin-customer.service` |
| `admin-categories.ts`, `admin-size-charts.ts` | Danh mục, bảng size | `admin-category.service`, `admin-size-chart.service` |

| Route | Method | Quyền | Việc |
|---|---|---|---|
| `/api/admin/uploads` | POST | Admin (`getAdminUser`) | Tải ảnh sản phẩm vào `public/uploads` (magic bytes, 5MB, 4 ảnh, tên do server sinh) |
| `/uploads/[name]` | GET | công khai | Phục vụ ảnh đã tải (tên phải khớp UUID + jpg/png/webp) |

Trang `/admin` (Tổng quan), `/admin/orders`, `/admin/products`, `/admin/categories`, `/admin/size-charts`, `/admin/customers` nối dữ liệu thật; `/admin/vouchers` và `/admin/settings` là giao diện minh hoạ, chưa có backend.

## 3. Danh mục service

Ký hiệu quyền: **Public** = không cần đăng nhập; **User** = nhận `userId` và tự ràng buộc dữ liệu theo user; **Admin/System** = không kiểm quyền sở hữu, tầng gọi phải tự bảo đảm.

### 3.1 `catalog.service.ts` — Public (chỉ đọc, chỉ sản phẩm `isActive`)
| Hàm | Chữ ký | Trả về | Lỗi |
|---|---|---|---|
| `getNavCategories` | `()` | `NavCategory[]` | – |
| `getHomeCategories` | `()` | `CategoryCardData[]` (chỉ category GỐC có sản phẩm, đếm cả con; ảnh bìa lấy từ sản phẩm mới nhất) | – |
| `getNewProducts` | `(limit = 8)` | `ProductCardData[]` | `ZodError` nếu `limit` sai (`sectionLimitSchema`) |
| `getFeaturedProducts` | `(limit = 8)` | `ProductCardData[]` | như trên |
| `getCategoryBySlug` | `(slug: string)` | `CategoryDetail \| null` | – |
| `listProducts` | `(input: ProductFilterInput = {}, opts: ListProductsOptions = {})` (`opts.includeUnisex`: nam/nữ gồm cả UNISEX, mặc định `false`) | `ProductListResult` (`items`, `total`, `page`, `pageSize`, `pageCount`, `facets`) | không ném lỗi do input (schema dùng `.catch` rơi về mặc định) |
| `getProductBySlug` | `(slug: string)` | `ProductDetail \| null` (kèm `variants` có `stock`, `sizeChart`) | – |
| `getSizeChart` / `getSizeChartInfo` | `(categoryId, brand | null)` | `SizeChartRow[]` / `{ rows, brandSpecific }` (ưu tiên bảng riêng của brand) | – |
| `getRelatedProducts` | `(product: Pick<ProductDetail,"id"\|"categoryId"\|"style">, limit = 4)` | `ProductCardData[]` | `ZodError` nếu `limit` sai |

Ghi chú: tìm từ khoá `q` chạy bằng `unaccent(lower(...)) LIKE` trên `name + brand + tags + category.name`, **mọi từ phải khớp** (AND, tối đa 8 từ). Không có full-text index, không có vector. Facet trả `sizes`, `colors`, `materials`, `styles`, `genders`, `occasions`, `price`.

### 3.2 `cart.service.ts` — User đã đăng nhập (qua `CartContext`)
`type CartContext = { userId: string }` — service **không đọc cookie/headers**. Không có giỏ khách (đã bỏ).

| Hàm | Chữ ký | Trả về | Lỗi (`CartError.code`) |
|---|---|---|---|
| `getCart` | `(ctx)` | `CartView` | `ITEM_NOT_FOUND` nếu ctx rỗng |
| `addItem` | `(ctx, variantId, quantity)` | `CartView` | `INVALID_QUANTITY`, `VARIANT_NOT_FOUND`, `OUT_OF_STOCK`, `INSUFFICIENT_STOCK` (kèm `available`) |
| `addItemsClamped` | `(ctx, lines: {variantId, quantity}[])` | `ClampedAddResult` (`added`, `skipped`) | `INVALID_QUANTITY` |
| `updateQuantity` | `(ctx, variantId, quantity)` (0 = xoá dòng) | `CartView` | `INVALID_QUANTITY`, `ITEM_NOT_FOUND`, `VARIANT_NOT_FOUND`, `INSUFFICIENT_STOCK` |
| `removeItem` | `(ctx, variantId)` (idempotent) | `CartView` | – |
| `clearCart` | `(ctx)` | `CartView` (rỗng) | – |

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
| *Admin/System* `changeOrderStatus` | `(orderId, to, actor: OrderActor, note?)` | `void` | `INVALID_STATUS_CHANGE`, `ORDER_NOT_FOUND` — **không kiểm chủ đơn**; Admin dùng qua `adminChangeOrderStatus` (3.7) |
| *Admin/System* `cancelOrderCore` | `(orderId, scope: { userId?, paymentIn?, markPaymentFailed?, actor, note? })` | `void` | `ORDER_NOT_FOUND`, `CANNOT_CANCEL` — lõi huỷ đơn dùng chung cho `cancelOrder`, `cancelExpiredOrder` và `adminCancelOrder` |
| *System* `cancelExpiredOrder` | `(orderId)` | `void` | `CANNOT_CANCEL`, `ORDER_NOT_FOUND` |
| *Nội bộ* `recordStatusChange` | `(tx, orderId, from, to, actor, note?)` | `void` | – |

`CreateOrderInput = { addressId? ; newAddress?: AddressInput ; paymentMethod: "COD"|"BANK_TRANSFER"|"VNPAY" ; note? }`. `createOrder` chạy trong một `$transaction`: trừ kho bằng `updateMany({stock >= qty})`, snapshot giá vào `OrderItem`, cấp mã `FS-YYYYMMDD-NNNN`, xoá giỏ. Người khác truy cập đơn không phải của mình luôn nhận NOT_FOUND/`null`. Giỏ của đơn lấy theo `userId`.

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
`startSession(userId)`, `register(input)`, `login(input, {ip})`, `logout(refreshToken?)`, `refresh(refreshToken)` → `AuthSession`; `getUserById(id)` → `PublicUser | null`; `updateProfile(userId, input)` → `PublicUser`; `changePassword(userId, input)` → `void`. Lỗi `AuthError.code`: `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`, `WRONG_PASSWORD`, `USER_NOT_FOUND`, `ACCOUNT_LOCKED` (tài khoản bị Admin khoá: không đăng nhập/refresh được; `getUserById` trả `null` nên phiên cũ mất hiệu lực ngay). `PublicUser = { id, email, name, phone, role }` (không có `passwordHash`).

### 3.7 `admin-*.service.ts` — Admin (không kiểm quyền; tầng gọi phải `getAdminUser()` trước)
Nhận `admin: { userId }` làm ngữ cảnh. Input công khai được `parse` lại bằng Zod (`src/lib/validators/admin-*.ts`).

| Service | Hàm chính | Lỗi |
|---|---|---|
| `admin-order.service` | `listAllOrders`, `getOrderStatusCounts`, `getAdminOrderDetail`, `adminCancelOrder`, `adminChangeOrderStatus`, `markBankTransferPaid` | `OrderError` |
| `admin-product.service` | `listAdminProducts`, `getInventorySummary`, `listLowStockVariants`, `getAdminProduct`, `createProduct`, `updateProduct`, `setProductActive`, `deleteProduct`, `adjustStock` | `AdminCatalogError` |
| `admin-category.service` | `listCategoriesTree`, `createCategory`, `updateCategory`, `deleteCategory` | `AdminCatalogError` |
| `admin-size-chart.service` | `listSizeChart`, `replaceSizeChart`, `deleteSizeChartRows` | `AdminCatalogError` |
| `admin-customer.service` | `listCustomers`, `getCustomerSummary`, `getCustomerDetail`, `lockCustomer`, `unlockCustomer`, `createCustomerByAdmin` | `AdminCustomerError` |
| `admin-dashboard.service` | `getDashboardStats` | – |

Ghi chú: `product-hooks.ts` có hàm rỗng `syncProductEmbedding(productId)`, được `admin-product.service` gọi sau mỗi thay đổi sản phẩm/tồn kho (điểm móc cho embedding). Doanh thu = đơn `PAID` hoặc COD đã giao, loại huỷ/hoàn tiền, tính theo ngày tạo đơn. Hạng VIP suy ra từ tổng chi tiêu (`src/lib/customer-tier.ts`), không lưu cột.

### 3.8 `src/server/ai/advisor/` — tầng AI hiện có (chưa dùng LLM)
`size.ts`: hàm thuần `getSizeRecommendation(input)` (đo độ lệch so với bảng size, trả trạng thái `recommended`/`between_two`/`out_of_range`/`need_info`/`no_chart` (kiểu `SizeStatus` ở `src/types/assistant.ts`)). `size.service.ts`: `adviseSizeForProduct(input)` đọc `getProductBySlug` + `getSizeChartInfo`, suy loại sản phẩm từ slug category lá bằng `sizeKindOf`, trả `SizeAdviceResult | null` (null nếu sản phẩm không tồn tại/ngừng bán). Chỉ đọc, không ghi, không đọc cookie. Test: `size.test.ts`. Các phần AI còn lại **CHƯA CÓ** (xem `docs/TODO.md` mục B).

## 4. Dữ liệu (Prisma)

Model: `User` (có `status` ACTIVE/LOCKED), `RefreshToken`, `Address`, `Category` (cây 2 cấp), `Product`, `ProductImage`, `ProductVariant`, `SizeChart`, `Cart`, `CartItem`, `OrderSequence`, `Order`, `OrderItem`, `OrderStatusHistory`. Extension `vector` và `unaccent` đã bật qua migration. **CHƯA CÓ**: bảng/cột embedding, bảng hội thoại AI, bảng khuyến mãi/voucher, bảng cấu hình hệ thống, vai trò nhân viên (chỉ CUSTOMER/ADMIN). Danh mục là cây Nam / Nữ / Unisex + Phụ kiện (20 category, mỗi sản phẩm một category lá theo giới tính). Lọc theo mùa đã có: `productFilterSchema` có trường `season` (khớp khi trùng ít nhất một mùa), đi vào URL và hiện thành chip; chưa có ô chọn mùa trong panel lọc.

## 5. Những điểm cần nhớ khi thêm tầng AI
1. Mọi logic mới đi qua service; route AI chỉ validate + gọi service (cùng quy tắc `project.md`).
2. Service giỏ/đơn/địa chỉ đã nhận context thuần nên AI gọi lại được; chi tiết chỗ cần refactor ở `docs/ai/04-tool-calling.md`.
3. **Không bao giờ** import `admin-*.service` hay `getAdminUser` vào `src/server/ai/*` (tool AI là tập đóng, không có quyền Admin).
4. `listProducts` + `productFilterSchema` là điểm vào duy nhất của tìm kiếm có cấu trúc; tìm ngữ nghĩa phải trả kết quả cùng kiểu `ProductListResult` để UI tái dùng.
