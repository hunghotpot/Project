# Fashion E-Commerce with AI Shopping Concierge

Website thương mại điện tử thời trang. Giai đoạn sau sẽ tích hợp AI Shopping Concierge (Tool Calling gọi lại các service trong `src/server/services`).

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL (pgvector) · Redis · Zod · TanStack Query · Zustand · react-hook-form · jose · bcryptjs

## Yêu cầu

- Node.js 20+ và npm
- Docker Desktop (chạy PostgreSQL + Redis)

## Chạy dự án từ đầu

```bash
git clone <url-repo> fashion-shop && cd fashion-shop
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run db:up               # khởi động PostgreSQL + Redis (Docker phải đang chạy)
npx prisma generate         # sinh Prisma Client
npx prisma migrate dev      # tạo bảng + bật extension (unaccent)
npm run db:seed             # nạp dữ liệu mẫu (xem mục "Dữ liệu seed")
npm run dev                 # http://localhost:3000
```

Sau `cp`, mở `.env` và đặt `JWT_SECRET` thành chuỗi ngẫu nhiên từ 32 ký tự trở lên (ví dụ `openssl rand -base64 32`). Các biến `VNP_*`, `CRON_SECRET` có thể để trống khi dev: thiếu `VNP_*` thì phương thức VNPay bị khoá ở trang thanh toán. `BANK_*` mặc định là dữ liệu mẫu.

**Tài khoản demo** (chỉ dùng cho dev, tạo bởi `db:seed`):

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| ADMIN | `admin@example.com` | `Admin@123456` |
| CUSTOMER | `customer@example.com` | `Customer@123456` |

Kiểm tra sau khi cài: `npm run lint && npm run typecheck && npm test` (test tích hợp cần `db:up` và dữ liệu đã migrate). Máy Windows bị Application Control chặn file native của rollup: dự án đã dùng `@rollup/wasm-node` thay cho `rollup` (xem `package.json`).

## Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm run build` / `npm start` | Build / chạy production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm test` | Chạy test (Vitest) |
| `npm run db:up` / `npm run db:down` | Bật / tắt PostgreSQL + Redis (dữ liệu giữ trong Docker volume) |
| `npm run db:seed` | Seed dữ liệu |

Xoá cả dữ liệu: `docker compose down -v`.

## Xác thực

Tự xây bằng `jose` + `bcryptjs`, không dùng thư viện auth ngoài.

- **Token:** access token (JWT, 15 phút) và refresh token (chuỗi ngẫu nhiên, 7 ngày) nằm trong cookie `httpOnly`, `sameSite=lax`. `secure` chỉ bật ở production.
- **Refresh token** chỉ lưu SHA-256 trong bảng `RefreshToken`, rotate mỗi lần refresh. Token đã thu hồi mà bị dùng lại thì cả chuỗi phiên bị thu hồi.
- **Middleware** (`src/middleware.ts`): `/account/*` cần đăng nhập, `/admin/*` cần role `ADMIN`. Access token hết hạn mà còn refresh token thì tự đi qua `/api/auth/refresh`.
- **Rate limit đăng nhập:** in-memory, khoá 15 phút sau 5 lần sai theo cặp IP + email (chạy nhiều instance thì chuyển sang Redis).
- **Biến môi trường:** `JWT_SECRET` tối thiểu 32 ký tự.
- **Code:** logic ở `src/server/services/auth.service.ts` và `address.service.ts`; helper `getCurrentUser()`, `requireUser()`, `requireAdmin()` ở `src/server/auth/session.ts`; Server Actions ở `src/app/actions/`.
- **Trang:** `/login`, `/register`, `/account/profile` (thông tin tài khoản xem/sửa tại chỗ, đơn hàng gần đây, đổi mật khẩu), `/account/addresses` (sổ địa chỉ). "Đơn hàng của tôi" xem mục bên dưới; "Trung tâm trợ giúp" trong menu tài khoản đã có theo Figma nhưng chưa có trang.
- **API:** `GET /api/auth/me` (user hiện tại), `GET /api/auth/refresh` (do middleware gọi).

## Danh sách sản phẩm

