# Trạng thái phần Customer (điểm dừng trước Admin)

Ngày kiểm kê: 2026-11-10 (số liệu dữ liệu cập nhật 2026-11-12). Dựa trên quét code thực tế, không dựa vào trí nhớ. Trạng thái trang Admin: `docs/TODO.md` mục A.

## 1. Bảng trạng thái tính năng

| Tính năng | Trạng thái | File chính | Ghi chú |
|---|---|---|---|
| Auth (đăng ký/đăng nhập/đăng xuất/refresh/đổi mật khẩu) | ✅ | `server/services/auth.service.ts`, `server/auth/{jwt,session,rate-limit}.ts`, `middleware.ts`, `app/actions/auth.ts`, `app/api/auth/*` | JWT access + refresh token xoay vòng (lưu hash, có familyId), bcrypt, chống dò email bằng hash giả. Rate-limit login đang là `Map` trong bộ nhớ (xem nợ kỹ thuật). |
| Catalog / Bộ lọc | ✅ | `server/services/catalog.service.ts`, `lib/validators/product-filter.ts`, `components/product/*`, `hooks/use-product-filters.ts`, `app/(shop)/products`, `categories/[slug]` | Bộ lọc nằm trong URL, một Zod schema dùng chung cho server (`catalog.service`) và client (`use-product-filters`, `product-listing`). Có test cho schema. |
| Chi tiết sản phẩm | ✅ | `app/(shop)/products/[slug]/page.tsx`, `components/product/product-detail-*.tsx`, `product-gallery`, `size-guide-dialog`, `lib/product-variants.ts` | Chọn size/màu, bảng size, sản phẩm liên quan, chăm sóc. Có test cho logic biến thể. |
| Giỏ hàng (user đăng nhập) | ✅ | `server/services/cart.service.ts`, `server/cart/{context,http}.ts`, `app/api/cart/**`, `components/cart/*`, `hooks/use-cart.ts` | Service nhận `CartContext`, kiểm tồn kho, cảnh báo đổi giá/hết hàng, có test. |
| Giỏ khách (guest) | — đã bỏ | `cart.service.ts`, migration `drop_cart_guest_session` | **Quyết định 2026-11-10:** giỏ hàng và trợ lý AI đều cần tài khoản. Đã xoá nhánh `sessionId` và `mergeGuestCart` khỏi `cart.service` (kèm test), bỏ cột `Cart.sessionId` và ràng buộc CHECK bằng migration; `Cart.userId` bắt buộc trở lại. |
| Checkout | ✅ | `app/(shop)/checkout/page.tsx`, `components/checkout/checkout-form.tsx`, `app/actions/checkout.ts`, `server/services/order.service.ts`, `lib/validators/checkout.ts` | Địa chỉ đã lưu hoặc mới, COD / chuyển khoản VietQR / VNPay, ghi chú. Trừ kho nguyên tử trong transaction, snapshot giá/tên/size/màu vào OrderItem. |
| VNPay | ⚠️ | `server/services/payment.service.ts`, `server/payment/vnpay*.ts`, `app/api/payment/vnpay/{pay,return,ipn}`, `api/cron/expire-orders` | Code hoàn chỉnh: ký HMAC, IPN idempotent, kiểm số tiền, Return chỉ hiển thị, cron huỷ đơn quá hạn + hoàn kho, có test. Nhưng `VNP_TMN_CODE`/`VNP_HASH_SECRET` trong `.env` đang trống nên CHƯA thử với sandbox thật; phương thức bị khoá khi thiếu cấu hình. |
| Lịch sử đơn hàng | ✅ | `app/(shop)/account/orders/**`, `components/orders/*`, `order.service.ts` (`listOrders`, `getOrderDetail`, `cancelOrder`, `reorder`), `lib/order-timeline.ts` | Lọc theo trạng thái/từ khoá, phân trang, timeline, huỷ đơn (hoàn kho), mua lại. Mọi truy vấn ràng buộc `userId`. |
| Trợ lý AI (khung chat + tư vấn size) | ⚠️ | `components/assistant/*`, `server/ai/advisor/*`, `app/actions/size-advice.ts`, `/dev/assistant` | Khung chat giao diện và tư vấn size chạy thật (tính bằng code, không LLM, cần đăng nhập; ẩn trừ khi `AI_ENABLED=true`). Chat thật, tìm kiếm ngữ nghĩa, tool calling **CHƯA CÓ**: xem `docs/TODO.md` mục B. |
| Tài khoản / Địa chỉ | ✅ | `app/(shop)/account/(panel)/**`, `components/account/*`, `server/services/address.service.ts`, `app/actions/account.ts` | Hồ sơ, đổi mật khẩu (thu hồi mọi refresh token), sổ địa chỉ CRUD + mặc định. |

