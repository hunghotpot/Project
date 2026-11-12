# AI Shopping Concierge: tổng quan thiết kế

Bộ tài liệu: `00-overview` (file này) · `01-data-for-ai` · `02-semantic-search` · `03-rag-advisor` · `04-tool-calling` · `05-safety-and-guardrails` · `06-evaluation` · `07-env-and-setup`. Hiện trạng code: `docs/architecture.md`.

> Trạng thái (2026-11-12): **phần dùng LLM chưa có** (chưa cài thư viện AI, chưa có API key, chưa có route chat/embedding). Đã chạy thật không cần LLM: tư vấn size (`src/server/ai/advisor/`), khung chat giao diện (`src/components/assistant/`), chuẩn hoá dữ liệu cho AI. Tiến độ và thứ tự làm tiếp: `docs/TODO.md` mục B. Các tên model/gói/phiên bản dưới đây là **đề xuất dựa trên hiểu biết lúc viết**, cần đối chiếu tài liệu chính thức khi bắt đầu cài.

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
| Giao diện chat | Nút tròn xám đen cố định góc phải dưới, bấm ra ô chat chữ nhật đứng (`AssistantWidget`; mobile: toàn màn hình); sau này nhận stream từ route `/api/ai/chat` | Giao diện **ĐÃ CÓ** (chạy với dữ liệu thật ở phần tư vấn size); nối stream **CHƯA CÓ** |
| Cache/rate limit | Redis (đã có trong docker-compose, **chưa được code dùng**) | Dùng cho rate limit theo user và cache embedding của câu truy vấn |

### Cấu trúc code đề xuất (mới có `advisor/size.ts`, `advisor/size.service.ts`, `src/lib/validators/ai.ts` và `src/components/assistant/`; còn lại chưa tạo)
Chia theo **tính năng**, có một lõi dùng chung (`core/`):
```
src/server/ai/                     # tầng service của AI, chỉ chạy server, không đọc cookie
  core/
    env.ts                         # đọc AI_* bằng Zod; thiếu cấu hình thì tự tắt AI (07)
    models.ts                      # chọn model chat, model rẻ, model embedding
    embeddings.ts                  # embed(texts), hash nội dung
    errors.ts                      # toToolError(): AuthError/CartError/OrderError -> {ok:false, code, message} (04)
    redact.ts                      # redactForPrompt(): whitelist trường được đưa vào prompt (05)
    rate-limit.ts                  # giới hạn theo user và ngân sách token, Redis (05)
    log.ts                         # log mức 0/1/2 (05)
  search/                          # Semantic Search (02)
    search.service.ts              # hybrid: lọc cứng + vector + từ khoá + RRF, nới lỏng khi ít kết quả
    intent.ts                      # LLM trích ý định, ép về từ vựng thật
    product-document.ts            # product -> văn bản để embedding (01)
    sync-embeddings.ts             # đồng bộ theo contentHash (01)
  advisor/                         # RAG Advisor (03)
    size.ts                        # tư vấn size, hàm thuần (test không cần LLM)
    outfit.ts                      # Mix & Match, chỉ dùng sản phẩm còn hàng
    knowledge.service.ts           # truy xuất KnowledgeChunk
  tools/                           # Tool Calling (04), mỗi tool một file mỏng
    index.ts                       # tập tool đóng, gom ở một chỗ
    search-products.ts  apply-filters.ts  get-product-detail.ts
    get-size-recommendation.ts  add-to-cart.ts  view-cart.ts  get-order-status.ts
    confirm.ts                     # xác nhận hai pha cho tool ghi
  chat/
    handler.ts                     # streamText + guardrail
    prompts.ts
src/app/api/ai/
  chat/route.ts                    # tầng vào: auth -> rate limit -> validate -> chat/handler
  confirm/route.ts                 # khách bấm xác nhận thì mới gọi addItem
src/lib/validators/ai.ts           # toàn bộ Zod: searchIntent, tool input/output, size/outfit
src/lib/ai/ui-actions.ts           # whitelist UI action, dùng được cả client
src/lib/ai/vi-synonyms.ts          # từ điển đồng nghĩa/lóng tiếng Việt
src/components/assistant/          # UI chat: khung chat, thẻ size, thẻ bộ đồ, thẻ xác nhận (03, mục 8)
src/hooks/use-assistant.ts         # nhận stream, thực thi UI action theo whitelist
scripts/ai/embed.ts                # npm run ai:embed (idempotent)
scripts/ai/eval.ts                 # npm run ai:eval (có gọi LLM, không nằm trong npm test)
src/test/ai/                       # bộ truy vấn mẫu, ca size, kịch bản tool (06)
docs/ai/knowledge/*.md             # kho kiến thức bạn tự soạn (03, mục 7)
```
Quy tắc:
- `src/server/ai/*` được xem như tầng service (nhận context thuần, không đọc cookie). Route `/api/ai/*` là nơi duy nhất đọc cookie/session rồi truyền `userId`/`CartContext` vào.
- Chiều phụ thuộc: `tools` → `search`/`advisor` → service sẵn có (`catalog`, `cart`, `order`) → Prisma. `search` và `advisor` không gọi lẫn nhau; `core` không import ngược lên các thư mục khác.
- Tool mỏng: chỉ validate (Zod) rồi gọi service/hàm của `search`/`advisor`; không chứa nghiệp vụ. Hàm thuần (ví dụ `advisor/size.ts`) tách khỏi phần gọi LLM để test trong `npm test`.
- Chỉ tạo thư mục/file khi bắt đầu bước tương ứng (mục 4); không tạo trước thư mục rỗng.

## 3. Luồng dữ liệu tổng thể

