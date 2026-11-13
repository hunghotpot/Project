# Fashion E-Commerce with AI Shopping Concierge

Website thương mại điện tử thời trang kèm **AI Shopping Concierge**: tìm kiếm ngữ nghĩa, trợ lý chat biết tư vấn size, phối đồ, tra đơn và thêm vào giỏ (có xác nhận). Trợ lý gọi lại đúng các service trong `src/server/services` với quyền của người dùng đang đăng nhập, chạy local qua Ollama (xem mục [Trợ lý AI](#trợ-lý-ai-tuỳ-chọn)).

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL (pgvector) · Redis · Zod · TanStack Query · Zustand · react-hook-form · jose · bcryptjs

## Yêu cầu

- Node.js 22+ và npm (gói `ai` của Vercel AI SDK yêu cầu Node 22 trở lên)
- Docker Desktop (chạy PostgreSQL + Redis)
- (Tuỳ chọn, cho trợ lý AI) [Ollama](https://ollama.com), nên có GPU từ 6 GB VRAM

## Chạy dự án từ đầu

```bash
git clone <url-repo> fashion-shop && cd fashion-shop
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run db:up               # khởi động PostgreSQL + Redis (Docker phải đang chạy)
npx prisma generate         # sinh Prisma Client
npx prisma migrate deploy   # áp các migration có sẵn: tạo bảng + bật extension (vector, unaccent)
npm run db:seed             # nạp dữ liệu mẫu (xem mục "Dữ liệu seed")
npm run dev                 # http://localhost:3000
```

> Dùng `migrate deploy` (không phải `migrate dev`) để dựng DB từ đầu. `migrate dev` chỉ dùng khi bạn đổi `schema.prisma`; nó luôn đề nghị tạo thêm một migration **xoá chỉ mục HNSW** của vector (Prisma không biết chỉ mục này vì phải viết tay): hãy từ chối (Ctrl+C), đừng đặt tên migration. Chi tiết: `docs/ai/01-data-for-ai.md` mục 3.

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
| `npm run ai:*` | Công cụ của trợ lý AI (nạp vector, đo, xem nhật ký): xem mục [Trợ lý AI](#trợ-lý-ai-tuỳ-chọn) |

Xoá cả dữ liệu: `docker compose down -v`.

## Trợ lý AI (tuỳ chọn)

Trợ lý mua sắm chạy **hoàn toàn local qua [Ollama](https://ollama.com)**, không cần API key. Không cài Ollama thì web vẫn chạy bình thường (ẩn nút trợ lý, tìm kiếm theo từ khoá).

| Thành phần | Chọn | Ghi chú |
| --- | --- | --- |
| Model hội thoại + gọi công cụ | `qwen3:4b-instruct` (~2,5 GB) | bản không "suy nghĩ", đủ nhanh trên GPU 6 GB |
| Model embedding | `bge-m3` (1024 chiều) | tìm kiếm ngữ nghĩa và kho kiến thức; lưu bằng pgvector |

**Bật trợ lý** (sau khi đã chạy `db:up`, `migrate deploy`, `db:seed` ở trên):

```bash
ollama pull qwen3:4b-instruct
ollama pull bge-m3
# trong .env: bỏ comment 6 dòng [BẮT BUỘC] của khối "Trợ lý AI" (giá trị mẫu đã đúng), rồi khởi động lại npm run dev
npm run ai:embed            # nạp vector cho sản phẩm + kho kiến thức (lần đầu ~30 giây; chạy lại sau mỗi lần db:seed)
```

Trợ lý cần đăng nhập (dùng tài khoản demo ở trên). Trợ lý **không đặt hàng, không thanh toán**: chỉ tìm sản phẩm, tư vấn size, phối đồ, tra đơn, điều khiển giao diện, và thêm vào giỏ **sau khi khách bấm Xác nhận** trên thẻ.

| Lệnh | Việc | Cần |
| --- | --- | --- |
| `npm run ai:embed` | Nạp/cập nhật vector sản phẩm và kiến thức (chỉ làm lại phần đổi) | Ollama, DB |
| `npm run ai:search-check` | Đo tìm kiếm ngữ nghĩa trên 15 truy vấn mẫu | Ollama, DB đã embed |
| `npm run ai:chat-check` | Chạy bộ câu hỏi mẫu qua chat thật, in công cụ đã gọi (`-- "câu hỏi"` hoặc `-- --convo "câu 1" "câu 2"`) | Ollama, DB |
| `npm run ai:attack-check` | Bộ tấn công (prompt injection, lộ dữ liệu, thao tác nguy hiểm…) | Ollama, DB |
| `npm run ai:logs` | Xem nhật ký hội thoại (`-- --bad`, `-- --stats`, `-- --purge`) | DB |

Các lệnh `ai:*-check` gọi model thật nên **không nằm trong `npm test`** (`npm test` chạy được khi không có Ollama). Thiết kế, số đo và giới hạn đã biết: [docs/ai/](docs/ai/00-overview.md) (đọc `00-overview` trước).

## Chức năng

Mô tả chi tiết từng trang và chức năng nằm ở [docs/features.md](docs/features.md).

| Chức năng | Tóm tắt | Chi tiết |
| --- | --- | --- |
| Xác thực | JWT + refresh token trong cookie `httpOnly`, middleware chặn `/account` và `/admin` | [xem](docs/features.md#xác-thực) |
| Danh sách sản phẩm | `/products`, `/categories/[slug]`; bộ lọc nằm trong URL; tìm kiếm không dấu | [xem](docs/features.md#danh-sách-sản-phẩm) |
| Chi tiết sản phẩm | Chọn màu × size, bảng size, thêm giỏ / mua ngay | [xem](docs/features.md#trang-chi-tiết-sản-phẩm) |
| Giỏ hàng | Chỉ cho người đã đăng nhập; kiểm tồn kho; cảnh báo giá đổi | [xem](docs/features.md#giỏ-hàng) |
| Thanh toán & đơn hàng | COD, chuyển khoản (VietQR); trừ kho nguyên tử trong một transaction | [xem](docs/features.md#thanh-toán--đơn-hàng) |
| Thanh toán VNPay | Ký HMAC-SHA512, IPN idempotent, tự huỷ đơn quá 15 phút; cách chạy thử sandbox | [xem](docs/features.md#thanh-toán-vnpay) |
| Trang Admin | Đơn hàng, kho, danh mục, bảng size, khách hàng; Voucher và Cài đặt mới là giao diện minh hoạ | [xem](docs/features.md#trang-admin) |
| Đơn hàng của tôi | Lọc, tìm, timeline trạng thái, huỷ đơn, mua lại | [xem](docs/features.md#đơn-hàng-của-tôi) |
| Trợ lý AI | Tìm kiếm ngữ nghĩa, tư vấn size, phối đồ, thêm vào giỏ có xác nhận | [mục Trợ lý AI](#trợ-lý-ai-tuỳ-chọn), [docs/ai/](docs/ai/00-overview.md) |

## Dữ liệu seed

`npm run db:seed` **xoá toàn bộ dữ liệu hiện có** rồi nạp lại (từ chối chạy khi `NODE_ENV=production`). Kết quả cố định giữa các lần chạy.

Tài khoản mẫu: xem bảng **Tài khoản demo** ở mục "Chạy dự án từ đầu" (mật khẩu được hash bằng bcrypt, cost 10).

Nội dung: 20 category (cây Nam / Nữ / Unisex + Phụ kiện), 125 sản phẩm, 378 ảnh giữ chỗ (placehold.co, ghi tên sản phẩm; ảnh thật tải lên qua trang Admin), 1.113 biến thể size × màu (một số hết hàng), 83 dòng size chart.

Dữ liệu nằm trong `prisma/seed-data/` để dễ chỉnh:

| File | Nội dung |
| --- | --- |
| `users.ts` | Tài khoản + địa chỉ mẫu |
| `categories.ts` | Cây category Nam / Nữ / Unisex + Phụ kiện; `PRODUCT_GROUPS` (tiền tố SKU, size, category lá theo giới tính) |
| `products/*.ts` | Sản phẩm theo category (tên, giá, màu, mô tả, gợi ý phối) |
| `vocab.ts` | Bảng màu (tên + hex), chất liệu (nhãn + câu mô tả) |
| `size-charts.ts` | Size chart theo từng category lá (số đo cơ thể; bảng nữ là số đo ước lượng) |
| `build.ts` | Ghép mô tả, sinh slug, SKU, biến thể, tồn kho, ảnh giữ chỗ (placehold.co) |

## Cấu trúc thư mục

```
src/
  middleware.ts         # chặn /account, /admin; refresh token
  app/                  # routes (App Router): (shop), (auth), (admin), api/, uploads/, actions/ = Server Actions
  components/{ui,layout,home,product,cart,checkout,orders,auth,account,admin,assistant}
  server/               # chỉ chạy phía server: db.ts, services/* (kể cả admin-*), auth/*, cart/*, payment/*, uploads.ts
    ai/                 #   tầng AI: core/ (env, model, giới hạn, nhật ký…), search/, advisor/, tools/, chat/
  lib/{validators,utils,auth}  # Zod schema, helper thuần, hằng số
  types/                # kiểu dùng chung (catalog, order, address)
  test/                 # fake DB và fixture cho Vitest
  hooks/  stores/       # React hooks, Zustand stores
prisma/{schema.prisma,seed.ts,seed-data/,migrations/}
docs/                   # architecture.md, features.md (mô tả cửa hàng: khách hàng và Admin), ai/* (thiết kế, số đo và giới hạn của trợ lý AI)
scripts/ai/             # lệnh npm run ai:* (nạp vector, các bộ đo, xem nhật ký)
.claude/rules/          # quy ước kiến trúc cho Claude Code
docker-compose.yml      # PostgreSQL (pgvector) + Redis
```

Quy ước kiến trúc chi tiết: xem [CLAUDE.md](CLAUDE.md), `.claude/rules/project.md` và `.claude/rules/ai.md` (phần AI).
