# 07 · Biến môi trường và chuẩn bị

Hiện chỉ có **một** biến AI được code đọc: `AI_ENABLED` (so với `"true"` ở `src/app/(shop)/layout.tsx`, để hiện nút trợ lý; chưa có module env Zod). Các biến AI còn lại chưa được đọc (đã quét `process.env.*`: ngoài `AI_ENABLED` chỉ có `NEXT_PUBLIC_APP_URL`, `BANK_*`, `VNP_*`, `CRON_SECRET`, `JWT_SECRET`, `PRISMA_QUERY_LOG`, `NODE_ENV`; `DATABASE_URL` đọc ở `prisma.config.ts`; `REDIS_URL` có trong `.env.example` nhưng chưa được code dùng). Các biến dưới đây đã được thêm vào `.env.example` **dưới dạng dòng comment**.

## 1. Biến môi trường AI

| Biến | Bắt buộc khi bật AI | Ý nghĩa | Ghi chú |
|---|---|---|---|
| `AI_ENABLED` | Có | Công tắc tổng | `false` ⇒ ẩn chat, chỉ tìm kiếm từ khoá |
| `AI_PROVIDER` | Có | Nhà cung cấp LLM | Phụ thuộc quyết định chốt (`00`, mục 5) |
| `AI_API_KEY` | Có | Khoá LLM | Chỉ đọc ở server; **không** dùng tiền tố `NEXT_PUBLIC_`; không commit |
| `AI_CHAT_MODEL` | Có | Model hội thoại + tool | Ghi id đúng theo tài liệu nhà cung cấp |
| `AI_FAST_MODEL` | Không | Model rẻ cho trích bộ lọc | Mặc định dùng `AI_CHAT_MODEL` |
| `AI_EMBEDDING_PROVIDER` | Có | Nhà cung cấp embedding | Có thể khác LLM (Anthropic không có API embedding) |
| `AI_EMBEDDING_API_KEY` | Có* | Khoá embedding | *Bỏ nếu dùng chung khoá |
| `AI_EMBEDDING_MODEL` | Có | Model embedding | Hỗ trợ tiếng Việt |
| `AI_EMBEDDING_DIMENSIONS` | Có | Số chiều | **Phải khớp** `vector(N)` trong DB |
| `AI_REQUEST_TIMEOUT_MS` | Không (mặc định 15000) | Timeout mỗi lần gọi | Quá hạn ⇒ fallback |
| `AI_MAX_INPUT_CHARS` | Không (1000) | Giới hạn độ dài tin nhắn | |
| `AI_MAX_OUTPUT_TOKENS` | Không (800) | Trần token trả lời | |
| `AI_MAX_TOOL_STEPS` | Không (5) | Số vòng tool tối đa/lượt | |
| `AI_RATE_LIMIT_PER_MINUTE` | Không | Giới hạn yêu cầu theo user (AI cần đăng nhập nên không có hạn mức riêng cho khách) | Cần Redis (`REDIS_URL`) |
| `AI_DAILY_TOKEN_BUDGET_PER_USER` / `_TOTAL` | Không | Ngân sách token/ngày | |
| `AI_LOG_LEVEL` | Không (0) | Mức log hội thoại | Xem `05`, mục 7 |

Khi viết code: đọc env qua **một** module có Zod (ví dụ `src/server/ai/core/env.ts`, **CHƯA CÓ**) để lỗi cấu hình báo sớm; thiếu cấu hình AI thì tính năng tự tắt, không làm hỏng build/site. Thêm `NEXT_PUBLIC_*` cho AI là **sai**.

Gói cần cài sau này (chưa cài; chốt phiên bản khi cài): `ai` (Vercel AI SDK), gói provider tương ứng (ví dụ `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`), có thể `ioredis` hoặc client Redis khác cho rate limit. `zod` và `jose` đã có.

## 2. Bật extension vector

