# 01 · Dữ liệu cho AI

Số liệu lấy từ DB sau `db:seed` ngày 2026-11-12 (125 sản phẩm gồm 45 unisex / 34 nam / 46 nữ, 1.113 biến thể, 20 category = 3 gốc Nam/Nữ/Unisex + 16 lá + Phụ kiện, 83 dòng SizeChart). Tên trường lấy từ `prisma/schema.prisma`.

## 1. Trường có giá trị ngữ nghĩa

### Product (nguồn chính của embedding)
| Trường | Kiểu | Dùng cho embedding? | Vai trò |
|---|---|---|---|
| `name` | String | ✅ | Tín hiệu mạnh nhất |
| `description` | String (tối thiểu 322 ký tự, TB 390) | ✅ | Chứa chất liệu, dịp mặc, "Gợi ý phối đồ" |
| `category.name` (qua `categoryId`) | String | ✅ | Loại sản phẩm (Áo sơ mi, Váy đầm…) |
| `brand` | String | ✅ (nhẹ) | 9 thương hiệu |
| `material` | String (~50 giá trị) | ✅ | Cảm giác mặc: mát, ấm, rủ… |
| `style` | String, 9 giá trị: casual, elegant, streetwear, vintage, minimalist, smart-casual, formal, sporty, korean (+1 bohemian) | ✅ (dịch sang tiếng Việt bằng `STYLE_LABEL` ở `src/lib/format.ts`) | Phong cách |
| `occasion` | String[] (từ vựng đóng 23 giá trị, `OCCASIONS` trong `prisma/seed-data/vocab.ts`; xem mục 6) | ✅ | Dịp mặc |
| `season` | String[] ∈ {xuân, hè, thu, đông} | ✅ | Thời tiết |
| `gender` | enum MEN/WOMEN/UNISEX | ✅ (nhãn "Nam/Nữ/Unisex") và **lọc cứng** | |
| `tags` | String[] (4–6 tag/sản phẩm; sau khi gộp `occasion` có thêm tag hoạt động chi tiết) | ✅ | Từ khoá đặc trưng |
| `basePrice`, `isActive`, `isFeatured`, `createdAt` | – | ❌ | Lọc/sắp xếp, không đưa vào vector |

### ProductVariant (không embed từng biến thể, chỉ tổng hợp)
| Trường | Cách dùng |
|---|---|
| `color` (tên tiếng Việt, 24 màu), `colorHex` | Gộp danh sách **màu duy nhất** của sản phẩm vào văn bản embedding; `colorHex` chỉ dùng cho UI |
| `size` | Không embed; là bộ lọc cứng (`size`). Giá trị: S/M/L/XL, 28–34 (quần), 85–105 (thắt lưng), "Free size" |
| `price`, `stock` | **Không embed** (thay đổi thường xuyên). Lọc cứng `inStock` và giá lúc truy vấn |

### SizeChart (không embed trong bảng sản phẩm; dùng cho RAG Advisor, xem `03-rag-advisor.md`)
Trường: `categoryId`, `brand?`, `size`, `chest?`, `waist`, `hip`, `heightMin/Max`, `weightMin/Max`. Dữ liệu hiện có (từ 2026-11-12): 83 dòng, một bảng cho mỗi category lá quần áo trong cây Nam / Nữ / Unisex (áo 4 size S–XL; quần nam và unisex size 28–34, quần nữ size 26–32; áo thun unisex có thêm 4 dòng Urban Ghost). `phu-kien` không có.

### Không embed (nhạy cảm hoặc không liên quan)
`User`, `Address`, `Order*`, `Cart*`, `RefreshToken`. Không bao giờ đưa vào văn bản embedding hay prompt.

## 2. Template "văn bản để embedding"

Mục tiêu: một đoạn văn tiếng Việt tự nhiên, ổn định (cùng dữ liệu → cùng chuỗi), gom các tín hiệu ngữ nghĩa, **không chứa** giá, tồn kho, id, URL.

```
{name}.
Loại: {category.name}. Thương hiệu: {brand}. Giới tính: {genderLabel}.
Chất liệu: {material}. Phong cách: {styleLabelVi}.
Dịp mặc: {occasion.join(", ")}. Mùa: {season.join(", ")}.
Màu sắc: {uniqueColors.join(", ")}.
Từ khoá: {tags.join(", ")}.
Mô tả: {description}
```

