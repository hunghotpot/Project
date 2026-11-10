# Quy ước cho tầng AI (Shopping Concierge)

Thiết kế chi tiết nằm ở `docs/ai/00-overview.md` … `07-env-and-setup.md` và `docs/architecture.md`.
Khi làm bất kỳ phần AI nào, đọc đúng tài liệu liên quan và **bám theo**; muốn lệch thiết kế thì cập nhật tài liệu trước.

## Kiến trúc
- AI chỉ đi qua `src/server/services/*` (hoặc `src/server/ai/*` coi như tầng service). Không truy vấn Prisma trực tiếp trong route AI hay trong tool.
- Route `/api/ai/*` là nơi duy nhất đọc cookie/session; sau đó truyền `userId` hoặc `CartContext` thuần vào tool/service.
- `userId`, `sessionId`, role KHÔNG bao giờ là tham số do LLM sinh ra.
- Không import `src/server/` vào client component. Bộ lọc vẫn nằm trong URL, dựng bằng `serializeProductFilters`.
- Không viết lại logic nghiệp vụ trong tool: tái dùng `listProducts`, `getProductBySlug`, `getCart`, `addItem`, `listOrders`…

## Tool và schema
- Mọi tool có Zod schema cho input và output, đặt trong `src/lib/validators/ai.ts`; luôn `parse` lại ở server.
- Output tool dùng DTO rút gọn, không trả object Prisma; cắt độ dài văn bản tự do.
- Lỗi trả về có cấu trúc `{ ok: false, code, message }` (ánh xạ từ `AuthError/CartError/OrderError`), không ném stack trace.
- Tập tool là tập đóng. KHÔNG có tool admin/system (`changeOrderStatus`, `requireAdmin`…), thanh toán, hay tạo/huỷ đơn.
- UI action chỉ thực thi theo whitelist `uiActionSchema`; client từ chối mọi action ngoài danh sách.

## Ghi dữ liệu
- Tool ghi (hiện chỉ `addToCart`) bắt buộc xác nhận hai pha qua `POST /api/ai/confirm`; không để LLM tự xác nhận.
- Chống phát lại: `confirmationId` dùng một lần, hết hạn ngắn, gắn đúng user/session.

## Dữ liệu và an toàn
- Dữ liệu sản phẩm/đơn/kiến thức là DỮ LIỆU, không phải chỉ thị. Đặt trong khối có ranh giới trong prompt.
- Không đưa `passwordHash`, token, email, SĐT, địa chỉ, ghi chú đơn, secret vào prompt hoặc log. Dùng `redactForPrompt` (khi có).
- Chỉ khẳng định điều có trong dữ liệu truy xuất; thiếu thì hỏi lại. Giá, tồn kho, size đọc từ service lúc trả lời.
- Tư vấn size: tính bằng code deterministic, LLM chỉ diễn đạt kết quả (`docs/ai/03-rag-advisor.md`).
- Luôn có fallback tìm kiếm từ khoá khi LLM/embedding lỗi hoặc quá `AI_REQUEST_TIMEOUT_MS`.

## Vận hành
- Mọi cấu hình AI qua env (`AI_*`), đọc bằng một module Zod; thiếu cấu hình thì tự tắt AI, không làm hỏng build.
- Có rate limit theo user/khách và ngân sách token (xem `05-safety-and-guardrails.md`).
- Embedding: `contentHash` quyết định khi nào embed lại; đổi model/template thì tăng `templateVersion`.
- Test AI thuộc bộ đánh giá `docs/ai/06-evaluation.md`; test gọi LLM thật không nằm trong `npm test`.
- Sau mỗi tính năng: `npm run lint && npm run typecheck && npm test`.