**Tổng (cập nhật 2026-11-12): ✅ 7 · ⚠️ 2 (VNPay chưa thử sandbox thật; trợ lý AI mới có khung chat và tư vấn size) · ❌ 0**

## 2. Kết quả lint / typecheck / test / build

| Lệnh | Kết quả |
|---|---|
| `npm run lint` | ✅ sạch, không lỗi/cảnh báo |
| `npm run typecheck` | ✅ sạch |
| `npm test` | ✅ 35 file / 345 test pass (đo lại 2026-11-12, gồm phần Admin và AI; lúc kiểm kê đầu 11 file / 109 test, chạy 3 lần liên tiếp, gồm test tích hợp trên Postgres thật và test chống oversell). Ban đầu Windows Application Control chặn `rollup-win32-x64-msvc.node`; đã chuyển rollup sang `@rollup/wasm-node` (devDependency alias `rollup` + `overrides` trong `package.json`). Hai lỗi thật được sửa: (1) `order-timeline.test.ts` dùng `toMatchObject` với key `undefined` mà Zod 4 bỏ qua → đổi sang `toEqual`; (2) các file test tích hợp chạy song song dùng chung bộ đếm `OrderSequence` nên thỉnh thoảng trùng mã đơn → `fileParallelism: false` trong `vitest.config.ts`. |
| `npm run build` | ✅ biên dịch thành công (đo lại 2026-11-12: thêm `/dev/assistant`, các trang `/admin/**`, `/api/admin/uploads`, `/uploads/[name]`; trang Admin render theo request). Có 1 cảnh báo, xem nợ kỹ thuật (jose trong middleware). |

## 3. Kiểm tra nguyên tắc kiến trúc

| Nguyên tắc | Kết quả |
|---|---|
| Logic nghiệp vụ trong `src/server/services/*`; route/action chỉ validate + gọi service | ✅ Các action/route đều validate Zod rồi gọi service. 1 vi phạm đã sửa (bên dưới). |
| Client component không import `src/server/` | ✅ Không có file `"use client"` nào import `@/server/*`. `components/account/account-sidebar.tsx:5` chỉ `import type` từ service và là server component. Mọi service/`db` có `import "server-only"`. |
| Service giỏ/đơn nhận context, không phụ thuộc cookie/request | ✅ `cart.service` nhận `CartContext`, `order.service` nhận `{id}`/`userId`. Cầu nối request → context nằm riêng ở `server/cart/context.ts` và `server/auth/session.ts`. |
| Bộ lọc sản phẩm hoàn toàn trong URL, một Zod schema chung | ✅ `productFilterSchema` dùng ở `catalog.service.ts` (`listProducts`) và `use-product-filters.ts`/`product-listing.tsx`. Chỉ có trạng thái "pending" tạm thời trong Zustand (`stores/product-filter-pending.ts`) cho UI loading. |
| Trừ kho trong `prisma.$transaction`, chống oversell | ✅ `order.service.ts` (`createOrder`): `updateMany({stock >= qty}, decrement)` nguyên tử, thứ tự id cố định tránh deadlock, thiếu hàng thì rollback cả đơn. Huỷ đơn hoàn kho trong transaction, có khoá `FOR UPDATE` (`cancelOrderCore`). Có test tích hợp đồng thời (`order.service.integration.test.ts:63-90`), đã chạy pass. |
| Service đọc/ghi dữ liệu user kiểm tra quyền sở hữu ở server | ✅ Address: mọi hàm `where {id, userId}`. Order: `getOrder`, `getOrderDetail`, `listOrders`, `cancelOrder`, `reorder`, `getVnpayPayUrl` đều lọc `userId`; người khác nhận NOT_FOUND. Cart: theo `ownerWhere(ctx)`. |
| Response có lộ passwordHash/token/dữ liệu nhạy cảm | ✅ Không lộ. `PublicUser` chỉ gồm id/email/name/phone/role; refresh token lưu dạng hash SHA-256 và chỉ đi qua cookie; lịch sử đơn chỉ lộ tên nhân viên khi actor là ADMIN; IPN không log tham số giao dịch. |

### Vi phạm
- **Đã sửa:** `src/app/api/payment/vnpay/return/route.ts` truy vấn `db.order.findUnique` trực tiếp trong route handler. Đã chuyển sang `findOrderIdByCode()` trong `payment.service.ts`, route không còn import `@/server/db`. Lint, typecheck, build đều pass sau khi sửa.
- **Còn lại:** không có vi phạm nào khác được tìm thấy.

