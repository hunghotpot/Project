# TODO (cập nhật 2026-11-12)

Đọc trước khi bắt đầu: `CLAUDE.md`, `.claude/rules/*.md`, `docs/architecture.md`, `docs/status-customer.md`, `docs/ai/00-overview.md`; làm Admin thì đọc thêm `docs/admin-ui.md`.
Thứ tự tổng thể: **A. Admin → B. AI (hạ tầng, rồi từng tính năng) → C. tồn đọng cửa hàng.** Việc commit/push do bạn tự quyết nên không liệt kê.
Ký hiệu: ✅ xong · 🔄 đang làm · ⬜ chưa làm · ⏸ chờ quyết định/backend · 🎨 chỉ dựng giao diện tĩnh (chưa có backend).

---

## A. Trang Admin

### A1. Tiến độ từng màn hình (nhìn nhanh)
| Màn hình (đường dẫn `/admin/…`) | Figma | Backend (service) | Giao diện | Ghi chú |
|---|---|---|---|---|
| Khung + header + sidebar | ✅ | ✅ quyền, khoá tài khoản | ✅ | Route group `(admin)`, chặn quyền hai lớp |
| Tổng quan `/` | ✅ | ✅ `getDashboardStats` | ✅ | Nút **Duyệt** đơn chạy thật |
| Đơn hàng `orders` (+ `orders/[id]`) | ✅ | ✅ | ✅ | Chạy thật: Duyệt/Giao đi/Hoàn thành, Huỷ, xác nhận chuyển khoản. Chưa có: Xuất file, Đổi trả, hoàn tiền thật |
| Tồn kho & Sản phẩm `products` | ✅ + modal | ✅ | ✅ | Có tải ảnh. Thiếu backend: giá gốc, Phiếu nhập, ngưỡng tồn riêng |
| Danh mục `categories` | tự thiết kế | ✅ | ✅ | Không có trong Figma |
| Bảng size `size-charts` | tự thiết kế | ✅ | ✅ | Không có trong Figma |
| Khách hàng `customers` (+ `customers/[id]`) | ✅ + modal | ✅ | ✅ | Chạy thật: tạo tài khoản, Khoá/Mở. Bỏ: hạng "Tiềm năng", Xuất Excel |
| Voucher `vouchers` | ✅ + modal | ⏸ chưa có model | 🎨 ✅ | UI tĩnh, có biểu ngữ "chưa kết nối" |
| Cài đặt hệ thống `settings` | ✅ | ⏸ chưa có bảng cấu hình/role nhân viên | 🎨 ✅ | UI tĩnh, ô lấy từ hằng số để chỉ đọc |

### A2. Đã xong ✅
- [x] Chốt: phạm vi (đủ 6 mô-đun theo Figma, nối backend nếu có, còn lại UI tĩnh), ảnh lưu `public/uploads`, **có** khoá tài khoản khách, đơn chuyển khoản do Admin xác nhận tay (không hạn tự huỷ), hạng VIP tính theo tổng chi tiêu, modal "Thêm khách hàng" = form tạo tài khoản thật, dựng thêm màn Danh mục và Bảng size.
- [x] Figma Admin: file `IBqezuKbwghRH9iTSCpOfk`, node `35:2` (Tổng quan `37:3`, Khách hàng `39:142`, Đơn hàng `40:319`, Kho `43:672`, Voucher `45:849`, Hệ thống `45:1028`, modal Thêm TKKH `47:1326`, Thêm Voucher `47:1380`, Thêm Sản phẩm `47:1451`). Đã xuất 9 ảnh vào `docs/design/admin/` (không cần Figma MCP; gói Starter đã hết lượt).
- [x] Dữ liệu: cây danh mục Nam / Nữ / Unisex + Phụ kiện (16 lá), 5 sản phẩm nam dự tiệc mùa hè, bảng size 83 dòng (số đo bảng nữ là **ước lượng**).
- [x] Backend: service đơn hàng, sản phẩm/tồn kho, danh mục, bảng size, khách hàng, tổng quan; hook rỗng `syncProductEmbedding`; `User.status` (khoá/mở, chặn đăng nhập và refresh). Test tích hợp đều qua.
- [x] Khung Admin + trang Tổng quan (đã kiểm trình duyệt desktop và mobile).
- [x] Bộ phận giao diện dùng chung (bảng, lọc, phân trang, pill, modal, ô form, hộp xác nhận, hook chạy action) + `docs/admin-ui.md` + 9 ảnh Figma trong repo.

