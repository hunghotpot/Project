# AI Shopping Concierge: tổng quan

Bộ tài liệu: `00-overview` (file này) · `01-data-for-ai` · `02-semantic-search` · `03-rag-advisor` · `04-tool-calling` · `05-safety-and-guardrails` · `06-evaluation` · `07-env-and-setup`. Hiện trạng code toàn hệ thống: `docs/architecture.md`.

> **Trạng thái (2026-11-14): cả 3 tính năng và phần guardrails đã chạy thật** trên model local. Còn lại: nội dung chính sách đổi trả/bảo mật thật (chờ chủ cửa hàng) và đợt đánh giá tổng hợp (bước 9 ở mục 4: `ai:eval`, bảng kết quả cho báo cáo). Thiết kế ban đầu ở các file `01`–`07` có chỗ đã khác với thực tế sau khi đo; chỗ nào khác đều ghi "khác thiết kế" kèm lý do (đáng chú ý: hiểu câu tìm kiếm **bằng code, không dùng LLM trích ý định**, vì model 4B hay bịa giá và danh mục).

## 1. Ba tính năng

| # | Tính năng | Khách làm được gì | Đầu ra |
|---|---|---|---|
| 1 | **Semantic Search** | Gõ câu tự nhiên ("áo sơ mi mát đi làm dưới 500k") và nhận sản phẩm phù hợp dù không trùng từ khoá | Danh sách sản phẩm + chip điều kiện đã hiểu, trên trang `/products?q=…` |
| 2 | **RAG Advisor** | Hỏi size theo số đo, cách chăm sóc chất liệu, chính sách; nhờ phối bộ đồ | Thẻ size, thẻ bộ đồ, câu trả lời có ghi nguồn |
| 3 | **Tool Calling** | Nhờ trợ lý lọc, xem chi tiết/giỏ/đơn, mở giỏ, chuyển trang, thêm vào giỏ | Trợ lý gọi tool trong **tập đóng 10 tool**; ghi giỏ phải được khách bấm Xác nhận |

**Nguyên tắc xuyên suốt:** AI không có đường tắt vào dữ liệu. Mọi thứ đi qua `src/server/services/*` với quyền của người dùng hiện tại. LLM chỉ *đề nghị*; mọi quyền hạn, giới hạn và kiểm tra nằm ở server (xem `05`).

## 2. Kiến trúc đã chốt

| Thành phần | Dùng | Lý do / lưu ý |
|---|---|---|
| Khung gọi LLM | **Vercel AI SDK** (`ai` ^7) + `ollama-ai-provider-v2` | Stream, tool calling, Zod dùng chung một API. Provider này cho truyền `think` và `num_ctx` |
| LLM hội thoại | **`qwen3:4b-instruct`** (Ollama, local) | Bản không "suy nghĩ" (chọn tool 0,4–1,1 giây, bản thường 3–26 giây). Máy dev: RTX 3050 6 GB. Model nhỏ nên bắt buộc: tập tool đóng, prompt ngắn (< 2.500 ký tự), cổng kiểm chứng câu trả lời |
| Embedding | **`bge-m3`**, 1024 chiều (Ollama, chạy CPU) | Đa ngôn ngữ; đổi model hoặc số chiều thì phải migration + embed lại toàn bộ |
| Vector store | **pgvector** trong chính PostgreSQL | Image `pgvector/pgvector:pg16`; chỉ mục HNSW cho sản phẩm; kho kiến thức quét tuần tự (vài chục đoạn) |
| Redis | Giới hạn tốc độ, ngân sách token, kho xác nhận `addToCart` | Không có Redis thì rơi về bộ nhớ tiến trình |
| Giao diện chat | Nút tròn góc phải dưới, ô chat kiểu Messenger (`AssistantWidget`; mobile toàn màn hình) | Luồng NDJSON: chữ, thẻ, hành động giao diện; thẻ hiện **sau** câu trả lời |
| Nhật ký | Bảng `AiChatLog`, 3 mức, xem bằng `npm run ai:logs` | Mức 0 luôn ghi số liệu; mức 2 chỉ khi gỡ lỗi |

