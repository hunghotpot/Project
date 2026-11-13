# Chức năng của cửa hàng

Mô tả từng trang và chức năng của cửa hàng, **khách hàng và Admin** (gom từ README và hai file `status-customer.md`, `admin-ui.md`, cả hai đã bỏ cùng thư mục ảnh thiết kế Figma; xem lại bằng lịch sử git nếu cần). Cài đặt và chạy dự án: `README.md`. Kiến trúc: `docs/architecture.md`. Trợ lý AI: `docs/ai/00-overview.md`.

| Mục | Nội dung |
| --- | --- |
| [Bảng trạng thái](#bảng-trạng-thái) | Tính năng khách hàng đã xong/chưa, giỏ khách đã bỏ |
| [Xác thực](#xác-thực) | Đăng ký/đăng nhập tự xây (`jose` + `bcryptjs`), token, middleware, trang và API tài khoản |
| [Danh sách sản phẩm](#danh-sách-sản-phẩm) | `/products`, `/categories/[slug]`: bộ lọc nằm trong URL, facet, tìm không dấu, kiểm tra N+1 |
| [Trang chi tiết sản phẩm](#trang-chi-tiết-sản-phẩm) | `/products/[slug]`: chọn biến thể, thêm giỏ/mua ngay, bảng size, chăm sóc |
| [Giỏ hàng](#giỏ-hàng) | `cart.service`, tồn kho, cảnh báo giá/hàng, API và giao diện giỏ |
| [Thanh toán & đơn hàng](#thanh-toán--đơn-hàng) | `createOrder` trong một transaction, huỷ đơn, mã đơn, phí ship, VietQR |
| [Thanh toán VNPay](#thanh-toán-vnpay) | Tích hợp VNPay (IPN, Return URL, hết hạn 15 phút), cách chạy thử với sandbox |
| [Đơn hàng của tôi](#đơn-hàng-của-tôi) | `/account/orders`: lịch sử trạng thái, huỷ đơn, mua lại, quyền truy cập |
| [Trang Admin](#trang-admin) | `/admin`: quyền, màn hình, tải ảnh, khoá tài khoản khách, trạng thái từng màn hình |
| [Quy ước dựng màn hình Admin](#quy-ước-dựng-màn-hình-admin) | Bộ phận giao diện dùng chung, cấu trúc một màn hình, Server Action và test quyền |
| [Nguyên tắc kiến trúc đã kiểm](#nguyên-tắc-kiến-trúc-đã-kiểm) | Kết quả kiểm bảy nguyên tắc kiến trúc |
| [Nợ kỹ thuật](#nợ-kỹ-thuật) | Rollup WASM, cảnh báo Edge, rate limit đăng nhập, hạn chuyển khoản, hoàn tiền |
| [Việc nên làm trước khi lên production](#việc-nên-làm-trước-khi-lên-production) | Checklist trước khi triển khai thật |

## Bảng trạng thái

Cập nhật 2026-11-14.

| Tính năng (khách hàng) | TT | Ghi chú |
|---|---|---|
| Xác thực (đăng ký, đăng nhập, đăng xuất, refresh, đổi mật khẩu) | ✅ | JWT access + refresh xoay vòng (lưu hash, có `familyId`), bcrypt, chống dò email bằng hash giả. Rate limit đăng nhập đang là `Map` trong bộ nhớ (xem nợ kỹ thuật) |
| Danh sách sản phẩm, bộ lọc | ✅ | Bộ lọc nằm trong URL; một schema Zod dùng chung cho server và client |
| Chi tiết sản phẩm | ✅ | Chọn size/màu, bảng size, sản phẩm liên quan, chăm sóc |
| Giỏ hàng (người đã đăng nhập) | ✅ | Kiểm tồn kho, cảnh báo đổi giá/hết hàng |
| Giỏ khách (guest) | — đã bỏ | Quyết định 2026-11-10: giỏ hàng và trợ lý AI đều cần tài khoản; bỏ cột `Cart.sessionId` bằng migration |
| Thanh toán (COD, VietQR, VNPay) | ✅ | Trừ kho nguyên tử trong transaction, snapshot giá/tên/size/màu vào `OrderItem` |
| VNPay | ⚠️ | Code hoàn chỉnh và có test, nhưng **chưa thử với sandbox thật** (`VNP_TMN_CODE`/`VNP_HASH_SECRET` để trống); thiếu cấu hình thì phương thức bị khoá |
| Lịch sử đơn hàng | ✅ | Lọc, phân trang, timeline, huỷ đơn (hoàn kho), mua lại; mọi truy vấn ràng buộc `userId` |
| Tài khoản và địa chỉ | ✅ | Hồ sơ, đổi mật khẩu (thu hồi mọi refresh token), sổ địa chỉ + mặc định |
| Trợ lý AI | ✅ | Tìm kiếm ngữ nghĩa, tư vấn size, phối đồ, thêm vào giỏ có xác nhận: xem `docs/ai/00-overview.md` |

**Tổng: ✅ 8 · ⚠️ 1 (VNPay chưa thử sandbox) · đã bỏ 1 (giỏ khách).** Trạng thái các màn hình Admin: mục "Trang Admin" bên dưới.

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

- **Service:** `src/server/services/cart.service.ts` — `getCart`, `addItem`, `updateQuantity` (số lượng 0 = xoá dòng), `removeItem`, `clearCart`. Mọi hàm nhận `ctx` (`{ userId }`) và không đọc cookie/headers, nên Route Handler và AI tool-calling dùng lại được.
- **Chỉ cho user đã đăng nhập:** khách không thêm/sửa/xoá được (API trả 401 `UNAUTHENTICATED`), `/cart` chuyển sang `/login?next=/cart`, icon giỏ và nút "Thêm vào giỏ hàng" dẫn khách sang đăng nhập rồi quay lại đúng trang. Không có giỏ khách (đã bỏ khỏi code và DB); trợ lý AI cũng chỉ dành cho người đã đăng nhập.
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
- **Chưa có:** tự động đối soát tiền chuyển khoản (Admin xác nhận tay đã nhận tiền ở `/admin/orders/[id]`; trước đó đơn vẫn chờ thanh toán), voucher/giảm giá, tự huỷ đơn chuyển khoản quá hạn (chỉ đơn VNPAY mới có hạn 15 phút).
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
- **`changeOrderStatus(orderId, to, actor, note)`** chuyển đơn tuần tự `PENDING → CONFIRMED → SHIPPING → DELIVERED` (không nhảy cóc, không đi lùi). Admin đổi trạng thái qua trang `/admin/orders` (xem mục "Trang Admin"), bọc bởi `adminChangeOrderStatus`.
- **Quyền:** mọi hàm của `order.service` (`listOrders`, `getOrderDetail`, `cancelOrder`, `reorder`) ràng buộc `userId` ngay trong câu truy vấn; đơn của người khác không tìm thấy (trang trả 404, kể cả với tài khoản admin), không phụ thuộc vào UI.
- **Hủy đơn:** chỉ khi `PENDING`/`CONFIRMED`; khoá dòng đơn rồi hoàn tồn kho, ghi lịch sử kèm lý do (tuỳ chọn) trong một transaction.
- **Mua lại:** thêm các biến thể còn hàng của đơn cũ vào giỏ (cắt theo tồn kho, không vượt số còn lại, bỏ dòng hết hàng/ngừng bán và báo lý do) qua `cart.service.addItemsClamped`.
- **Chạy test:** `order-history.integration.test.ts` chạy trên PostgreSQL thật (cần `npm run db:up`).

## Trang Admin

- **Vào:** đăng nhập bằng tài khoản ADMIN (xem bảng tài khoản demo) rồi mở `/admin` (menu tài khoản có mục "Trang quản trị"). Middleware chặn theo role, `layout` đọc lại DB bằng `requireAdmin()`; **mọi Server Action và route Admin còn phải tự kiểm quyền bằng `getAdminUser()`** (`src/server/auth/admin.ts`).
- **Màn hình:** Tổng quan, Đơn hàng (+ chi tiết), Tồn kho & Sản phẩm, Danh mục, Bảng size, Khách hàng (+ chi tiết) chạy thật; **Voucher** và **Cài đặt hệ thống** chỉ là giao diện minh hoạ (chưa có backend, có biểu ngữ "chưa kết nối").
- **Ảnh sản phẩm:** tải lên qua `POST /api/admin/uploads` (chỉ Admin; JPG/PNG/WebP kiểm bằng chữ ký file, tối đa 5MB và 4 ảnh/lần, tên file do server sinh), lưu ở `public/uploads/` (đã nằm trong `.gitignore`) và phục vụ qua `/uploads/<tên>`. Ảnh seed là ảnh giữ chỗ từ placehold.co.
- **Khoá tài khoản khách:** `User.status` (ACTIVE/LOCKED); tài khoản bị khoá không đăng nhập hay refresh được, phiên cũ mất hiệu lực ngay.
- **Code:** nghiệp vụ ở `src/server/services/admin-*.service.ts`; giao diện ở `src/app/(admin)/admin/` và `src/components/admin/`; quy ước dựng màn hình mới ở mục "Quy ước dựng màn hình Admin" bên dưới.
- **Test:** test Server Action Admin dùng mock (quyền, input, lỗi); test service `admin-*.integration.test.ts` cần PostgreSQL (`npm run db:up`).

### Trạng thái các màn hình Admin
| Màn hình (`/admin/…`) | Backend | Giao diện | Ghi chú |
|---|---|---|---|
| Khung + header + sidebar | ✅ quyền, khoá tài khoản | ✅ | Route group `(admin)`, chặn quyền hai lớp |
| Tổng quan `/` | ✅ `getDashboardStats` | ✅ | Nút **Duyệt** đơn chạy thật |
| Đơn hàng `orders` (+ `orders/[id]`) | ✅ | ✅ | Duyệt/Giao đi/Hoàn thành, Huỷ, xác nhận chuyển khoản. Chưa có: xuất file, đổi trả, hoàn tiền thật |
| Tồn kho & Sản phẩm `products` | ✅ | ✅ | Có tải ảnh. Thiếu backend: giá gốc, phiếu nhập, ngưỡng tồn riêng |
| Danh mục `categories` | ✅ | ✅ | Tự thiết kế (không có trong Figma) |
| Bảng size `size-charts` | ✅ | ✅ | Tự thiết kế (không có trong Figma) |
| Khách hàng `customers` (+ `customers/[id]`) | ✅ | ✅ | Tạo tài khoản, Khoá/Mở. Bỏ hạng "Tiềm năng" và xuất Excel |
| Voucher `vouchers` | ⏸ chưa có model | 🎨 tĩnh | Có biểu ngữ "chưa kết nối" |
| Cài đặt hệ thống `settings` | ⏸ chưa có bảng cấu hình/vai trò nhân viên | 🎨 tĩnh | Ô lấy từ hằng số để chỉ đọc |

**Việc Admin còn tồn:**
- Ô tìm kiếm ở header hiện chỉ chuyển sang `/admin/orders?q=`; chuông chỉ trỏ tới đơn chờ xác nhận.
- Voucher thật: model, áp mã ở thanh toán, thống kê lượt dùng (cần quyết định riêng).
- Cài đặt thật: bảng cấu hình (ngưỡng tồn kho, ngưỡng freeship đang là hằng số, thông tin cửa hàng), vai trò nhân viên (Quản lý Kho, CSKH) ảnh hưởng auth.
- Phiếu nhập và lịch sử nhập kho (`adjustStock` hiện chỉ đổi số), giá gốc/gạch chân, ngưỡng tồn riêng từng biến thể.
- Xuất Excel/xuất file, luồng đổi trả, hoàn tiền thật.
- Hạng "Tiềm năng" của khách (đã bỏ vì chưa có quy tắc).
- Chưa thử trên trình duyệt: tải ảnh thật qua modal (mới thử route bằng fetch), sửa sản phẩm `?edit=`, nút Nhập kho, ẩn/xoá sản phẩm, modal Sửa bảng size lưu thành công, đăng nhập thật bằng tài khoản vừa bị khoá.

**Quyết định mặc định cần xem lại:**
- Ngưỡng VIP **10.000.000 đ** (`src/lib/customer-tier.ts`); ngưỡng tồn thấp **10** (`src/lib/inventory.ts`).
- Doanh thu = đơn đã `PAID` hoặc COD đã giao, loại huỷ/hoàn tiền; tính theo ngày tạo đơn (schema chưa có ngày thanh toán/giao).
- Admin có thể chuyển đơn chuyển khoản sang Hoàn thành khi chưa xác nhận đã nhận tiền; mọi lỗi của `markBankTransferPaid` dùng chung mã `CANNOT_PAY`.
- Trang chủ cửa hàng hiện 4 thẻ danh mục gốc (Nam, Nữ, Unisex, Phụ kiện); slug cũ như `/categories/ao-thun` không còn.

### Quy ước dựng màn hình Admin
**Thiết kế gốc:** file Figma `IBqezuKbwghRH9iTSCpOfk` (ảnh xuất đã bỏ khỏi repo ngày 2026-11-14, xem lại trong Figma hoặc lịch sử git). Chỉ lấy **bố cục, màu, cỡ chữ**; dữ liệu mẫu trong thiết kế là đồ thể thao ("SPORT BRAND"), nội dung thật lấy từ DB và tên cửa hàng từ `SITE_NAME`. Màn **Danh mục** và **Bảng size** không có trong Figma: dựng bằng đúng các bộ phận dưới đây, không tạo kiểu mới. Màu, cỡ chữ, bo góc dùng token trong `src/app/globals.css` (`bg-ink`, `text-brand`, `bg-brand-soft`, `text-label`, `rounded-3xl`…), không viết mã màu cứng.

**Bộ phận dùng chung** (dùng lại, đừng viết lại; thiếu gì thì bổ sung vào bộ chung):

| Cần | Dùng | File |
|---|---|---|
| Hàng 4 thẻ số liệu | `StatGrid` + `StatCard` (+ `formatDelta`) | `components/admin/dashboard/stat-card.tsx` |
| Tiêu đề khối danh sách | `ListSection` | `components/admin/list/admin-table.tsx` |
| Ô tìm kiếm + nút lọc + nút hành động | `ListToolbar` (state trong URL `?q=&status=`) | `components/admin/list/list-toolbar.tsx` |
| Thẻ chứa bảng | `ListCard` | `admin-table.tsx` |
| Bảng | `AdminTable` + `AdminTr` (ô viết thẳng `<td>`), `AdminEmpty` | `admin-table.tsx` |
| Phân trang | `AdminPagination` (nhận `searchParams` thô) | `components/admin/list/admin-pagination.tsx` |
| Pill trạng thái | `StatusPill tone=success\|warning\|info\|danger\|neutral\|dark` | `components/admin/status-pill.tsx` |
| Modal | `AdminModal` + `ModalActions` (nút Lưu nối form qua `formId`) | `components/admin/modal/admin-modal.tsx` |
| Ô form | `FormField` (nhãn, dấu *, gợi ý, lỗi) + `Input`/`Select`/`Textarea`/`Switch` trong `components/ui` | `components/admin/modal/form-field.tsx` |
| Xác nhận thao tác nguy hiểm | `ConfirmDialog` | `components/admin/modal/confirm-dialog.tsx` |
| Chạy Server Action + toast + làm mới | `useAdminAction()` | `components/admin/use-admin-action.ts` |
| URL/phân trang (hàm thuần) | `buildListHref`, `pageWindow`, `pageRange` | `lib/admin-list.ts` |
| Kiểu kết quả action | `AdminActionResult` | `lib/admin-action.ts` |
| Nhãn/màu trạng thái đơn | `ADMIN_ORDER_STATUS_LABEL`, `ADMIN_ORDER_STATUS_TONE` | `components/admin/admin-nav.ts` |

Mẫu ghép đầy đủ: trang Tổng quan (`src/app/(admin)/admin/page.tsx`, `components/admin/dashboard/pending-orders-card.tsx`).

**Cấu trúc một màn hình:**
```
src/app/(admin)/admin/<màn>/page.tsx        Server Component: đọc searchParams, gọi service, ghép bộ phận dùng chung
src/components/admin/<màn>/*.tsx            Component riêng của màn (client chỉ khi cần tương tác: modal, nút hành động)
src/app/actions/admin-<màn>.ts              Server Action của màn
src/lib/validators/admin-<màn>.ts           Zod (đã có cho đơn/catalog/khách hàng); chỉ thêm nếu thiếu
```
- `page.tsx` không tự gọi `requireAdmin` ngoài layout đã làm; nhưng mọi **Server Action và route handler** phải tự kiểm quyền (bên dưới).
- Bộ lọc, trang, tìm kiếm nằm trong URL. Trang truyền `searchParams` thô cho hàm `list...` của service (đã tự validate và rơi về mặc định khi sai).
- Tiêu đề trang, breadcrumb và sidebar lấy từ `components/admin/admin-nav.ts`.
- Service chỉ nhận `{ userId }` của Admin và dữ liệu đã parse; `Date` phải chuyển sang chuỗi/số khi truyền xuống component client.

**Server Action Admin (bắt buộc):**
```ts
"use server"
export async function xAction(input: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()                       // src/server/auth/admin.ts
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }
  // 1) validate input bằng Zod  2) gọi service với { userId: admin.id }  3) bắt lỗi nghiệp vụ → { ok:false, message }
  revalidatePath("/admin", "layout")                       // hoặc đường dẫn cụ thể
  return { ok: true, message: "…" }
}
```
- Bắt đúng lớp lỗi của service (`OrderError`, `AdminCatalogError`, `AdminCustomerError`…) và trả `message` tiếng Việt; lỗi lạ thì ném lại.
- **Test quyền cho từng action** theo mẫu `src/app/actions/admin-orders.test.ts` (mock `@/server/auth/admin` và service): khách/chưa đăng nhập bị từ chối và service **không** được gọi; Admin hợp lệ truyền đúng `{ userId }`; input sai không gọi service.
- Giao diện ẩn nút theo trạng thái chỉ để tiện dùng; server (service) luôn là chốt cuối.

## Nguyên tắc kiến trúc đã kiểm

| Nguyên tắc | Kết quả |
|---|---|
| Logic nghiệp vụ trong `src/server/services/*`; route/action chỉ validate rồi gọi service | ✅ Đã sửa một vi phạm: route `vnpay/return` từng truy vấn `db.order` trực tiếp, nay dùng `findOrderIdByCode()` |
| Client component không import `src/server/` | ✅ Không có file `"use client"` nào import `@/server/*`; mọi service và `db` có `import "server-only"` |
| Service giỏ/đơn nhận context thuần, không phụ thuộc cookie hay request | ✅ Cầu nối request → context nằm ở `server/cart/context.ts` và `server/auth/session.ts` |
| Bộ lọc sản phẩm hoàn toàn trong URL, một schema chung | ✅ `productFilterSchema` dùng ở `catalog.service` và `use-product-filters` |
| Trừ kho trong `prisma.$transaction`, chống oversell | ✅ `createOrder` dùng `updateMany({ stock >= qty })` nguyên tử, thứ tự id cố định tránh deadlock; huỷ đơn hoàn kho có khoá `FOR UPDATE`; có test tích hợp đồng thời |
| Service dữ liệu người dùng kiểm quyền sở hữu ở server | ✅ Địa chỉ, đơn, giỏ đều ràng buộc `userId`; người khác nhận NOT_FOUND |
| Response không lộ `passwordHash`, token, dữ liệu nhạy cảm | ✅ `PublicUser` chỉ gồm id/email/name/phone/role; refresh token chỉ lưu hash SHA-256; IPN không log tham số giao dịch |

## Nợ kỹ thuật

1. **Rollup dùng bản WASM** (`@rollup/wasm-node`, chậm hơn bản native một chút) vì Windows Application Control chặn file native. Máy/CI không bị chặn có thể gỡ alias và `overrides` trong `package.json`.
2. **Cảnh báo build:** `middleware.ts` import `server/auth/jwt.ts` (`jose`), Next cảnh báo `DecompressionStream` không hỗ trợ Edge Runtime. Build vẫn qua vì middleware chỉ verify chữ ký; nên tách module verify chỉ dùng `jose/jwt/verify` hoặc kiểm tra trên môi trường edge thật.
3. **Rate limit đăng nhập dùng `Map` trong bộ nhớ** (`server/auth/rate-limit.ts`): mất khi khởi động lại và không dùng chung giữa nhiều instance. Redis đã có (limiter của AI dùng); chuyển sang Redis (INCR + EXPIRE) trước khi chạy nhiều instance.
4. **Đơn chuyển khoản không có hạn thanh toán:** chỉ đơn VNPay được cron huỷ khi quá hạn, nên đơn chuyển khoản không trả tiền giữ tồn kho cho đến khi khách tự huỷ. Đã chốt: Admin xác nhận tay đã nhận tiền; hạn tự huỷ làm sau.
5. **Huỷ đơn đã thanh toán chỉ đổi `paymentStatus` sang `REFUNDED`**, chưa hoàn tiền thật (VNPay refund API hoặc chuyển khoản lại); IPN thành công cho đơn đã huỷ chỉ `console.warn`. Cần quy trình hoàn tiền thủ công cho Admin.

## Việc nên làm trước khi lên production

- Đăng ký sandbox VNPay, điền `VNP_TMN_CODE`/`VNP_HASH_SECRET`, thử trọn luồng thanh toán + IPN (IPN cần URL công khai, ví dụ tunnel).
- Đặt `JWT_SECRET` mạnh, `CRON_SECRET`, thông tin ngân hàng thật (`BANK_*` hiện là dữ liệu mẫu) và lịch gọi `/api/cron/expire-orders`.
- Chạy toàn bộ test (kể cả test tích hợp cần PostgreSQL thật) trong CI.
- Chuyển rate limit đăng nhập sang Redis; đánh giá cảnh báo Edge của `jose`.
- Cookie `secure` và HTTPS, kiểm tra header bảo mật, thêm hoàn tiền thủ công và hạn thanh toán cho chuyển khoản.
- Đổi mật khẩu 2 tài khoản seed trước khi dùng thật (`prisma/seed-data/users.ts`), không seed trên production.