- **Trang:** `/products` (tìm kiếm, tất cả sản phẩm) và `/categories/[slug]` (category cha gồm cả sản phẩm của category con).
- **Bộ lọc nằm hoàn toàn trong URL**, ví dụ `?size=M&size=L&color=Đen&minPrice=100000&inStock=1&sort=price_asc&page=2`. Một schema Zod duy nhất `src/lib/validators/product-filter.ts` dùng để parse URL và gọi service; giá trị sai tự rơi về mặc định. Phía client đọc/ghi URL qua hook `useProductFilters()`.
- **Service:** `listProducts(filters)` trong `catalog.service.ts` trả `items`, `total`, `pageCount` và `facets` (đếm theo size, màu, chất liệu, phong cách, dịp, giới tính, khoảng giá). Facet bỏ qua chính bộ lọc của chiều đó nên chọn Size M vẫn thấy số lượng của L, XL.
- **Tìm kiếm không dấu** dùng extension PostgreSQL `unaccent` (đã bật trong migration `enable_unaccent`).
- **Sắp xếp `popular`** hiện dùng cờ `isFeatured` làm tín hiệu thay thế vì chưa có dữ liệu bán hàng.
- **Kiểm tra N+1:** chạy `PRISMA_QUERY_LOG=1 npm run dev` để in mọi câu SQL; số câu SQL mỗi trang cố định (14) dù `pageSize` là 1, 12 hay 48.

## Trang chi tiết sản phẩm

- **Route:** `/products/[slug]`; slug không tồn tại hoặc `isActive = false` trả 404. Có `generateMetadata` và JSON-LD `schema.org/Product` (AggregateOffer theo giá thấp/cao nhất của biến thể).
- **Chọn biến thể:** logic thuần hàm ở `src/lib/product-variants.ts` (có test). Chỉ chọn được tổ hợp màu × size tồn tại và còn hàng; option hết hàng mờ + gạch chéo, tổ hợp không tồn tại chỉ mờ. Giá và tồn kho theo biến thể đang chọn.
- **Giỏ hàng:** `ProductDetailMain` có ô số lượng và hai nút "Thêm vào giỏ hàng" / "Mua ngay", nhận prop `onAddToCart` và `onBuyNow` (`{ variantId, quantity }`); `ProductDetailConnected` nối hai prop này với giỏ hàng (xem mục "Giỏ hàng").
- **Bảng size:** lấy từ `SizeChart` của category (ưu tiên bảng riêng của brand), ẩn nút nếu category chưa có bảng.
- **Chăm sóc:** DB chưa có trường riêng nên `src/lib/care.ts` gợi ý chung theo chất liệu.
- **Ảnh theo màu:** `imagesForColor()` đã sẵn, nhưng bảng `ProductImage` chưa có cột màu nên hiện chưa tác dụng. Cần thêm cột `color` (nullable) vào `ProductImage` để bật.

## Giỏ hàng

- **Service:** `src/server/services/cart.service.ts` — `getCart`, `addItem`, `updateQuantity` (số lượng 0 = xoá dòng), `removeItem`, `clearCart`, `mergeGuestCart`. Mọi hàm nhận `ctx` (`{ userId }` hoặc `{ sessionId }`) và không đọc cookie/headers, nên Route Handler và AI tool-calling dùng lại được.
- **Chỉ cho user đã đăng nhập:** khách không thêm/sửa/xoá được (API trả 401 `UNAUTHENTICATED`), `/cart` chuyển sang `/login?next=/cart`, icon giỏ và nút "Thêm vào giỏ hàng" dẫn khách sang đăng nhập rồi quay lại đúng trang. `cart.service` vẫn nhận được `{ sessionId }` và có `mergeGuestCart` (bảng `Cart` có `sessionId`), nhưng app hiện không dùng; nếu sau này muốn giỏ khách thì chỉ cần cho `resolveCartContext` đọc cookie phiên và gọi `mergeGuestCart` khi đăng nhập.
- **Tồn kho:** thêm/sửa không được vượt `stock`, lỗi có mã (`INSUFFICIENT_STOCK`, `OUT_OF_STOCK`...) và thông báo tiếng Việt. Chỉ kiểm tra, không giữ chỗ; trừ kho nằm ở bước đặt hàng.
- **Cảnh báo:** giỏ trả kèm cảnh báo khi giá đã đổi so với lúc thêm (`CartItem.priceAtAdd`), tồn kho giảm dưới số lượng, hết hàng hoặc sản phẩm ngừng bán.
- **API:** `GET /api/cart`, `POST /api/cart/items`, `PATCH|DELETE /api/cart/items/[variantId]`.
- **Giao diện:** TanStack Query với optimistic update (`src/hooks/use-cart.ts`), cart drawer mở khi bấm icon giỏ và sau khi thêm sản phẩm, trang `/cart`. Voucher và nút "Tiến hành thanh toán" đã có theo Figma nhưng bị khoá cho tới khi có backend voucher và trang checkout.