## 4. Dữ liệu (migrate + seed trên DB sạch)

Đã dựng container Postgres mới (volume mới), chạy `prisma migrate deploy` (lúc kiểm kê: 7 migration; nay có 9, thêm `drop_cart_guest_session` và `user_status`) rồi `npm run db:seed` (thành công, tái lập được).

| Bảng | Số lượng |
|---|---|
| Product | 125 (45 unisex / 34 nam / 46 nữ) |
| ProductVariant | 1113 (84 hết hàng) |
| Category | 20 (3 gốc `nam`, `nu`, `unisex` + 16 lá theo giới tính, + `phu-kien` dùng chung ở cấp gốc) |
| SizeChart | 83 (mỗi lá quần áo một bảng; áo thun unisex có thêm bảng riêng Urban Ghost) |
| ProductImage | 378 (ảnh giữ chỗ placehold.co) |
| User / Address | 2 / 1 |

Sẵn sàng để sinh embedding:
- Description > 200 ký tự: **125/125** (min 322, trung bình 389).
- Đủ `style`, `occasion`, `season`, `tags` (không rỗng): **125/125**.
- 13 sản phẩm phụ kiện không có bảng size (hợp lý, không phải lỗi).

## 5. Nợ kỹ thuật

1. **Rollup đang là bản WASM** (chậm hơn bản native một chút). Trên máy/CI không bị chặn có thể gỡ alias và `overrides` để dùng lại bản native.
2. **Cảnh báo build**: `middleware.ts` import `server/auth/jwt.ts` (thư viện `jose`), Next cảnh báo `DecompressionStream` không hỗ trợ Edge Runtime. Build vẫn pass vì middleware chỉ verify chữ ký; nên tách module verify chỉ dùng `jose/jwt/verify` hoặc kiểm tra thực tế trên môi trường edge/deploy.
3. **Rate-limit login dùng `Map` trong bộ nhớ** (`server/auth/rate-limit.ts`): mất khi restart và không dùng chung giữa nhiều instance. Redis đã có trong docker-compose nhưng chưa được dùng. Đổi sang Redis (INCR + EXPIRE) trước khi deploy nhiều instance.
4. **Đơn chuyển khoản (BANK_TRANSFER) không có hạn thanh toán**: chỉ đơn VNPay được cron huỷ khi quá hạn, nên đơn chuyển khoản không trả tiền sẽ giữ tồn kho vô thời hạn cho đến khi khách tự huỷ.
5. **Huỷ đơn đã thanh toán chỉ đổi `paymentStatus` sang REFUNDED**, chưa có hoàn tiền thật (VNPay refund API/chuyển khoản lại); IPN thành công cho đơn đã huỷ chỉ `console.warn`. Cần quy trình hoàn tiền thủ công/Admin.
6. ~~`changeOrderStatus` chưa có UI/route gọi~~ — **đã xử lý (2026-11-12):** Admin đổi trạng thái, huỷ đơn và xác nhận chuyển khoản ở `/admin/orders` (`adminChangeOrderStatus`, `adminCancelOrder`, `markBankTransferPaid`). Đơn chuyển khoản vẫn chưa có hạn tự huỷ (mục 4) và chưa có hoàn tiền thật (mục 5).

## 6. Việc nên làm trước khi lên production

- Đăng ký sandbox VNPay, điền `VNP_TMN_CODE`/`VNP_HASH_SECRET`, thử trọn luồng thanh toán + IPN (cần URL công khai cho IPN, ví dụ tunnel).
- Đặt `JWT_SECRET` mạnh, `CRON_SECRET`, thông tin ngân hàng thật (`BANK_*` hiện là dữ liệu mẫu) và lịch gọi `/api/cron/expire-orders`.
- Chạy bộ test (kể cả test tích hợp cần Postgres thật) trong CI.
- Rate-limit chuyển sang Redis; đánh giá cảnh báo Edge của `jose`.
- Cookie `secure` và HTTPS, kiểm tra header bảo mật, thêm hoàn tiền thủ công, hạn thanh toán cho chuyển khoản.
- Đổi mật khẩu 2 tài khoản seed trước khi dùng thật (xem `prisma/seed-data/users.ts`), không seed trên production.

## Quyết định cần bạn đưa ra

1. ~~Giỏ khách~~ **Đã chốt:** bỏ giỏ khách; giỏ hàng và trợ lý AI cần tài khoản.
2. ~~Đơn chuyển khoản~~ **Đã chốt (2026-11-12):** Admin xác nhận tay đã nhận tiền; chưa có hạn tự huỷ như VNPay (làm sau, xem mục 5 #4).