Quy tắc dựng: sắp xếp `uniqueColors` theo bảng chữ cái; giữ nguyên thứ tự `occasion/season/tags` như trong DB; cắt khoảng trắng thừa; nhãn giới tính: MEN→"Nam", WOMEN→"Nữ", UNISEX→"Unisex (nam và nữ đều mặc được)". `templateVersion` tăng khi sửa template (buộc embed lại toàn bộ).

### Ví dụ 1 (từ seed): `ao-so-mi-lua-satin-nu`
```
Áo sơ mi lụa satin nữ.
Loại: Áo sơ mi. Thương hiệu: Nhà Tằm. Giới tính: Nữ.
Chất liệu: Satin lụa. Phong cách: Thanh lịch (elegant).
Dịp mặc: dự tiệc, đi làm, hẹn hò. Mùa: xuân, thu, đông.
Màu sắc: Đen, Đỏ đô, Kem.
Từ khoá: satin, bóng mờ, sang trọng, nữ.
Mô tả: Sơ mi satin mềm rủ ánh bóng mờ, tay dài có măng sét, dáng suông nhẹ nhàng nhưng vẫn rất thanh lịch. Vải satin bóng mờ mềm mượt, buông rủ duyên dáng và bắt sáng rất đẹp khi diện buổi tối. Thích hợp để dự tiệc, đi làm, hẹn hò, dễ mặc vào mùa xuân và mùa thu và mùa đông. Gợi ý phối đồ: mặc cùng chân váy bút chì hoặc quần tây cạp cao, thêm hoa tai ngọc trai cho buổi tối hẹn hò.
```
(Giá 549.000đ; 9 biến thể S/M/L × Đen/Đỏ đô/Kem; không đưa vào văn bản.)

### Ví dụ 2 (từ seed): `ao-so-mi-co-tru-phong-cach-a-dong`
```
Áo sơ mi cổ trụ phong cách Á Đông.
Loại: Áo sơ mi. Thương hiệu: Hanoi Atelier. Giới tính: Nam.
Chất liệu: Linen pha cotton. Phong cách: Tối giản (minimalist).
Dịp mặc: đi làm, đi cafe, dự sự kiện. Mùa: xuân, hè, thu.
Màu sắc: Trắng, Xám, Xanh navy.
Từ khoá: cổ trụ, mandarin, tối giản, Á Đông.
Mô tả: Sơ mi cổ trụ không ve áo, đường nét tinh giản mang hơi hướng Á Đông, vải pha linen thoáng và có độ nhám nhẹ. Vải linen pha cotton giữ được độ mát của lanh nhưng mềm và ít nhăn hơn, dễ chăm sóc hằng ngày. Bạn có thể diện khi đi làm, đi cafe, dự sự kiện; đặc biệt hợp vào mùa xuân và mùa hè và mùa thu. Gợi ý phối đồ: cài kín cúc và mặc cùng quần tây ống đứng, hoặc khoác thêm blazer không cài cho gọn gàng.
```
(Giá 429.000đ; biến thể Xanh navy/L đang hết hàng — vì vậy tồn kho không nằm trong embedding.)

> Nhãn phong cách lấy từ `STYLE_LABEL` (`src/lib/format.ts`, ví dụ elegant → "Thanh lịch", formal → "Lịch sự", minimalist → "Tối giản"); template ghép thêm token gốc trong ngoặc để khớp cả từ tiếng Anh.

## 3. Schema bảng embedding (đề xuất, CHƯA CÓ)

Extension `vector` đã bật (migration `20261109180232_init`); **chưa có cột/bảng embedding**. Tách bảng riêng để bảng `Product` không phình và dễ thay model.

```prisma
model ProductEmbedding {
  productId       String   @id
  embedding       Unsupported("vector(1536)") // N phụ thuộc model, xem bảng dưới
  content         String   // đúng chuỗi đã embed (debug, so sánh, tạo lại hash)
  contentHash     String   // SHA-256 của `content` + model + templateVersion
  model           String   // ví dụ "text-embedding-3-small" – ghi đúng id đã dùng
  dimensions      Int
  templateVersion Int      @default(1)
  embeddedAt      DateTime @default(now())

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}
```