## Thanh toán & đơn hàng

- **Luồng:** giỏ → `/checkout` (bắt buộc đăng nhập) → COD: `/orders/[id]/success`; chuyển khoản: `/orders/[id]/payment` (mã VietQR) → `/orders/[id]/success`. VNPAY (thẻ) đi qua cổng VNPay, xem mục "Thanh toán VNPay" bên dưới.
- **`createOrder` (src/server/services/order.service.ts)** chạy trong MỘT `prisma.$transaction`: đọc giỏ, kiểm tra địa chỉ, trừ kho bằng `updateMany({ stock >= qty })` (nguyên tử, chống oversell khi nhiều người mua cùng lúc), tạo `Order` + `OrderItem` (snapshot giá/tên/size/màu), cấp mã đơn, xoá giỏ. Thiếu hàng ở bất kỳ dòng nào thì rollback toàn bộ và báo rõ từng sản phẩm.
- **`cancelOrder`:** chỉ khi `PENDING`/`CONFIRMED`, hoàn tồn kho trong cùng transaction.
- **Mã đơn:** `FS-YYYYMMDD-0001`, số thứ tự theo ngày (giờ Việt Nam) lấy từ bảng `OrderSequence` bằng upsert increment nên không trùng.
- **Phí vận chuyển:** `src/lib/shipping.ts` — miễn phí từ 500.000đ, dưới mức đó 30.000đ.
- **VietQR:** `src/server/payment/vietqr.ts` tự sinh payload chuẩn NAPAS 247 (có test CRC). Đặt `BANK_NAME`, `BANK_BIN`, `BANK_ACCOUNT_NO`, `BANK_ACCOUNT_NAME` trong `.env`; giá trị mặc định chỉ là dữ liệu mẫu từ Figma.
- **Chưa có:** tự động đối soát tiền chuyển khoản (đơn chuyển khoản vẫn `PENDING` cho tới khi xác nhận tay), voucher/giảm giá, tự huỷ đơn chuyển khoản quá hạn (chỉ đơn VNPAY mới có hạn 15 phút).
- **Test:** `order.service.integration.test.ts` chạy trên PostgreSQL thật (cần `npm run db:up`), gồm 2 đơn cùng mua biến thể còn 1 sản phẩm và 5 người tranh 2 sản phẩm.

## Thanh toán VNPay

Dành cho đơn có `paymentMethod = VNPAY`. Tích hợp API 2.1.0, ký HMAC-SHA512.

**Luồng:** đặt hàng (đơn `PENDING`, đã trừ kho) → `GET /api/payment/vnpay/pay?orderId=` ký URL rồi chuyển sang cổng VNPay → người dùng thanh toán → VNPay gọi **IPN** (server-to-server, nguồn sự thật) và đưa người dùng về **Return URL** (chỉ hiển thị kết quả, không đổi trạng thái).