### A3. 5 việc song song (mỗi việc một subagent, model Sonnet): XONG 2026-11-12
Mỗi việc đọc `docs/admin-ui.md`, chỉ sửa file thuộc phần mình, không bật server/trình duyệt, không chạy test tích hợp. Người điều phối đã kiểm trình duyệt và chạy test tuần tự (xem A4).
- [x] **Đơn hàng** (`03-don-hang.webp`): bảng + lọc trạng thái + tìm kiếm + phân trang; nút theo trạng thái (Duyệt → Giao đi → Hoàn thành), Huỷ (có xác nhận), **Xác nhận đã nhận chuyển khoản** (chỉ đơn `BANK_TRANSFER` chưa trả tiền, chưa huỷ); trang/modal chi tiết đơn. File: `orders/`, `components/admin/orders/`, `actions/admin-orders.ts` (đã có `approveOrderAction`), test quyền.
- [x] **Tồn kho & Sản phẩm** (`04-…`, `07-modal-them-san-pham.webp`): bảng kèm chi tiết màu/size/tồn, lọc theo danh mục, modal thêm/sửa sản phẩm (biến thể, tags, ẩn/hiện, giá), nút **Nhập** kho (`adjustStock`), tải ảnh vào `public/uploads` (route upload chỉ Admin; nhận jpg/png/webp, giới hạn dung lượng, tối đa 4 ảnh, tên file do server sinh). Việc rủi ro nhất: tôi sẽ đọc kỹ route upload.
- [x] **Khách hàng** (`02-…`, `09-modal-them-khach-hang.webp`): bảng, lọc Tất cả/VIP/Thành viên/Bị khoá, **Khoá/Mở** (có xác nhận), modal tạo tài khoản (tên, email, SĐT, mật khẩu tạm), xem chi tiết khách.
- [x] **Danh mục + Bảng size** (tự thiết kế): cây danh mục (thêm/sửa/xoá, lỗi rõ khi còn con/sản phẩm); bảng size theo danh mục (sửa cả bảng, kiểm số đo hợp lý).
- [x] **Voucher + Cài đặt hệ thống** (`05-…`, `08-…`, `06-…`) 🎨: dựng đủ UI tĩnh, đánh dấu rõ "chưa kết nối", không gọi backend.

### A4. Kiểm sau khi gộp (đã làm 2026-11-12)
- [x] lint, typecheck, build sạch; 35 file / 345 test qua (kể cả tích hợp, chạy tuần tự).
- [x] Kiểm trình duyệt desktop 1440 px: Tổng quan, Đơn hàng (Duyệt, Huỷ có lý do, xác nhận chuyển khoản, lịch sử), Sản phẩm (bảng, modal thêm), Danh mục (xoá danh mục còn con báo lỗi đúng), Bảng size (số đo sai bị từ chối), Khách hàng (email trùng báo ở ô email, tạo mới, Khoá, Mở), Voucher, Cài đặt.
- [x] Mobile 375 px: không màn nào tràn ngang (đã sửa Tổng quan).
- [x] Tài khoản **khách**: vào `/admin` bị chuyển về trang chủ; `POST /api/admin/uploads` trả 403; test action từ chối khách ở mọi action Admin.
- [x] Rà route tải ảnh: kiểm quyền trước, magic bytes, tên do server sinh, ghi không đè; đã thử file giả đuôi .jpg (415), quá 5MB (413), 5 ảnh (400), chưa đăng nhập (403), tên lạ (404). Thêm header `nosniff` và CSP cho `/uploads` ở `next.config.ts`.
- [x] Thêm test tài khoản bị khoá cho `auth.service` (đăng nhập, refresh, phiên cũ, startSession).
- [ ] Chưa thử trên trình duyệt: luồng tải ảnh thật qua modal (chỉ thử route bằng fetch), sửa sản phẩm `?edit=`, nút Nhập kho, ẩn/xoá sản phẩm, modal Sửa bảng size lưu thành công, đăng nhập thật bằng tài khoản vừa bị khoá. Ảnh seed đã đổi sang placehold.co (picsum.photos hay lỗi), chỉ là ảnh giữ chỗ ghi tên sản phẩm.
- [ ] (Tuỳ bạn) chạy `/code-review` trên toàn bộ phần Admin trước khi commit.

