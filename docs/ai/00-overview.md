# AI Shopping Concierge: tổng quan thiết kế

Bộ tài liệu: `00-overview` (file này) · `01-data-for-ai` · `02-semantic-search` · `03-rag-advisor` · `04-tool-calling` · `05-safety-and-guardrails` · `06-evaluation` · `07-env-and-setup`. Hiện trạng code: `docs/architecture.md`.

> Trạng thái: **chỉ là thiết kế**. Chưa có dòng code AI nào, chưa cài thư viện AI. Các tên model/gói/phiên bản dưới đây là **đề xuất dựa trên hiểu biết lúc viết**, cần đối chiếu tài liệu chính thức khi bắt đầu cài.

## 1. Mục tiêu 3 tính năng

| # | Tính năng | Khách hàng làm được gì | Đầu ra |
|---|---|---|---|
| 1 | **Semantic Search** | Gõ câu tự nhiên ("áo sơ mi mát đi làm dưới 500k") và nhận sản phẩm phù hợp dù không trùng từ khoá | Danh sách sản phẩm + bộ lọc đã áp (hiển thị bằng chip filter quen thuộc) |
| 2 | **RAG Advisor** | Hỏi tư vấn size theo số đo, cách chăm sóc chất liệu, phối đồ từ kho hàng thực tế | Câu trả lời có dẫn nguồn + JSON có cấu trúc (gợi ý size, outfit) |
| 3 | **Tool Calling** | Nhờ trợ lý thao tác: lọc, xem chi tiết, thêm vào giỏ, mở giỏ, tra cứu đơn | Trợ lý gọi đúng service/hành động UI, ghi giỏ phải được khách xác nhận |

Nguyên tắc xuyên suốt: **AI không có đường tắt vào dữ liệu**. Mọi thứ đi qua `src/server/services/*` với quyền của người dùng hiện tại (lý do ghi sẵn trong `.claude/rules/project.md`).

## 2. Kiến trúc đề xuất

| Thành phần | Đề xuất | Lý do / lưu ý |
|---|---|---|
| Khung gọi LLM | **Vercel AI SDK** (gói `ai` + provider tương ứng) | Stream, tool calling, structured output (Zod) dùng chung một API. Tên hàm đổi theo phiên bản: đối chiếu tài liệu bản đang cài. |
| LLM hội thoại | Chốt ở mục "Quyết định cần chốt" bên dưới. Ứng viên: dòng Claude (vd `claude-sonnet-5-5` cho hội thoại/tool, `claude-haiku-5-5` cho trích xuất bộ lọc), hoặc Gemini/GPT | Cần: tiếng Việt tốt, tool calling ổn định, giá/độ trễ chấp nhận được |
| Embedding | Model **đa ngôn ngữ**, hỗ trợ tiếng Việt, 768–1536 chiều | Anthropic không cung cấp API embedding, nên cần provider khác (OpenAI, Google, Cohere, Voyage…) hoặc model tự host |
| Vector store | **pgvector** trong chính PostgreSQL | Extension `vector` đã bật (migration `init`); image `pgvector/pgvector:pg16` đã dùng; không thêm hạ tầng |
| Full-text | Postgres + `unaccent` (đã bật). Có thể thêm `pg_trgm` hoặc `tsvector` | Hiện tìm `q` chỉ là LIKE; xem `02-semantic-search` |
| Giao diện chat | Component client mới (drawer/trang `/assistant`), nhận stream từ route `/api/ai/chat` | **CHƯA CÓ** |
| Cache/rate limit | Redis (đã có trong docker-compose, **chưa được code dùng**) | Dùng cho rate limit theo user và cache embedding của câu truy vấn |

### Cấu trúc code đề xuất (chưa tạo)
```
src/server/ai/            # chỉ chạy server
  models.ts               # chọn model theo env
  embeddings.ts           # embed(text[]), hash nội dung
  product-document.ts     # product -> văn bản để embedding (01-data-for-ai)
  search.service.ts       # hybrid search (02-semantic-search)
  advisor.service.ts      # size + mix&match (03-rag-advisor)
  tools/*.ts              # định nghĩa tool, mỗi tool gọi service thật (04-tool-calling)
  guardrails.ts           # rate limit, lọc input/output (05)
src/app/api/ai/chat/route.ts   # tầng vào: auth -> validate -> streamText
src/lib/validators/ai.ts       # Zod schema dùng chung (tool input, JSON đầu ra)
src/lib/ai/ui-actions.ts       # whitelist UI action cho client
```
Quy tắc: `src/server/ai/*` được xem như tầng service (nhận context thuần, không đọc cookie). Route `/api/ai/chat` là nơi duy nhất đọc cookie/session rồi truyền `userId`/`CartContext` vào.

## 3. Luồng dữ liệu tổng thể