| Route | Vai trò |
| --- | --- |
| `GET /api/payment/vnpay/pay` | Cần đăng nhập. Ký URL thanh toán và chuyển hướng; dùng cả cho "Thanh toán lại". |
| `GET /api/payment/vnpay/return` | Kiểm chữ ký rồi chuyển tới trang thành công hoặc trang "thanh toán không thành công". |
| `GET /api/payment/vnpay/ipn` | VNPay gọi. Kiểm chữ ký + số tiền khớp đơn, cập nhật `paymentStatus`; **idempotent** (gọi lại trả `02`). |
| `GET /api/cron/expire-orders` | Huỷ đơn VNPAY quá 15 phút chưa trả tiền và hoàn tồn kho. Cần header `Authorization: Bearer <CRON_SECRET>`. |

**Cấu hình** (`.env`): `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL` (mặc định sandbox), `VNP_RETURN_URL`, `CRON_SECRET`. Chưa đặt `VNP_TMN_CODE`/`VNP_HASH_SECRET` thì lựa chọn VNPAY bị khoá ở trang thanh toán. Secret và dữ liệu giao dịch không bao giờ được log.

**Quy tắc trạng thái:** IPN thành công → `paymentStatus = PAID`, đơn `CONFIRMED`; giao dịch thất bại → `FAILED` (đơn vẫn `PENDING`, được thanh toán lại trong 15 phút); quá hạn (15 phút + 2 phút đệm cho IPN đến muộn) → đơn `CANCELLED`, hoàn tồn kho. Job huỷ chỉ chạm đơn chưa trả tiền nên không thể huỷ nhầm đơn vừa được thanh toán.

### Chạy thử với sandbox

