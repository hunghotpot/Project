# 07 · Biến môi trường và cài đặt

Tóm tắt: AI chạy **local qua Ollama**, không cần API key. Cấu hình đọc qua một module Zod (`src/server/ai/core/env.ts`, hàm `getAiStatus()`): thiếu hoặc sai cấu hình thì AI **tự tắt kèm lý do**, không làm hỏng build hay web. Mẫu cấu hình: khối "Trợ lý AI" trong `.env.example` (đang để dạng comment).

## 1. Cài đặt từ đầu (5 bước)

| Bước | Lệnh / việc | Kiểm tra |
|---|---|---|
| 1 | Cài [Ollama](https://ollama.com), rồi `ollama pull qwen3:4b-instruct` và `ollama pull bge-m3` | `ollama list` thấy cả hai model |
| 2 | `npm run db:up` → `npx prisma migrate deploy` → `npm run db:seed` (như README) | `docker ps` thấy `fashion-postgres`, `fashion-redis` |
| 3 | Trong `.env`: bỏ comment 6 dòng **[BẮT BUỘC]** của khối "Trợ lý AI" (mục 2) | `npm run dev` không báo "AI chưa hợp lệ" |
| 4 | `npm run ai:embed` (khoảng 30 giây: 125 sản phẩm + 94 đoạn kiến thức; chạy lại thì bỏ qua phần không đổi) | In số bản ghi đã embed |
| 5 | Đăng nhập (`customer@example.com`) → nút tròn góc phải dưới → hỏi thử "tìm áo sơ mi nam màu trắng" | Có câu trả lời và thẻ sản phẩm |

Sau mỗi lần `npm run db:seed` phải chạy lại `npm run ai:embed` (seed xoá dữ liệu cũ, kể cả vector). `AI_ENABLED="true"` còn làm hiện nút trợ lý trên web và bật việc embed nền khi Admin sửa sản phẩm.

Kiểm model đang nằm trên GPU: `ollama ps` phải báo `100% GPU` cho `qwen3:4b-instruct` (RTX 3050 6 GB đạt; ngữ cảnh `num_ctx` 8192 đặt trong `models.ts`). Nếu không phải 100% GPU thì chậm rõ rệt: tăng `AI_REQUEST_TIMEOUT_MS` hoặc giảm tải máy.

## 2. Biến môi trường AI

| Biến | Bắt buộc khi bật | Mặc định | Ý nghĩa / ghi chú |
|---|---|---|---|
| `AI_ENABLED` | **Có** | tắt | Công tắc tổng, so với chuỗi `"true"`. Tắt ⇒ ẩn chat, chỉ tìm kiếm từ khoá |
| `AI_PROVIDER` | **Có** | – | Chỉ nhận `ollama` |
| `AI_CHAT_MODEL` | **Có** | – | Model hội thoại + tool: `qwen3:4b-instruct` |
| `AI_EMBEDDING_PROVIDER` | **Có** | – | Chỉ nhận `ollama` |
| `AI_EMBEDDING_MODEL` | **Có** | – | `bge-m3` |
| `AI_EMBEDDING_DIMENSIONS` | **Có** | – | `1024`. **Phải khớp** `vector(N)` trong DB; đổi thì migration + embed lại |
| `AI_BASE_URL` | Không | `http://localhost:11434` | Địa chỉ Ollama (chỉ đọc ở server) |
| `AI_FAST_MODEL` | Không | = `AI_CHAT_MODEL` | Dùng chung model chat để chỉ một model nằm trong VRAM |
| `AI_REQUEST_TIMEOUT_MS` | Không | `60000` | Quá hạn thì dùng fallback. Lượt đầu sau khi nạp model có thể mất 15 giây trở lên |
| `AI_MAX_INPUT_CHARS` | Không | `1000` | Độ dài tối đa một tin nhắn |
| `AI_MAX_OUTPUT_TOKENS` | Không | `800` | Trần token trả lời |
| `AI_MAX_TOOL_STEPS` | Không | `3` | Số vòng tool tối đa mỗi lượt |
| `AI_RATE_LIMIT_PER_MINUTE` | Không | `10` | Số yêu cầu chat mỗi phút mỗi người (AI cần đăng nhập). Dùng Redis qua `REDIS_URL`; chưa đặt hoặc Redis lỗi thì đếm trong bộ nhớ |
| `AI_DAILY_TOKEN_BUDGET_PER_USER` | Không | không giới hạn | Trần token mỗi người mỗi ngày (giờ Việt Nam) |
| `AI_DAILY_TOKEN_BUDGET_TOTAL` | Không | không giới hạn | Trần token cả hệ thống mỗi ngày. Chạm trần thì chat trả 429 cho mọi người |
| `AI_LOG_LEVEL` | Không | `0` | Nhật ký hội thoại (bảng `AiChatLog`, xem `npm run ai:logs`): 0 số liệu, 1 thêm tham số tool đã che PII, 2 thêm toàn văn (chỉ khi gỡ lỗi). Xem `05` mục 7 |

Lưu ý:
- Không có biến khoá API: Ollama local không cần. Nếu sau này đổi sang nhà cung cấp cloud thì thêm biến mới ở `env.ts` (không dùng tiền tố `NEXT_PUBLIC_`, không commit).
- Nút trợ lý ở `src/app/(shop)/layout.tsx` chỉ xét `AI_ENABLED === "true"`; còn route chat/confirm và tìm kiếm thông minh xét cả cấu hình hợp lệ (`getAiStatus()`). Bật `AI_ENABLED` mà thiếu biến bắt buộc thì nút vẫn hiện nhưng chat trả 503 "chưa hoạt động".
- Khi viết code: đọc env qua `getAiStatus()`, không đọc `AI_*` trực tiếp.

Gói AI đã cài: `ai` ^7 (Vercel AI SDK, cần Node 22 trở lên), `ollama-ai-provider-v2` ^4 (provider gốc của Ollama, cho truyền `think` và `num_ctx`), `ioredis` (Redis cho giới hạn tốc độ và kho xác nhận).

## 3. Cơ sở dữ liệu: pgvector

- Image Docker: `pgvector/pgvector:pg16` (`docker-compose.yml`). Migration `init` có `CREATE EXTENSION IF NOT EXISTS "vector"`; schema Prisma khai báo `extensions = [vector, unaccent]`.
- Bảng liên quan: `ProductEmbedding` (vector 1024 + chỉ mục HNSW cosine), `KnowledgeChunk` (vector 1024, quét tuần tự), `AiChatLog` (nhật ký).
- **Dựng DB mới: dùng `npx prisma migrate deploy`.** `migrate dev` chỉ khi bạn đổi `schema.prisma`, và nó luôn đề nghị thêm một migration `DROP INDEX` cho chỉ mục HNSW (Prisma không biểu diễn được chỉ mục này): **từ chối**, đừng đặt tên migration. Giải thích ở `01` mục 3.

Kiểm tra extension bất kỳ lúc nào:
```bash
docker exec fashion-postgres psql -U fashion -d fashion -c "select extname, extversion from pg_extension;"
```
Production dùng PostgreSQL do nhà cung cấp quản lý: xác nhận họ hỗ trợ pgvector.

## 4. Còn phải làm trước khi triển khai thật

- [ ] Nội dung chính sách đổi trả, bảo hành, hoàn tiền, giao hàng, riêng tư, liên hệ (hiện trợ lý nói "chưa có thông tin"): sửa `docs/ai/knowledge/policy.md` và `src/lib/policies.ts`, rồi `npm run ai:embed`. Chủ cửa hàng duyệt toàn bộ `docs/ai/knowledge/*.md` (README ở đó ghi nguồn và chỗ chưa đối chiếu).
- [ ] Trang chính sách riêng tư phải nói rõ có lưu hội thoại hay không (mức nhật ký 2 lưu toàn văn đã che PII, tự xoá sau 14 ngày khi chạy `npm run ai:logs -- --purge`; chưa có lịch tự chạy).
- [ ] Production: Ollama cần máy có GPU (hoặc đổi nhà cung cấp, sửa `models.ts` và `env.ts`); đặt `REDIS_URL` thật để giới hạn tốc độ dùng chung giữa các instance (breaker và cache embedding vẫn trong bộ nhớ từng instance).
- [ ] Viết lại mô tả sản phẩm chủ lực cho bớt lặp khuôn (dữ liệu, không bắt buộc).
- [ ] Máy Windows có Application Control: dự án đã dùng `@rollup/wasm-node` thay `rollup`; các gói AI thuần JS không bị ảnh hưởng.