SQL phần Prisma không biểu diễn được (viết tay trong migration, dùng `prisma migrate dev --create-only` rồi sửa file `.sql`):
```sql
CREATE INDEX "ProductEmbedding_embedding_hnsw"
  ON "ProductEmbedding" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```
Đọc/ghi cột `vector` bằng `db.$queryRaw` / `db.$executeRaw` (Prisma Client không có kiểu cho `Unsupported`). Sau khi tạo migration, chạy `prisma migrate diff` kiểm tra không báo drift/đòi xoá index (cần xác nhận trên phiên bản Prisma đang dùng, 6.19).

### Số chiều theo model dự kiến (cần xác nhận lại khi chọn)
| Model (ví dụ) | Chiều | Ghi chú |
|---|---|---|
| OpenAI `text-embedding-3-small` | 1536 (có thể giảm bằng tham số `dimensions`) | Đa ngôn ngữ, rẻ |
| OpenAI `text-embedding-3-large` | 3072 (giảm xuống ≤ 2000 mới đánh index HNSW trên kiểu `vector`) | Chất lượng cao hơn |
| Cohere `embed-multilingual-v3` | 1024 | Đa ngôn ngữ |
| Google `gemini-embedding` | cấu hình được | Kiểm tra tài liệu |
| Model tự host (multilingual-e5, bge-m3…) | 768–1024 | Cần hạ tầng |