1. Đăng ký tài khoản sandbox tại https://sandbox.vnpayment.vn/devreg/ — VNPay gửi email `Terminal ID (vnp_TmnCode)` và `Secret Key (vnp_HashSecret)`. Điền vào `.env`.
2. Chạy `npm run dev`, thêm hàng vào giỏ, vào `/checkout`, chọn **Thẻ Tín dụng / Ghi nợ**, đặt hàng. Trang sẽ chuyển sang cổng VNPay sandbox.
3. Chọn ngân hàng **NCB** và nhập thẻ thử theo tài liệu VNPay (https://sandbox.vnpayment.vn/apis/vnpay-demo/): số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, ngày phát hành `07/15`, mã OTP `123456`. Đây là thẻ giả của sandbox; hãy đối chiếu lại với tài liệu VNPay nếu thông tin đổi.
4. **IPN cần URL công khai.** VNPay không gọi được `localhost`. Hoặc dùng tunnel (ngrok, cloudflared) rồi khai báo URL IPN `https://<tunnel>/api/payment/vnpay/ipn` trong trang quản trị merchant sandbox (https://sandbox.vnpayment.vn/merchantv2/); hoặc, khi chạy local, copy phần query của URL Return và gọi tay vào IPN:
   ```bash
   curl "http://localhost:3000/api/payment/vnpay/ipn?<query của URL return>"
   ```
   Kết quả đúng là `{"RspCode":"00","Message":"Confirm Success"}`; gọi lần hai trả `{"RspCode":"02",...}`.
5. Thử hết hạn: trong DB lùi `createdAt` của đơn VNPAY 30 phút, rồi gọi
   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/expire-orders
   ```
   Đơn chuyển `CANCELLED`, tồn kho được hoàn lại. Trên môi trường thật, đặt lịch gọi route này mỗi vài phút (cron của hosting, GitHub Actions, scheduler...).

Test: `payment.service.integration.test.ts` (PostgreSQL thật, dùng secret giả cố định trong `vitest.config.ts`) và `src/server/payment/vnpay.test.ts` (ký/kiểm chữ ký).

## Đơn hàng của tôi

- **Trang:** `/account/orders` (lọc theo trạng thái, tìm theo mã đơn/tên sản phẩm, phân trang; tất cả nằm trong URL `?status=&q=&page=`) và `/account/orders/[id]` (timeline trạng thái, sản phẩm, địa chỉ, thanh toán, hủy đơn, mua lại). Hai trang này không có sidebar nên `profile`/`addresses` nằm trong nhóm route `(panel)` (có sidebar), còn `orders` đứng riêng.
- **Lịch sử trạng thái:** bảng `OrderStatusHistory` ghi mỗi lần đổi trạng thái (từ → sang, thời gian, người đổi `CUSTOMER`/`ADMIN`/`SYSTEM`, ghi chú/lý do) và luôn được ghi **trong cùng transaction** với lần đổi: tạo đơn, huỷ đơn (người dùng hoặc job hết hạn), IPN VNPay thành công, và `changeOrderStatus()`. Timeline dựng từ bảng này (`src/lib/order-timeline.ts`). Đơn cũ trước khi có bảng được backfill trong migration.
- **`changeOrderStatus(orderId, to, actor, note)`** chuyển đơn tuần tự `PENDING → CONFIRMED → SHIPPING → DELIVERED` (không nhảy cóc, không đi lùi). Hiện **chưa có giao diện admin**: các trạng thái đang giao/hoàn thành chỉ đổi được bằng hàm này.
- **Quyền:** mọi hàm của `order.service` (`listOrders`, `getOrderDetail`, `cancelOrder`, `reorder`) ràng buộc `userId` ngay trong câu truy vấn; đơn của người khác không tìm thấy (trang trả 404, kể cả với tài khoản admin), không phụ thuộc vào UI.
- **Hủy đơn:** chỉ khi `PENDING`/`CONFIRMED`; khoá dòng đơn rồi hoàn tồn kho, ghi lịch sử kèm lý do (tuỳ chọn) trong một transaction.
- **Mua lại:** thêm các biến thể còn hàng của đơn cũ vào giỏ (cắt theo tồn kho, không vượt số còn lại, bỏ dòng hết hàng/ngừng bán và báo lý do) qua `cart.service.addItemsClamped`.
- **Chạy test:** `order-history.integration.test.ts` chạy trên PostgreSQL thật (cần `npm run db:up`).

## Dữ liệu seed

`npm run db:seed` **xoá toàn bộ dữ liệu hiện có** rồi nạp lại (từ chối chạy khi `NODE_ENV=production`). Kết quả cố định giữa các lần chạy.

Tài khoản mẫu (chỉ dùng cho dev, mật khẩu được hash bằng bcrypt, cost 10):

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| ADMIN | `admin@example.com` | `Admin@123456` |
| CUSTOMER | `customer@example.com` | `Customer@123456` |

Nội dung: 9 category (Áo / Quần là category cha), 120 sản phẩm, ~350 ảnh (picsum.photos), ~1.000 biến thể size × màu (một số hết hàng), 34 dòng size chart.

Dữ liệu nằm trong `prisma/seed-data/` để dễ chỉnh:

| File | Nội dung |
| --- | --- |
| `users.ts` | Tài khoản + địa chỉ mẫu |
| `categories.ts` | Cây category, tiền tố SKU, size mặc định |
| `products/*.ts` | Sản phẩm theo category (tên, giá, màu, mô tả, gợi ý phối) |
| `vocab.ts` | Bảng màu (tên + hex), chất liệu (nhãn + câu mô tả) |
| `size-charts.ts` | Size chart áo / quần / váy theo chuẩn Việt Nam |
| `build.ts` | Ghép mô tả, sinh slug, SKU, biến thể, tồn kho |

## Cấu trúc thư mục

```
src/
  middleware.ts         # chặn /account, /admin; refresh token
  app/                  # routes (App Router): (shop), (auth), api/, actions/ = Server Actions
  components/{ui,layout,home,product,cart,checkout,orders,auth,account}
  server/               # chỉ chạy phía server: db.ts, services/*, auth/*, cart/*, payment/*
  lib/{validators,utils,auth}  # Zod schema, helper thuần, hằng số
  types/                # kiểu dùng chung (catalog, order, address)
  test/                 # fake DB và fixture cho Vitest
  hooks/  stores/       # React hooks, Zustand stores
prisma/{schema.prisma,seed.ts,seed-data/,migrations/}
docs/                   # tài liệu trạng thái (status-customer.md)
.claude/rules/          # quy ước kiến trúc cho Claude Code
docker-compose.yml      # PostgreSQL (pgvector) + Redis
```

Quy ước kiến trúc chi tiết: xem [CLAUDE.md](CLAUDE.md) và `.claude/rules/project.md`.