```
Khách nhắn tin ──► POST /api/ai/chat (đọc cookie → user | khách; rate limit; validate Zod)
                      │
                      ▼
              streamText(model, system prompt, messages, tools)
                      │  LLM quyết định gọi tool
        ┌─────────────┼───────────────────────────────┐
        ▼             ▼                               ▼
  tool ĐỌC        tool GHI (addToCart)          tool UI (applyFilters, openCart…)
  gọi service     trả "cần xác nhận" ──► khách   trả mô tả hành động ──► client
  với ctx user     bấm Xác nhận ──► gọi service    thực thi theo WHITELIST
        │
        ▼
  searchProducts ─► search.service ─► [LLM trích bộ lọc] ─► SQL lọc cứng + pgvector + LIKE ─► RRF ─► ProductListResult
  getSizeRecommendation ─► advisor.service ─► SizeChart (DB) + quy tắc có sẵn ─► JSON (Zod)
  getOrderStatus ─► order.service.listOrders/getOrderDetail(userId)
                      │
                      ▼
        Stream text + tool-call/tool-result về client ─► UI render thẻ sản phẩm, chip lọc, nút xác nhận
```

Luồng nạp dữ liệu (offline): `Product/Variant/Category` → `product-document.ts` → hash → nếu đổi thì `embed()` → ghi bảng `ProductEmbedding` (xem `01-data-for-ai`).

## 4. Thứ tự triển khai và tiêu chí hoàn thành

| Bước | Nội dung | Tiêu chí hoàn thành (kiểm được) |
|---|---|---|
| 0 | Chốt quyết định (mục 5), lấy API key, thêm biến môi trường (`07-env-and-setup`) | Có key, `.env` điền, chạy được một lệnh embed thử 1 câu |
| 1 | Chuẩn hoá dữ liệu: danh sách `occasion` chuẩn, bổ sung trường còn thiếu (`01`, mục 5) | Seed cho `occasion`/`style`/`season` thuộc từ vựng đóng; test seed pass |
| 2 | Bảng `ProductEmbedding` + migration vector + script embed toàn bộ | 120/120 sản phẩm có embedding, `contentHash` khớp, chạy lại không tạo trùng |
| 3 | Refactor nhỏ cho service (`04`, mục 4): thêm `season` vào filter, cho phép giới hạn theo danh sách id, export `getSizeChart` | `npm test` + lint + typecheck pass, hành vi cũ không đổi |
| 4 | **Semantic Search** (route + service + UI ô tìm) | ≥ 12/15 câu mẫu (`02`) đạt tiêu chí, top-5; độ trễ p95 trong ngưỡng ở `06`; có fallback từ khoá |
| 5 | **Tool Calling** tối thiểu: `searchProducts`, `applyFilters`, `getProductDetail`, `viewCart`, `getOrderStatus` (đọc/UI) | Tỉ lệ tool call đúng ≥ ngưỡng ở `06` trên bộ kịch bản; khách chưa đăng nhập bị từ chối tool cần quyền |
| 6 | **Tool ghi + xác nhận**: `addToCart` | Không có lần nào ghi giỏ khi chưa có xác nhận (test tự động) |
| 7 | **RAG Advisor**: `getSizeRecommendation`, Mix & Match | Đúng size trên bộ ca số đo mẫu theo ngưỡng ở `06`; không bịa khi thiếu dữ liệu |
| 8 | Guardrails đầy đủ (`05`), log, đo lường (`06`) | Checklist `05` đạt; có bảng kết quả `06` điền số thật |

Gợi ý lùi bước: nếu hết thời gian, bước 4 + 5 (đọc/UI) đã đủ demo; bước 6–7 làm sau.

## 5. Quyết định cần chốt (bởi chủ dự án)

| # | Quyết định | Ảnh hưởng |
|---|---|---|
| 1 | LLM chính và LLM trích xuất | Chi phí, độ trễ, chất lượng tiếng Việt, tên gói provider |
| 2 | Model embedding và **số chiều** | Kích thước cột `vector(N)`, migration, không đổi được N nếu không embed lại |
| 3 | Ngôn ngữ chính của kho kiến thức (tiếng Việt, hay EN + VI) | Chunking, embedding model, cách viết quy tắc phối đồ |
| 4 | Cho phép khách chưa đăng nhập dùng AI tới mức nào (chỉ tìm kiếm, hay cả giỏ ẩn danh) | Phụ thuộc quyết định giỏ khách ở `docs/status-customer.md` |
| 5 | Có để AI đặt hàng không (đề xuất: **không**, chỉ dẫn tới `/checkout`) | Rủi ro tài chính, phạm vi xác nhận |
| 6 | Ngân sách token/ngày/người dùng | `05` (giới hạn chi phí) |