### A5. Việc Admin còn tồn (không chặn các việc trên)
- [ ] Ô tìm kiếm ở header hiện chỉ chuyển sang `/admin/orders?q=`; chuông chỉ trỏ tới đơn chờ xác nhận.
- [ ] Đổi mật khẩu 2 tài khoản seed trước khi dùng thật; không seed trên production.
- [ ] Voucher thật: model, áp mã ở thanh toán, thống kê lượt dùng (cần quyết định riêng).
- [ ] Cài đặt thật: bảng cấu hình (ngưỡng tồn kho, ngưỡng freeship đang là hằng số, thông tin cửa hàng), vai trò nhân viên (Quản lý Kho, CSKH) ảnh hưởng auth.
- [ ] Phiếu nhập/lịch sử nhập kho (`adjustStock` hiện chỉ đổi số), giá gốc/gạch chân, ngưỡng tồn riêng từng biến thể.
- [ ] Xuất Excel/Xuất file, luồng Đổi trả, hoàn tiền thật.
- [ ] Hạng "Tiềm năng" của khách (đã bỏ vì chưa có quy tắc).

### A6. Quyết định mặc định cần bạn xem lại
- Ngưỡng VIP **10.000.000 đ** (`src/lib/customer-tier.ts`); ngưỡng tồn thấp **10** (`src/lib/inventory.ts`).
- Doanh thu = đơn đã `PAID` hoặc COD đã giao, loại huỷ/hoàn tiền; tính theo ngày tạo đơn (schema chưa có ngày thanh toán/giao).
- Admin có thể chuyển đơn chuyển khoản sang Hoàn thành khi chưa xác nhận đã nhận tiền; mọi lỗi của `markBankTransferPaid` dùng chung mã `CANNOT_PAY`.
- Trang chủ cửa hàng hiện 4 thẻ danh mục gốc (Nam, Nữ, Unisex, Phụ kiện); slug cũ như `/categories/ao-thun` không còn.
- Dữ liệu mẫu Figma là đồ thể thao ("SPORT BRAND"); nội dung thật lấy từ DB, tên lấy từ `SITE_NAME`.

---

## B. Tính năng AI