### Cấu trúc code (thật)
Chia theo **tính năng**, có một lõi dùng chung (`core/`):
```
src/server/ai/                     # tầng service của AI, chỉ chạy server, không đọc cookie
  core/
    env.ts                         # đọc AI_* bằng Zod; thiếu cấu hình thì tự tắt AI (07)
    models.ts                      # chọn model chat/embedding, tuỳ chọn think + num_ctx
    embeddings.ts                  # embedTexts (có circuit breaker), hashContent
    embedding-cache.ts             # cache embedding của câu hỏi (500 câu)
    breaker.ts                     # circuit breaker cho chat và embedding (05 mục 8)
    rate-limit.ts                  # giới hạn tốc độ + ngân sách token (người và toàn hệ thống), Redis
    confirmations.ts               # kho xác nhận dùng một lần cho tool ghi (Redis GETDEL)
    redact.ts  errors.ts           # che PII; đổi lỗi service thành {ok:false, code, message}
    log.ts  log-store.ts           # nhật ký mức 0/1/2: log.ts thuần, log-store.ts ghi bảng AiChatLog
    size-match.ts                  # so khớp size "Free"/"Free size"/L khác XL
  search/                          # Semantic Search (02)
    intent.ts  describe-intent.ts  # hiểu câu tìm kiếm BẰNG CODE: giá, size, màu, từ khoá; mô tả chip
    search.service.ts              # lọc cứng + vector + từ khoá, hợp nhất bằng RRF, nới lỏng khi ít kết quả
    product-document.ts  sync-embeddings.ts   # sản phẩm -> văn bản -> embed theo contentHash (01)
    smart-search-limit.ts          # 30 lần/phút/người cho phần vector
  advisor/                         # RAG Advisor (03)
    size.ts  size.service.ts       # tư vấn size: code tính, LLM chỉ diễn đạt
    outfit.ts  outfit.service.ts   # Mix & Match: code chọn món, LLM chỉ tóm tắt
    knowledge-parser.ts  knowledge-sync.ts  knowledge.service.ts   # kho kiến thức (docs/ai/knowledge/*.md)
  tools/                           # Tool Calling (04): mỗi tool một file mỏng, tập đóng 10 tool
    index.ts  context.ts  resolve-product.ts
    search-products  apply-filters  get-product-detail  get-size-recommendation  get-outfit-suggestion
    view-cart  get-order-status  ui-tools (openCart, navigate)  add-to-cart (tool GHI duy nhất, chỉ tạo thẻ)
  chat/
    handler.ts                     # một lượt chat: giới hạn, breaker, model + tool, cổng kiểm chứng, nhật ký
    claims.ts                      # cổng kiểm chứng: chặn câu trả lời khẳng định điều chưa có bằng chứng
    confirm.ts                     # bước 2 của addToCart: lấy bản ghi xác nhận rồi addItem (nơi DUY NHẤT ghi giỏ)
    prompts.ts  text-repair.ts     # chỉ dẫn hệ thống; sửa lỗi model bỏ chữ "m" đầu câu
src/app/api/ai/{chat,confirm}/route.ts   # tầng vào: đăng nhập -> validate -> handler
src/lib/validators/ai.ts           # toàn bộ Zod của AI
src/lib/ai/                        # dùng được cả client: ui-actions (whitelist), chat-events (NDJSON), chat-client, chat-text, vi-synonyms, vi-price
src/components/assistant/          # UI chat: khung, bong bóng, thẻ sản phẩm/size/bộ đồ/xác nhận
src/hooks/use-assistant.ts         # nhận luồng, thực thi hành động giao diện theo whitelist
scripts/ai/                        # embed, search-check, chat-check, attack-check, logs (npm run ai:*)
src/test/ai/                       # bộ truy vấn mẫu, guardrails.test.ts (bộ tấn công tự động)
docs/ai/knowledge/*.md             # kho kiến thức (chăm sóc, size, chính sách, phối đồ, dịp)
```
Quy tắc:
- `src/server/ai/*` được xem như tầng service (nhận context thuần, không đọc cookie). Route `/api/ai/*` là nơi duy nhất đọc cookie/session rồi truyền `userId` vào.
- Chiều phụ thuộc: `tools` → `search`/`advisor` → service sẵn có (`catalog`, `cart`, `order`) → Prisma. `search` và `advisor` không gọi lẫn nhau; `core` không import ngược lên thư mục khác. Test `guardrails.test.ts` quét mã nguồn để giữ các quy tắc này (không import service Admin, chỉ `chat/confirm.ts` gọi `addItem`, tool và chat không truy vấn Prisma trực tiếp).
- Tool mỏng: chỉ validate (Zod) rồi gọi service; không chứa nghiệp vụ. Hàm thuần (`size.ts`, `outfit.ts`) tách khỏi phần gọi LLM để test trong `npm test`.

## 3. Luồng một lượt chat

```
Khách nhắn ──► POST /api/ai/chat
                 đăng nhập? ─ không ─► 401          AI tắt ─► 503
                 độ dài / giới hạn tốc độ / trần token ngày ─► 400 / 429
                 circuit breaker mở ─► 503 (kèm Retry-After)
                      │
                      ▼
      truy xuất kiến thức (RAG) ─► ghép chỉ dẫn hệ thống + khối <kien_thuc> + khối <da_hien> (thẻ lượt trước)
                      │
                      ▼
      streamText(model, tool đóng)  ──── model gọi tool ────►  tool ĐỌC     → service với userId của phiên
                      │                                          tool UI      → hành động theo WHITELIST (client kiểm lại)
                      │                                          tool GHI     → chỉ tạo thẻ xác nhận (CHƯA ghi giỏ)
                      ▼
      CỔNG KIỂM CHỨNG (claims.ts): chưa gọi tool mà khẳng định "đã thêm", giá, size, hết hàng...?
          ─ có ─► thử lại (tối đa 2 lần, tập tool thu hẹp) ─► vẫn không ─► câu trung thực thay thế
                      │
                      ▼
      NDJSON về trình duyệt: chữ (stream) ─► sau khi câu xong mới hiện thẻ (sản phẩm, size, bộ đồ, xác nhận)
                      │
      ghi nhật ký AiChatLog (không bao giờ làm chậm hay hỏng câu trả lời)

Khách bấm "Xác nhận" trên thẻ ──► POST /api/ai/confirm (KHÔNG qua model): lấy bản ghi dùng một lần, gắn đúng user ──► addItem
```