Trạng thái **đã bật** trên DB hiện tại (đã kiểm: `vector 0.8.7`, `unaccent 1.1`):
- Image Docker: `pgvector/pgvector:pg16` (`docker-compose.yml`).
- Migration `20261109180232_init` có `CREATE EXTENSION IF NOT EXISTS "vector"`; schema Prisma khai báo `extensions = [vector, unaccent]` với `previewFeatures = ["postgresqlExtensions"]`.

Kiểm tra lại bất kỳ lúc nào:
```bash
docker exec fashion-postgres psql -U fashion -d fashion -c "select extname, extversion from pg_extension;"
```
Nếu thiếu (DB mới tạo bằng cách khác): `CREATE EXTENSION IF NOT EXISTS vector;` (cần quyền superuser; image pgvector đã cài sẵn thư viện). Production dùng Postgres managed: xác nhận nhà cung cấp hỗ trợ pgvector.

Việc cần làm ở bước dữ liệu (`01`): migration thêm `ProductEmbedding` (`vector(N)`) + index HNSW `vector_cosine_ops`. pgvector 0.8.x hỗ trợ `hnsw.iterative_scan` nếu cần lọc cứng kết hợp index ở quy mô lớn.

## 3. Việc bạn cần chuẩn bị

### Tài khoản và khoá
- [ ] Chọn nhà cung cấp LLM và tạo API key; **đặt hạn mức chi tiêu (spend limit)** ở dashboard nhà cung cấp.
- [ ] Chọn nhà cung cấp/model embedding (hỗ trợ tiếng Việt) và tạo khoá nếu khác nhà cung cấp LLM.
- [ ] Điền `.env` (không commit; `.env*` đã nằm trong `.gitignore`, chỉ `.env.example` được commit).
- [ ] (Tuỳ chọn) bật Redis cho rate limit: `npm run db:up` đã khởi động Redis, cần thêm client Redis khi làm bước guardrails.

### Dữ liệu sản phẩm (xem `01`, mục 5)
- [x] Chuẩn hoá `occasion`: đã gộp về 23 giá trị chuẩn trong seed (cần chạy lại `npm run db:seed`).
- [x] Thêm lọc `season`; sửa nghĩa `gender` cho AI (nam gồm unisex): đã có (`includeUnisex`).
- [x] Bổ sung 3–5 sản phẩm nam hợp dự tiệc/đám cưới mùa hè; thêm tag ngữ cảnh ("ngoài trời", "thoáng mát"…): đã thêm 5 sản phẩm (2026-11-12); 4 món quần áo có tag `ngoài trời`, `thoáng mát`, nơ cổ lụa không có.
- [x] `SizeChart` theo giới tính: đã tách theo danh mục Nam/Nữ/Unisex; số đo là số đo cơ thể (độ ôm vẫn chưa có). Bảng nữ là số đo ước lượng.
- [ ] Viết lại mô tả sản phẩm chủ lực cho bớt lặp khuôn.

### Kho kiến thức (xem `03`, mục 7)
- [ ] Quy tắc phối đồ (30–50 mục), hướng dẫn chọn size (8–12), chăm sóc chất liệu (10–15), chính sách cửa hàng (5–10), từ điển đồng nghĩa/lóng (50–100 mục).
- [x] Ngôn ngữ chính của kho kiến thức: đã chốt tiếng Việt toàn bộ (`00-overview.md`, mục 5, #3).

### Quyết định (xem `00`, mục 5)
- [ ] LLM chính + LLM trích xuất; model embedding + số chiều.
- [x] Giỏ khách và khách dùng AI: đã chốt, bỏ giỏ khách, AI và giỏ hàng cần tài khoản (`04`, mục 5).
- [ ] Ngân sách token và ngưỡng đánh giá (`06`).

### Môi trường dev
- [ ] `npm run db:up`, `npx prisma migrate dev`, `npm run db:seed` (như README).
- [ ] Máy Windows có Application Control: dự án đã dùng `@rollup/wasm-node` thay `rollup`; các gói AI thuần JS không bị ảnh hưởng, nhưng nếu gói có file `.node` native bị chặn thì chọn phương án thuần JS.