### B0. Hiện trạng
| Phần | Trạng thái | Chi tiết |
|---|---|---|
| Tài liệu thiết kế | ✅ | `docs/architecture.md`, `docs/ai/00–07`, `.claude/rules/ai.md` |
| Khung chat | ✅ giao diện | Nút tròn góc phải dưới + ô chat (mobile toàn màn hình), thẻ size/nhập số đo/bộ đồ/xác nhận, `/dev/assistant`; ẩn trừ khi `AI_ENABLED=true`; cần đăng nhập |
| Tư vấn size | ✅ chạy thật | `advisor/size.ts` (19 test) + `size.service.ts` + server action; bảng size, tồn kho, "Chọn size", "Xem bảng size" |
| Chuẩn bị dữ liệu | ✅ gần đủ | `occasion` 23 giá trị chuẩn (có test), lọc `season`, `includeUnisex`, bỏ giỏ khách, cây danh mục Nam/Nữ/Unisex + bảng size theo danh mục, 5 sản phẩm nam dự tiệc mùa hè. Còn: mô tả sản phẩm lặp khuôn, tag ngữ cảnh chuẩn (xem `docs/ai/01` mục 5) |
| Hạ tầng AI | ❌ | Chưa có `core/env.ts`, `models.ts`, `embeddings.ts`, thư viện AI, API key |
| Embedding | ❌ | Chưa có `ProductEmbedding`, `ai:embed`. Điểm móc `syncProductEmbedding` đã có nhưng thân hàm rỗng (`product-hooks.ts`, Admin gọi sau mỗi thay đổi sản phẩm/tồn kho) |
| Semantic Search | ❌ | Chưa có `search/`, chưa có tham số `onlyIds` cho `listProducts`, chưa có từ điển đồng nghĩa |
| Chat thật | ❌ | Chưa có `/api/ai/chat`, stream, `use-assistant`; câu hỏi ngoài tư vấn size nhận "chưa kết nối" |
| Tool Calling | ❌ | Chưa có tool nào, `uiActionSchema`, `/api/ai/confirm`, `getOrderByCode`, `toToolError` |
| Kho kiến thức, Mix & Match | ❌ | Chưa có `KnowledgeChunk`, `outfit.ts`, nội dung kiến thức |
| Guardrails | ❌ | Chưa có limiter tổng quát (Redis), ngân sách token, log, `redactForPrompt` |
| Đánh giá | ❌ | Chưa có `src/test/ai/*`, `ai:eval`, bảng kết quả |
| Chất lượng phần đã làm | ⚠️ | `size.service` chưa có test tích hợp; ngưỡng thuật toán size là heuristic chưa hiệu chỉnh; chưa kiểm bàn phím ảo/vùng an toàn iPhone cho ô chat |

### B1. Thứ tự làm (kèm phụ thuộc)
1. [ ] **Chốt quyết định bước 4** (có thể làm song song với Admin; cần xong trước mục 2): chọn LLM chính và model rẻ cho trích bộ lọc; model embedding (hỗ trợ tiếng Việt) và **số chiều** (đề xuất 1024–1536, đổi sau phải embed lại); ngân sách token và số yêu cầu/phút; lấy API key, đặt hạn mức chi tiêu. Thử nhanh 2 model trên 10 truy vấn (`docs/ai/02`) và 5 ca size (`docs/ai/03`).
2. [ ] **Hạ tầng AI** (`src/server/ai/core/`): `env.ts` (đọc `AI_*` bằng Zod, thiếu thì tự tắt), `models.ts`, `embeddings.ts`; cài gói AI SDK và provider đã chọn.
3. [ ] **Embedding**: migration `ProductEmbedding` + index HNSW, `search/product-document.ts`, `search/sync-embeddings.ts`, `npm run ai:embed` (idempotent theo `contentHash`); cắm `syncProductEmbedding` vào dịch vụ sản phẩm của Admin (hook rỗng đã có, xem mục A).
4. [ ] **Semantic Search**: `listProducts` nhận `onlyIds`/giữ thứ tự, `src/lib/ai/vi-synonyms.ts`, `search/intent.ts`, `search/search.service.ts`; đạt ≥ 12/15 truy vấn mẫu, có fallback từ khoá.
5. [ ] **Chat thật, bản tối thiểu an toàn**: `/api/ai/chat` (bắt buộc đăng nhập), `chat/handler.ts`, `prompts.ts`, hook `use-assistant`; kèm guardrails tối thiểu **ngay khi mở route**: limiter Redis theo user, trần token, timeout + fallback, `redactForPrompt`, `core/errors.ts` (`toToolError`), `getOrderByCode`.
6. [ ] **Tool đọc/UI**: `searchProducts`, `applyFilters`, `getProductDetail`, `getSizeRecommendation` (tái dùng `size.service`), `viewCart`, `getOrderStatus`, `openCart`, `navigate`; `uiActionSchema` (whitelist).
7. [ ] **Tool ghi**: `addToCart` + `POST /api/ai/confirm` (xác nhận hai pha, dùng một lần, hết hạn 5 phút); test không có đường ghi giỏ nào bỏ qua xác nhận.
8. [ ] **Kho kiến thức và Mix & Match**: soạn nội dung tiếng Việt (quy tắc phối đồ 30–50, chọn size 8–12, chăm sóc chất liệu 10–15, chính sách 5–10, từ điển lóng 50–100), `KnowledgeChunk` + embedding, `advisor/knowledge.service.ts`, `advisor/outfit.ts`. Phần soạn nội dung có thể bắt đầu sớm, song song với Admin.
9. [ ] **Guardrails đầy đủ + nhật ký**: log hội thoại mức 0/1/2, circuit breaker, bộ tấn công (prompt injection…), checklist `docs/ai/05`.
10. [ ] **Đánh giá**: `src/test/ai/*`, `npm run ai:eval`, điền bảng kết quả cho báo cáo (`docs/ai/06`).