Khuyến nghị: chọn 1024–1536 chiều. Kiểu `vector` của pgvector đánh index được tối đa 2000 chiều; muốn nhiều hơn dùng `halfvec`. **Đổi N = migration + embed lại toàn bộ**, nên chốt trước (quyết định #2 ở `00-overview`).

### Chọn index
- 125 sản phẩm: quét tuần tự (exact) đã đủ nhanh; vẫn tạo HNSW để thiết kế không phải đổi khi catalog lớn.
- **HNSW** (khuyến nghị): không cần dữ liệu có sẵn để huấn luyện, recall tốt. **IVFFlat**: chỉ đáng dùng khi dữ liệu lớn và cần tiết kiệm RAM; cần `lists` hợp lý và tạo index *sau* khi đã có dữ liệu.
- Metric: cosine (`vector_cosine_ops`), truy vấn bằng toán tử `<=>`. Khi kết hợp `WHERE` lọc cứng + HNSW, kết quả có thể ít hơn `LIMIT` (lọc sau khi quét index); với quy mô này hãy lọc cứng trước rồi sắp xếp theo `<=>` (xem `02-semantic-search.md`).

## 4. Chiến lược cập nhật embedding

`contentHash = sha256(content + "|" + model + "|" + templateVersion)`.

| Sự kiện | Hành động |
|---|---|
| Tạo sản phẩm | Sau khi commit transaction tạo `Product` + `ProductVariant`, dựng `content`, tính hash, gọi `embed`, `upsert` vào `ProductEmbedding` |
| Sửa trường nằm trong template (`name`, `description`, `brand`, `material`, `style`, `occasion`, `season`, `gender`, `tags`, `category`, tập màu) | Dựng lại `content`; **hash khác → embed lại**; hash trùng → bỏ qua (tránh tốn tiền) |
| Sửa `basePrice`, `isFeatured`, `stock`, `price` biến thể, ảnh | Không đụng embedding |
| `isActive = false` | Giữ embedding; truy vấn luôn lọc `isActive` |
| Xoá sản phẩm | `ON DELETE CASCADE` tự xoá embedding |
| Đổi model hoặc `templateVersion` | Hash của mọi dòng đổi → chạy lại job reconcile |

Cơ chế (đề xuất):
1. **Job reconcile** `npm run ai:embed` (`scripts/ai/embed.ts`, chạy bằng `tsx`, **CHƯA CÓ**): duyệt mọi sản phẩm, dựng `content`, so hash với DB, chỉ embed dòng khác/thiếu, gửi theo lô. Chạy được lặp lại an toàn (idempotent).
2. **Móc vào Admin**: điểm móc **ĐÃ CÓ** nhưng thân hàm rỗng: `syncProductEmbedding(productId)` ở `src/server/services/product-hooks.ts`, được `admin-product.service.ts` gọi sau mỗi lần tạo/sửa/ẩn-hiện/xoá sản phẩm và nhập kho (ngoài transaction, lỗi chỉ ghi log). Khi làm embedding chỉ cần điền thân hàm (không chặn người dùng; lỗi embed để job reconcile bù).
3. Cron nhẹ (hoặc bấm tay trong Admin) chạy reconcile để vá các lỗi tạm thời.
4. Giữ `content` trong bảng để biết chính xác văn bản nào đã được embed.

## 5. Đánh giá chất lượng dữ liệu seed hiện tại

### Điểm tốt (đã kiểm)
- 125/125 sản phẩm có `description` > 200 ký tự (min 322, TB 389), đủ `style`, `occasion`, `season`, `tags` (4–6 tag).
- Dải giá 99.000–1.290.000đ; 24 màu; 9 thương hiệu; 84/1.113 biến thể hết hàng (tình huống thật cho bộ lọc còn hàng).

### Vấn đề cần xử lý trước khi làm AI
| # | Vấn đề (kèm bằng chứng) | Hệ quả | Đề xuất |
|---|---|---|---|
| 1 | ✅ **Đã xử lý (2026-11-10, xem mục 6)** — trước đó `occasion` không có từ vựng đóng: ~46 giá trị, nhiều cặp gần nghĩa ("du lịch" 23 vs "đi du lịch" 2; "hẹn hò" 21 vs "đi hẹn hò" 1; "đi nghe nhạc" 4 vs "nghe nhạc" 1; "đi chùa" vs "đi lễ chùa"; "dự sự kiện" 9 vs "đi sự kiện" 1; "tập thể thao" vs "chơi thể thao"…) | Bộ lọc `occasion` so khớp **chính xác** (`hasSome`), LLM chọn sai biến thể là mất kết quả | Chuẩn hoá về ~15–20 giá trị chuẩn trong seed; giữ bảng đồng nghĩa trong code |
| 2 | ✅ **Đã xử lý (2026-11-11, tuỳ chọn `includeUnisex`)** — trước đó bộ lọc `gender=men` loại UNISEX: `catalog.service.ts` so sánh `gender` bằng đúng giá trị enum, trong khi 45/125 sản phẩm là UNISEX | Truy vấn "đồ nam" bỏ sót gần 40% kho phù hợp | Với AI: ánh xạ "nam" → {MEN, UNISEX} (cần mở rộng filter, xem `04`) |
| 3 | ✅ **Đã xử lý (2026-11-11)** — trước đó `productFilterSchema` không có bộ lọc `season` dù cột có sẵn | Không thể đưa "mùa hè" thành lọc cứng | Đã thêm `season` vào schema + `productWhere` (xem mục 6) |
| 4 | **`material` ~50 giá trị tự do** ("Cotton 100%", "Cotton compact 250gsm", "Cotton poplin"…) | Lọc chính xác theo chuỗi khó cho LLM | Thêm `materialGroup` (cotton, linen, len, denim, da, tổng hợp…) hoặc để embedding xử lý |
| 5 | **Thiếu thông tin ngoài trời/thời tiết/dress code** ("ngoài trời", "trang trọng", "smart casual") | Không trường nào ghi nhận; chỉ có `occasion` và `style` | Thêm tag chuẩn (vd `ngoài trời`, `thoáng mát`, `chống nắng`) hoặc trường `dressCode` |
| 6 | ✅ **Đã xử lý (2026-11-12: thêm 5 sản phẩm nam dự tiệc mùa hè)** — trước đó dữ liệu đám cưới nam rất mỏng: chỉ 4 sản phẩm có "dự đám cưới", 1 sản phẩm nam (`ao-blazer-nam-slim-fit`, **không có hè**). Nay có 9 sản phẩm "dự đám cưới", 6 nam | Câu mẫu "đồ nam đám cưới ngoài trời mùa hè" sẽ khó đạt kết quả lý tưởng (xem `02`) | Bổ sung sản phẩm hoặc nới tiêu chí "nearest match" |
| 7 | **Mô tả sinh theo khuôn**: câu "Thích hợp để …, dễ mặc vào mùa X và mùa Y và mùa Z" lặp lại ở nhiều sản phẩm | Các sản phẩm cùng category có văn bản gần giống nhau → embedding ít phân biệt | Viết lại mô tả độc đáo cho nhóm sản phẩm chủ lực; bớt câu khuôn |
| 8 | **`SizeChart` không có giới tính** (áo sơ mi nam và nữ dùng chung 1 bảng), không có độ ôm (slim/regular/oversize), không có chiều dài/vai, `phu-kien` không có bảng | Tư vấn size sai cho nữ/nam; không cảnh báo form rộng/ôm | **Đã làm (2026-11-12):** không thêm cột `gender`; danh mục đã tách Nam / Nữ / Unisex nên bảng size tách theo category lá. Số đo là số đo cơ thể; bảng nữ là ước lượng. Cột `fit` vẫn CHƯA CÓ; xem `03` mục 3 |
| 9 | **Chăm sóc chỉ suy ra từ `material`** bằng regex (`src/lib/care.ts`), không có trường riêng | Nội dung chung, không theo từng sản phẩm | Thêm `careInstructions` hoặc soạn tài liệu chăm sóc theo nhóm chất liệu |
| 10 | **Gợi ý phối đồ chỉ là câu văn trong `description`**, không có quan hệ có cấu trúc giữa sản phẩm | Mix & Match phải dựa vào quy tắc + tìm kiếm, không có dữ liệu "đã phối sẵn" | Soạn quy tắc phối đồ (xem `03`) |
| 11 | `ProductImage` không có cột màu (đã ghi trong `src/types/catalog.ts`) | AI không biết ảnh nào ứng với màu nào | Chưa cần cho giai đoạn này |
| 12 | `style` là token tiếng Anh, người dùng nói tiếng Việt | LLM phải ánh xạ "lịch sự/thanh lịch/công sở" → `formal`/`elegant`/`smart-casual` | Dùng `facets.styles` + bảng đồng nghĩa trong prompt |

### Việc bổ sung tối thiểu (khuyến nghị ưu tiên)
1. Chuẩn hoá `occasion` (#1) · 2. Thêm `season` vào filter (#3) · 3. Sửa nghĩa `gender` cho AI (#2) · 4. Thêm vài tag ngữ cảnh (#5) · 5. Bổ sung 3–5 sản phẩm nam dự tiệc/đám cưới mùa hè (#6) · 6. `SizeChart` theo giới tính (#8; **đã làm** bằng cách tách bảng theo danh mục Nam/Nữ/Unisex). Cả 6 việc đã xong, trừ #4 (tag chuẩn) làm một phần.

## 6. Kế hoạch chuẩn hoá dữ liệu (đã thực hiện)

**Quyết định (2026-11-10):** chuẩn hoá **trước** khi làm Semantic Search, và gộp cùng đợt thiết kế lại danh mục nam/nữ để không sửa seed hai lần. Kho kiến thức viết hoàn toàn bằng tiếng Việt, dùng cùng từ vựng với dữ liệu sản phẩm.

| # | Hạng mục | Việc cần làm | Chạm vào |
|---|---|---|---|
| 1 | Chuẩn hoá `occasion` — **XONG** | Đã gộp ~46 giá trị về 23 giá trị chuẩn theo bảng dưới (21 sản phẩm đổi `occasion`); hoạt động chi tiết (yoga, golf…) đã thêm vào `tags` (14 tag mới). `OCCASIONS` trong `vocab.ts` là từ vựng đóng, `ProductSeed.occasion` kiểu `Occasion[]` nên sai giá trị là lỗi biên dịch; test `src/test/seed-vocab.test.ts` kiểm tra thêm | `prisma/seed-data/products/*.ts`, `vocab.ts`, `types.ts` |
| 2 | Lọc `season` — **XONG** | `season` (mảng, `hasSome`) trong `productFilterSchema` và `productWhere`; đi vào URL (`FILTER_LIST_KEYS`) và hiện chip "Mùa: …" ở `use-product-filters`; chưa có ô chọn mùa trong panel lọc (không có facet mùa) | `src/lib/validators/product-filter.ts`, `catalog.service.ts`, `src/hooks/use-product-filters.ts` |
| 3 | Nghĩa của `gender` cho AI — **XONG** | `listProducts(input, { includeUnisex: true })`: nam/nữ gồm cả UNISEX; `gender=unisex` luôn chỉ UNISEX; mặc định `false` nên giao diện web không đổi. Tuỳ chọn nằm ngoài bộ lọc URL | `catalog.service.ts` |
| 4 | Sản phẩm nam dự tiệc/đám cưới mùa hè — **XONG** | Đã thêm 5 sản phẩm (blazer linen, gile linen, sơ mi Tencel, quần tây, nơ cổ lụa); 4 món quần áo có tag `ngoài trời`, `thoáng mát`, riêng nơ cổ lụa (phụ kiện) không có; test `src/test/seed-categories.test.ts` | seed |

Cả 4 hạng mục đã xong. Còn lại: đo lại 15 truy vấn mẫu ở `02` khi làm Semantic Search.

### Bảng gộp `occasion` (đã áp dụng vào seed)
Số trong ngoặc là số sản phẩm trước khi gộp (đếm từ DB ngày 2026-11-10). Sau khi gộp, số sản phẩm mỗi giá trị chuẩn (kiểm từ dữ liệu seed đã build): đi chơi 69, đi làm 49, đi cafe 39, dạo phố 35, đi học 25, du lịch 25, hẹn hò 22, đi họp 15, dự tiệc 14, đi biển 11, dự sự kiện 10, tập thể thao 8, đi phượt 7, đi nghe nhạc 5, du lịch mùa đông 5, dự đám cưới 4, chụp ảnh 3, đi phỏng vấn 3, đi xe máy 3, đi lễ chùa 2, ở nhà 1, dịp Tết 1, công tác 1. (Số liệu trên là trước khi thêm 5 sản phẩm nam dự tiệc ngày 2026-11-12; `dự đám cưới` hiện là 9.) **DB cần seed lại** (`npm run db:seed`) mới nhận dữ liệu mới.

| Giá trị chuẩn | Gộp từ |
|---|---|
| đi làm | đi làm (48), đi làm bằng xe máy (1) |
| công tác | công tác (1) |
| đi họp | đi họp (15) |
| đi phỏng vấn | đi phỏng vấn (3) |
| đi học | đi học (25) |
| đi chơi | đi chơi (68), đi chơi tối (1), đi picnic (2) |
| dạo phố | dạo phố (34), đi chợ (1) |
| đi cafe | đi cafe (39) |
| hẹn hò | hẹn hò (21), đi hẹn hò (1) |
| dự tiệc | dự tiệc (13), dự tiệc trà (1) |
| dự sự kiện | dự sự kiện (9), đi sự kiện (1) |
| dự đám cưới | dự đám cưới (4) |
| dịp Tết | dịp Tết (1) |
| đi lễ chùa | đi chùa (1), đi lễ chùa (1) |
| du lịch | du lịch (23), đi du lịch (2) |
| du lịch mùa đông | du lịch mùa đông (5) |
| đi biển | đi biển (11) |
| đi phượt | đi phượt (7), leo núi (1) |
| đi xe máy | đi xe máy (2), lái xe (1) |
| tập thể thao | tập thể thao (6), chơi thể thao (1), chạy bộ (3), tập yoga (1), chơi tennis (1), chơi golf (1) |
| đi nghe nhạc | đi nghe nhạc (4), nghe nhạc (1) |
| chụp ảnh | chụp ảnh (1), chụp ảnh kỷ niệm (1), chụp ảnh kỷ yếu (1) |
| ở nhà | ở nhà (1) |

Hoạt động cụ thể bị gộp (yoga, golf, tennis, chạy bộ, leo núi, picnic, kỷ niệm/kỷ yếu, tiệc trà…) đã được thêm vào `tags` của sản phẩm tương ứng để vẫn tìm được bằng từ khoá và embedding. Muốn thêm dịp mới: thêm vào `OCCASIONS` trong `prisma/seed-data/vocab.ts` rồi dùng trong dữ liệu sản phẩm.