```
Khách nhắn tin ──► POST /api/ai/chat (đọc cookie → user; chưa đăng nhập thì từ chối; rate limit; validate Zod)
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
  searchProducts ─► search/search.service ─► [LLM trích bộ lọc] ─► SQL lọc cứng + pgvector + LIKE ─► RRF ─► ProductListResult
  getSizeRecommendation ─► advisor/size ─► SizeChart (DB) + quy tắc có sẵn ─► JSON (Zod)
  getOrderStatus ─► order.service.listOrders/getOrderDetail(userId)
                      │
                      ▼
        Stream text + tool-call/tool-result về client ─► UI render thẻ sản phẩm, chip lọc, nút xác nhận
```

Luồng nạp dữ liệu (offline): `Product/Variant/Category` → `search/product-document.ts` → hash → nếu đổi thì `embed()` → ghi bảng `ProductEmbedding` (xem `01-data-for-ai`).

## 4. Thứ tự triển khai và tiêu chí hoàn thành

| Bước | Nội dung | Tiêu chí hoàn thành (kiểm được) |
|---|---|---|
| 0 | Chốt quyết định (mục 5), lấy API key, thêm biến môi trường (`07-env-and-setup`) | Có key, `.env` điền, chạy được một lệnh embed thử 1 câu |
| 1 | Chuẩn hoá dữ liệu: danh sách `occasion` chuẩn, bổ sung trường còn thiếu (`01`, mục 5) | Seed cho `occasion`/`style`/`season` thuộc từ vựng đóng; test seed pass |
| 2 | Bảng `ProductEmbedding` + migration vector + script embed toàn bộ | Mọi sản phẩm (hiện 125/125) có embedding, `contentHash` khớp, chạy lại không tạo trùng |
| 3 | Refactor nhỏ cho service (`04`, mục 4): thêm `season` vào filter, cho phép giới hạn theo danh sách id, export `getSizeChart` | `npm test` + lint + typecheck pass, hành vi cũ không đổi |
| 4 | **Semantic Search** (route + service + UI ô tìm) | ≥ 12/15 câu mẫu (`02`) đạt tiêu chí, top-5; độ trễ p95 trong ngưỡng ở `06`; có fallback từ khoá |
| 5 | **Tool Calling** tối thiểu: `searchProducts`, `applyFilters`, `getProductDetail`, `viewCart`, `getOrderStatus` (đọc/UI) | Tỉ lệ tool call đúng ≥ ngưỡng ở `06` trên bộ kịch bản; khách chưa đăng nhập không gọi được tool nào (bị chuyển sang đăng nhập) |
| 6 | **Tool ghi + xác nhận**: `addToCart` | Không có lần nào ghi giỏ khi chưa có xác nhận (test tự động) |
| 7 | **RAG Advisor**: `getSizeRecommendation`, Mix & Match | Đúng size trên bộ ca số đo mẫu theo ngưỡng ở `06`; không bịa khi thiếu dữ liệu |
| 8 | Guardrails đầy đủ (`05`), log, đo lường (`06`) | Checklist `05` đạt; có bảng kết quả `06` điền số thật |

Gợi ý lùi bước: nếu hết thời gian, bước 4 + 5 (đọc/UI) đã đủ demo; bước 6–7 làm sau.

**Tiến độ (2026-11-12):** bước 1 xong; bước 3 xong phần `season`, `includeUnisex`, `getSizeChart` (còn thiếu giới hạn theo danh sách id); bước 7 xong riêng `getSizeRecommendation` (chưa nối LLM); các bước còn lại chưa làm. Thứ tự làm tiếp đã sắp lại (guardrails tối thiểu đi cùng route chat): xem `docs/TODO.md` mục B1.

## 5. Quyết định cần chốt (bởi chủ dự án)

| # | Quyết định | Ảnh hưởng |
|---|---|---|
| 1 | LLM chính và LLM trích xuất | Chi phí, độ trễ, chất lượng tiếng Việt, tên gói provider |
| 2 | Model embedding và **số chiều** | Kích thước cột `vector(N)`, migration, không đổi được N nếu không embed lại |
| 3 | ~~Ngôn ngữ chính của kho kiến thức~~ **Đã chốt (2026-11-10): tiếng Việt toàn bộ** (quy tắc phối đồ, chăm sóc, chính sách, từ điển đồng nghĩa). Không trộn tiếng Anh, trừ token kỹ thuật `style` đã có `STYLE_LABEL` để ánh xạ | Chọn model embedding đa ngôn ngữ hỗ trợ tiếng Việt; dữ liệu sản phẩm và kho kiến thức cùng ngôn ngữ nên embedding khớp tốt |
| 5 | ~~Chuẩn hoá dữ liệu trước khi làm AI?~~ **Đã chốt (2026-11-10): làm trước Semantic Search**, gộp cùng đợt thiết kế lại danh mục nam/nữ. Gồm 4 hạng mục và bảng gộp `occasion` đề xuất ở `01-data-for-ai.md` mục 6 | Seed `occasion`, `productFilterSchema` (+`season`), nghĩa `gender` cho AI, sản phẩm nam dự tiệc/đám cưới mùa hè |
| 4 | ~~Khách chưa đăng nhập dùng AI tới mức nào~~ **Đã chốt (2026-11-10): AI và giỏ hàng đều cần tài khoản; không có giỏ khách.** Khách bấm nút trợ lý hoặc "Tư vấn size" được chuyển sang đăng nhập rồi quay lại trang | Mọi route/action AI yêu cầu đăng nhập; không cần limiter riêng cho khách |
| 5 | Có để AI đặt hàng không (đề xuất: **không**, chỉ dẫn tới `/checkout`) | Rủi ro tài chính, phạm vi xác nhận |
| 6 | Ngân sách token/ngày/người dùng | `05` (giới hạn chi phí) |