### B2. Việc nhỏ cho phần AI đã có
- [ ] Test tích hợp cho `src/server/ai/advisor/size.service.ts`.
- [ ] Kiểm ô chat trên điện thoại thật (bàn phím ảo, thanh dưới iPhone).
- [ ] Hiệu chỉnh ngưỡng thuật toán size (`THRESHOLDS`) khi có số đo thật.

---

## C. Tồn đọng của cửa hàng
- [ ] Thử VNPay với sandbox thật (điền `VNP_TMN_CODE`, `VNP_HASH_SECRET`).
- [ ] Hạn thanh toán và tự huỷ cho đơn chuyển khoản (đã chốt: Admin xác nhận tay; hạn tự huỷ để sau).
- [ ] Hoàn tiền thật khi huỷ đơn đã thanh toán (xem A5).
- [ ] Rate-limit đăng nhập đang lưu trong bộ nhớ: chuyển sang Redis (dùng chung với limiter AI ở B1.5).
- [ ] Cảnh báo build: `jose` trong `middleware.ts` (Edge Runtime).
- [ ] Viết nội dung thật cho **Chính sách đổi trả** và **Chính sách bảo mật** (đang "đang cập nhật" trong `src/lib/policies.ts`); kiểm lại chính sách vận chuyển và thanh toán cho khớp thực tế.
- [ ] Trang liên hệ/giới thiệu (footer chưa có).
- [ ] Header không còn hiện danh mục: cân nhắc có cần menu danh mục trở lại không.
- [ ] Ô chọn mùa trong panel lọc (đã có lọc `season` và chip, chưa có facet mùa).

## Tuỳ chọn
- [ ] Mục "Quy trình làm việc nhóm" trong `docs/ai/00-overview.md` (cần tên người làm từng phần).

---

## Đã chốt (đừng hỏi lại)
Kho kiến thức tiếng Việt · bỏ giỏ khách, AI và giỏ hàng cần tài khoản · số đo trong bảng size là số đo cơ thể · không thêm giới tính vào `SizeChart` (bảng size tách theo category lá Nam/Nữ/Unisex, đã làm) · AI không đặt hàng, chỉ thêm vào giỏ có xác nhận · `occasion` 23 giá trị chuẩn (`OCCASIONS` trong `prisma/seed-data/vocab.ts`) · trợ lý là nút tròn xám đen góc phải dưới, header không có nút trợ lý · header không hiện danh mục, footer 4 cột (Giới thiệu, Danh mục, Tài khoản, Chính sách).

## Lưu ý môi trường
- Windows chặn rollup native: dự án dùng `@rollup/wasm-node` (đừng gỡ nếu máy bị chặn).
- Muốn thấy nút trợ lý: thêm `AI_ENABLED="true"` vào `.env`, khởi động lại `npm run dev`.
- Test tích hợp cần Docker: `npm run db:up`. Sau khi cập nhật code: `npm install`, `npx prisma migrate dev`, `npm run db:seed` (seed xoá dữ liệu cũ).
- Nếu `npm run dev` báo lỗi `ENOENT` trong `.next`, dừng server, xoá thư mục `.next` rồi chạy lại (cache build, không đưa lên repo).