Luồng nạp dữ liệu (offline, `npm run ai:embed`): `Product/Variant/Category` → `search/product-document.ts` → hash → nếu đổi thì embed → bảng `ProductEmbedding`; `docs/ai/knowledge/*.md` → `advisor/knowledge-parser.ts` → bảng `KnowledgeChunk` (xem `01`).

## 4. Tiến độ theo thứ tự thiết kế

| Bước | Nội dung | TT | Kết quả chính |
|---|---|---|---|
| 0 | Chốt quyết định, cấu hình môi trường | ✅ | Local qua Ollama, không cần key (mục 5, `07`) |
| 1 | Chuẩn hoá dữ liệu (`occasion`, `season`, danh mục) | ✅ | `occasion` 23 giá trị chuẩn; test seed |
| 2 | Bảng embedding + script `ai:embed` | ✅ | 125/125 sản phẩm, chạy lại không tạo trùng |
| 3 | Refactor service cho AI (`season`, `onlyIds`, `getSizeChart`) | ✅ | Hành vi cũ không đổi |
| 4 | **Semantic Search** | ✅ | Pass@5 15/15, Precision@5 0,82, 0 vi phạm lọc cứng |
| 5 | **Tool Calling** đọc/giao diện | ✅ | 10 tool, đo 11/11 sau khi rút prompt |
| 6 | **Tool ghi + xác nhận** (`addToCart`) | ✅ | Không có đường ghi giỏ nào bỏ qua xác nhận (có test và quét mã) |
| 7 | **RAG Advisor** (size, kiến thức, Mix & Match) | ✅ | Còn thiếu nội dung chính sách đổi trả/bảo mật thật |
| 8 | Guardrails đầy đủ, nhật ký, bộ tấn công | ✅ | 25/25 ca an toàn; checklist `05` mục 9 đã đối chiếu |
| 9 | Đánh giá tổng hợp (`06`, `ai:eval`) | ⬜ | Các bộ đo riêng lẻ đã có, chưa gộp thành bảng cho báo cáo (B1.10) |

Số đo và lý do chọn nằm ở phần "Trạng thái" và "Kết quả đo" của `02`, `04`, `05`, `06`.

## 5. Quyết định đã chốt

| # | Quyết định | Ảnh hưởng |
|---|---|---|
| 1 | **LLM chính và LLM trích bộ lọc** (2026-11-13): `qwen3:4b-instruct` local qua Ollama, dùng chung | Không có chi phí API; độ trễ và chất lượng phụ thuộc máy. Trên thực tế không dùng LLM trích bộ lọc (model bịa giá/danh mục), hiểu câu bằng code |
| 2 | **Model embedding** (2026-11-13): `bge-m3`, 1024 chiều | Cột `vector(1024)`, không đổi N được nếu không embed lại |
| 3 | **Ngôn ngữ kho kiến thức** (2026-11-10): tiếng Việt toàn bộ | Embedding đa ngôn ngữ; dữ liệu sản phẩm và kiến thức cùng ngôn ngữ nên khớp tốt |
| 4 | **Chuẩn hoá dữ liệu trước khi làm AI** (2026-11-10), gộp cùng đợt thiết kế lại danh mục nam/nữ | Seed `occasion`, lọc `season`, nghĩa `gender` cho AI, sản phẩm nam dự tiệc mùa hè |
| 5 | **Khách chưa đăng nhập** (2026-11-10): AI và giỏ hàng đều cần tài khoản; không có giỏ khách | Mọi route/action AI yêu cầu đăng nhập; nút trợ lý chuyển sang đăng nhập rồi quay lại trang |
| 6 | **AI không đặt hàng, không thanh toán**: chỉ thêm vào giỏ có xác nhận, dẫn tới `/checkout` | Giảm rủi ro tài chính, phạm vi xác nhận gọn |
| 7 | **Ngân sách token**: chạy local nên không có chi phí; giữ làm lớp bảo vệ máy (theo người và toàn hệ thống, đều tuỳ chọn) | `05` mục 8; giới hạn thêm: `AI_MAX_TOOL_STEPS=3`, timeout ~60 giây, circuit breaker |
