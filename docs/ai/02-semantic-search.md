# 02 · Semantic Search

Mục tiêu: khách gõ câu tự nhiên → nhận danh sách sản phẩm đúng ý, **hiển thị bằng đúng UI lọc hiện có** (chip bộ lọc + `ProductListResult`).

> **Trạng thái (2026-11-13): phần dịch vụ đã làm xong** (`src/server/ai/search/`: `intent.ts`, `search.service.ts`; `listProducts` có `onlyIds`). **Đã nối vào trang `/products?q=…`** (`src/components/product/product-listing.tsx`) : hiểu câu bằng code (từ điển, giá, size, màu, xếp theo từ khoá) cho mọi người, kể cả khách và khi AI tắt; phần vector chỉ cho người đã đăng nhập khi AI bật (AI cần tài khoản, quá 8 giây chờ embedding thì lùi về từ khoá); trang danh mục có `category` giữ lọc cũ; chưa nối vào chat/tool. Khác thiết kế gốc: **bước 1 "LLM trích ý định" chưa dùng**; ý định được hiểu hoàn toàn bằng code (từ điển lóng `vi-synonyms.ts`, hàm giá `vi-price.ts`, tên màu và size nhận từ kho) vì đo thực tế `qwen3:4b-instruct` bịa giá, chọn sai danh mục và giới tính. Điều kiện cứng chỉ do code quyết định; LLM có thể được thêm sau cho điều kiện mềm nếu đo thấy có lợi. Kết quả chấm 15 truy vấn mẫu xem ở mục 8.

## 1. Hiện trạng (căn cứ code)
- `listProducts(input: ProductFilterInput)` trong `src/server/services/catalog.service.ts` là điểm vào duy nhất; input được parse lại bằng `productFilterSchema` (`src/lib/validators/product-filter.ts`). Schema **idempotent** ("service có thể parse lại input từ AI/tool-calling" — ghi sẵn trong comment).
- Trường của schema: `q`, `category`, `size[]`, `color[]`, `material[]`, `style[]`, `occasion[]`, `season[]`, `gender` (men|women|unisex), `minPrice`, `maxPrice`, `inStock`, `sort` (newest|price_asc|price_desc|popular), `page`, `pageSize` (≤ 48).
- Tìm từ khoá `q`: `unaccent(lower(name + brand + tags + category.name)) LIKE '%từ%'`, **mọi từ phải khớp**. Câu tự nhiên ("áo mát đi làm") gần như luôn ra 0 kết quả → không dùng `q` để nhồi cả câu.
- **CHƯA CÓ** (trước 2026-11-13): full-text index (`tsvector`/`pg_trgm`). Đã có sau đó: bảng embedding, tìm theo vector (`search/search.service.ts`), `listProducts(..., { onlyIds })` giữ thứ tự.
- Lọc `season` đã có (`season`, mảng, khớp khi trùng ít nhất một mùa).
- `gender=men` mặc định chỉ khớp `MEN`, **loại UNISEX** (45/125 sản phẩm). AI gọi `listProducts(input, { includeUnisex: true })` để "nam"/"nữ" gồm cả UNISEX (giao diện web không dùng tuỳ chọn này).
- Facet (`facets.styles/occasions/materials/colors/sizes/genders/price`) cho biết giá trị **thật** đang có trong kho: dùng làm từ vựng ràng buộc cho LLM.

## 2. Luồng truy vấn

```
câu khách ─► [0] chuẩn hoá & kiểm tra ─► [1] LLM trích ý định (structured) ─► [2] ánh xạ về từ vựng thật
         ─► [3] truy vấn lai: lọc cứng (SQL) ∩ (vector + từ khoá) ─► [4] hợp nhất RRF ─► [5] nới lỏng nếu quá ít
         ─► [6] trả ProductListResult + "bộ lọc đã hiểu" (chip) + lời giải thích ngắn
                         ▲ lỗi/timeout ở [1]/[3] ─► fallback: listProducts({ q: từ khoá đơn giản })
```

0. **Chuẩn hoá**: cắt độ dài (≤ 200 ký tự), bỏ ký tự điều khiển, cache theo chuỗi đã chuẩn hoá.
1. **Trích ý định** bằng LLM nhỏ/rẻ với `generateObject`-kiểu structured output (schema ở mục 4).
2. **Ánh xạ**: giá trị LLM đưa ra được ép vào từ vựng thật (facet + bảng đồng nghĩa); giá trị không có trong kho bị bỏ khỏi bộ lọc cứng và chuyển thành văn bản cho vector.
3. **Truy vấn lai**: xem mục 3.
4. **RRF** (Reciprocal Rank Fusion) trộn hạng vector và hạng từ khoá.
5. **Nới lỏng** theo thang (mục 3.3) để không trả rỗng.
6. Trả `ProductListResult` (kiểu có sẵn) cộng `appliedFilters` để UI hiện chip và cho khách gỡ từng chip.

## 3. Kết hợp lọc cứng + vector + full-text

### 3.1 Phân loại điều kiện
| Loại | Điều kiện | Cách áp |
|---|---|---|
| **Cứng** (sai là hỏng) | `isActive`, khoảng giá (`minPrice/maxPrice`), `inStock`, `size` (+ `color`) trên cùng biến thể, `category` khi khách nêu rõ loại | `WHERE` SQL — tái dùng đúng logic `productWhere`/`variantWhere` |
| **Cứng có điều kiện** | `gender` | Nam/Nữ → `{MEN|WOMEN, UNISEX}` (không phải so sánh bằng) |
| **Mềm** (cộng điểm) | `occasion`, `season`, `style`, `material`, tính chất ("mát", "ấm", "oversize") | Đi vào văn bản embedding + boost `array overlap` |

Lý do `occasion` là mềm: bộ lọc `occasion` so khớp chính xác và mỗi sản phẩm chỉ gắn khoảng 3 dịp (từ vựng đã đóng: 23 giá trị `OCCASIONS` trong `prisma/seed-data/vocab.ts`, xem `01-data-for-ai.md` mục 6), nên lọc cứng sẽ bỏ sót món hợp dịp nhưng không được gắn.

### 3.2 Truy vấn (mô hình)
Quy mô hiện tại (125 sản phẩm) cho phép **lọc cứng trước rồi sắp xếp theo khoảng cách** (exact, không lo recall của HNSW):

```sql
-- cosine distance: embedding <=> $queryEmbedding
SELECT p.id, e.embedding <=> $1::vector AS dist
FROM "Product" p JOIN "ProductEmbedding" e ON e."productId" = p.id
WHERE p."isActive" AND p."basePrice" BETWEEN $2 AND $3
  AND p.gender = ANY($4)                       -- {MEN,UNISEX}
  AND EXISTS (SELECT 1 FROM "ProductVariant" v
              WHERE v."productId" = p.id AND v.stock > 0 AND v.size = ANY($5))
ORDER BY dist LIMIT 50;
```
Từ khoá song song (hạng thứ hai): `unaccent(lower(...)) LIKE` theo **từng từ OR** (khác `searchProductIds` hiện tại là AND), xếp theo số từ khớp. Nâng cấp tuỳ chọn: `pg_trgm` hoặc `tsvector` + chỉ mục GIN (**CHƯA CÓ**, cần migration).

Hợp nhất: `score = Σ 1 / (60 + rank_i)` cho hai danh sách; cộng boost nhỏ cho mỗi điều kiện mềm khớp (`occasion`, `season`, `style`).

Để trả về cùng kiểu `ProductListResult` (kèm facet, ảnh, màu) mà không nhân đôi logic: thêm vào `catalog.service` một tham số giới hạn theo danh sách id có thứ tự (refactor ở `04-tool-calling.md` mục 4), rồi gọi lại `listProducts`.

### 3.3 Thang nới lỏng khi ít kết quả (< 3)
**Đã làm theo bản sửa (2026-11-13):** điều kiện mềm (dịp, mùa, phong cách) chỉ cộng điểm xếp hạng nên không cần "bỏ"; còn các bước nới theo thứ tự:
1. Bỏ `size` cứng, ghi chú "chưa có size X còn hàng".
2. Bỏ `color` cứng, báo lại.
3. Bỏ điều kiện loại sản phẩm, báo lại.
**Không bao giờ nới**: còn hàng (luôn chỉ trả sản phẩm có biến thể còn hàng), giới tính, và giá khách đã nêu ("dưới 500k" là cứng: nới giá ±20% như bản gốc sẽ trả sản phẩm 549.000đ, trái với ca mẫu 4 ở mục 7). Giá kiểu "tầm 500k" thì ngay từ đầu đã là khoảng ±20%. Luôn báo cho khách điều đã nới (`relaxed` trong kết quả).

## 4. LLM trích bộ lọc → đúng schema Zod hiện có

> **KHÁC THIẾT KẾ, không làm theo mục này.** Đo trên `qwen3:4b-instruct`: model bịa `minPrice`/`maxPrice` khi câu không nêu giá, trả `gender: unisex` thay cho "không rõ", chọn sai danh mục ("đồ đi biển cho nữ" ra áo polo). Nên bước hiểu câu hoàn toàn bằng code (`search/intent.ts`: từ điển lóng `lib/ai/vi-synonyms.ts`, hàm giá `lib/ai/vi-price.ts`, trích size/màu/giới tính/danh mục theo từ vựng thật của kho) và chỉ phần xếp hạng dùng vector. Schema `searchIntentSchema` dưới đây **không có trong code**; giữ lại làm tài liệu về hướng đã cân nhắc.

Không cho LLM tự do sinh `ProductFilter`. Định nghĩa schema trung gian, **tái dùng** các enum/kiểu có sẵn rồi map sang `ProductFilterInput`:

```ts
// (KHÔNG CÓ trong code: chỉ là thiết kế đã bỏ, xem lưu ý ở đầu mục này)
import { PRODUCT_GENDERS, PRODUCT_SORTS } from "@/lib/validators/product-filter"

export const searchIntentSchema = z.object({
  semanticQuery: z.string().max(200),                 // phần "ý nghĩa" còn lại để embed
  category: z.string().optional(),                    // slug danh mục có trong kho (ao-thun-nam, quan-jeans-nu, vay-dam…); gốc nam/nu/unisex gồm cả con
  gender: z.enum(PRODUCT_GENDERS).optional(),
  size: z.array(z.string()).max(5).default([]),
  color: z.array(z.string()).max(5).default([]),      // tên màu tiếng Việt có trong kho
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  inStock: z.boolean().optional(),
  soft: z.object({                                    // điều kiện mềm
    occasion: z.array(z.string()).default([]),         // thuộc 23 giá trị OCCASIONS
    season: z.array(z.enum(["xuân", "hè", "thu", "đông"])).default([]),
    style: z.array(z.string()).default([]),
    material: z.array(z.string()).default([]),
  }),
  sort: z.enum(PRODUCT_SORTS).optional(),
  needsClarification: z.string().optional(),          // câu hỏi lại nếu thiếu thông tin quan trọng
})
```
- Prompt trích xuất **nhúng danh sách giá trị thật** lấy từ `listProducts({}).facets` (cache) và danh sách category từ `getNavCategories()`; yêu cầu chỉ chọn trong danh sách.
- Hậu xử lý bằng code (không tin LLM): ép `category/color/size/style/occasion` vào tập hợp thật (`occasion` vào `OCCASIONS`; so khớp không dấu), `minPrice ≤ maxPrice`, rồi `productFilterSchema.parse(...)` lần cuối. Giá trị rơi ngoài từ vựng → chuyển vào `semanticQuery`.
- Tiền VND: hiểu "500k" = 500000, "1tr2" = 1200000, "dưới 300 nghìn". **ĐÃ CÓ** `parsePriceRange` ở `src/lib/ai/vi-price.ts` (57 test; chưa nối vào luồng tìm kiếm). Giá chỉ lấy từ hàm này, **bỏ mọi `minPrice`/`maxPrice` do LLM sinh**: đo thực tế `qwen3:4b-instruct` bịa giá khi câu không nêu giá. Quy ước: "dưới/nhỏ hơn" loại trừ mốc (`dưới 300 nghìn` → `maxPrice = 299999`), "không quá/tối đa" bao gồm mốc; "trên" loại trừ, "từ/tối thiểu/trở lên" bao gồm; số tiền không nêu hướng ("áo 500k", "tầm 500k") là khoảng ±20%; hiểu "củ", "chai", "lít", "rưỡi", "nửa triệu"; hai điều kiện mâu thuẫn thì bỏ cả hai.
- `season` đã có trong `productFilterSchema`: `soft.season` vẫn dùng để boost và embedding; chỉ chuyển thành lọc cứng `season` khi khách nói rõ ("chỉ", "bắt buộc") hoặc khi nới lỏng không còn cần thiết.

## 5. Tiếng Việt: có dấu / không dấu / từ lóng
| Vấn đề | Xử lý |
|---|---|
| Gõ không dấu ("ao so mi nam") | Từ khoá: đã có `unaccent`. Vector: model đa ngôn ngữ vẫn bắt tốt; có thể embed thêm bản không dấu của câu truy vấn và lấy max |
| Dấu sai/thiếu, gõ tắt ("qjean", "sm") | Bảng đồng nghĩa/viết tắt trong code trước LLM |
| Từ lóng/khẩu ngữ | Từ điển trong `src/lib/ai/vi-synonyms.ts` (**ĐÃ CÓ** dữ liệu và hàm `findSynonymHints`, test `vi-synonyms.test.ts`; **chưa nối vào luồng tìm kiếm**, gợi ý chỉ đưa cho bước LLM chứ không là bộ lọc cứng). Nội dung gồm: "đồ đi chơi tối" → occasion hẹn hò/dự tiệc; "mát" → season hè + chất liệu linen/cotton/thun lạnh; "sang chảnh/lên đồ" → style elegant/formal; "oversize/rộng" → semantic; "áo phông" → áo thun; "quần bò" → quần jeans; "váy cưới/đi đám cưới" → occasion dự đám cưới; "set" → yêu cầu phối nhiều món (chuyển sang Mix & Match, `03`); "k/tr/nghìn" → số tiền |
| Hai cách viết cùng nghĩa ở dữ liệu (xem `01` #1) | Đã chuẩn hoá seed về 23 giá trị `OCCASIONS` (`01` mục 6); lời khách vẫn phải ánh xạ về đúng các giá trị này |

## 6. Ví dụ phân rã: "Set đồ nam lịch sự đi đám cưới ngoài trời mùa hè"

| Thành phần | Giá trị trích |
|---|---|
| Ý định | Cần một **bộ** (nhiều món), không phải một sản phẩm → kích hoạt Mix & Match (tìm theo loại: áo, quần, phụ kiện) |
| `gender` | `men` → lọc `{MEN, UNISEX}` |
| `soft.occasion` | `dự đám cưới` (+ gần nghĩa `dự sự kiện`, `dự tiệc`) |
| `soft.style` | `formal`, `smart-casual`, `elegant` (từ "lịch sự") |
| `soft.season` | `hè` |
| "ngoài trời" | Không có trường riêng (chỉ có tag `ngoài trời` ở 4 sản phẩm dự tiệc mùa hè) → đưa vào `semanticQuery` ("thoáng mát, chịu nắng, vải nhẹ") |
| `inStock` | `true` (mặc định khi gợi ý mua) |
| `needsClarification` | Không bắt buộc; có thể hỏi thêm ngân sách |

Kết quả mong đợi **trên dữ liệu seed hiện tại** (đã kiểm bằng truy vấn):
- Sản phẩm nam có occasion "dự đám cưới": `ao-blazer-nam-slim-fit` (xuân/thu/đông) và 5 món mùa hè mới: `ao-blazer-linen-pha-mong-nhe`, `ao-gile-linen-du-tiec`, `ao-so-mi-tencel-ngan-tay-du-tiec`, `quan-tay-ong-dung-chong-nhan-mua-he` (4 món này có tag `ngoài trời`, `thoáng mát`) và `no-co-lua-du-tiec` (phụ kiện, tag `tiệc cưới`, `phù rể`, không có hai tag trên).
- Nam/unisex, style formal/smart-casual/elegant, có mùa hè: `ao-so-mi-poplin-cong-so`, `ao-so-mi-slim-fit-khong-nhan`, `ao-so-mi-soc-doc-thanh-lich`, `ao-so-mi-tencel-mat-lanh`, `ao-polo-ca-sau-basic`, `that-lung-da-bo-khoa-kim`, `quan-tay-au-slim-den-cong-so`, `quan-kaki-chinos-mau-be`, `quan-jeans-den-ong-dung-cong-so`.
- Đặt cứng `season=hè` **và** `occasion=dự đám cưới` cho nam ⇒ ra bộ 5 món trên, không còn rỗng. Vẫn giữ thang nới lỏng (bỏ `occasion` cứng) cho các trường hợp ít kết quả hơn (vd thêm ngân sách thấp).
- Đầu ra mong đợi: 1 áo sơ mi (`ao-so-mi-tencel-ngan-tay-du-tiec`) + 1 quần tây (`quan-tay-ong-dung-chong-nhan-mua-he`) + áo ngoài tuỳ chọn (blazer hoặc gile linen) + phụ kiện (`no-co-lua-du-tiec`). Chỉ nới lỏng và nói thẳng thắn khi người dùng thêm ràng buộc mà kho không đáp ứng (vd dưới 500k).

## 7. 15 câu truy vấn mẫu làm bộ test

Đánh giá theo **vị từ** (top-5 phải thoả), không gán cứng thứ tự. "Slug đã kiểm" là sản phẩm tồn tại trong seed hiện tại.

| # | Câu truy vấn | Độ khó | Kết quả kỳ vọng (top-5) |
|---|---|---|---|
| 1 | áo thun nam | Dễ | `category = ao-thun-nam` (hoặc `ao-thun-unisex` khi gộp unisex); gender ∈ {MEN, UNISEX}; còn hàng |
| 2 | ao khoac (không dấu) | Dễ | `category` là một trong `ao-khoac-nam`, `ao-khoac-nu`, `ao-khoac-unisex`; kết quả giống "áo khoác" |
| 3 | áo sơ mi trắng size M còn hàng | Dễ | các category `ao-so-mi-nam`, `ao-so-mi-nu`, `ao-so-mi-unisex`; có biến thể Trắng + M + `stock > 0` (đã kiểm 2026-11-12: 9 sản phẩm thoả; tồn kho là số ngẫu nhiên cố định theo seed, đo lại sau mỗi lần seed) |
| 4 | quần jeans nam dưới 500k | Dễ (ít kết quả) | Chỉ quần jeans, giá ≤ 499.999, MEN/UNISEX. Seed hiện có đúng 1: `quan-jeans-jogger-bo-gau` (479.000). Không được trả sản phẩm giá ≥ 500.000 |
| 5 | đồ đi biển cho nữ | Trung bình | Đủ nhóm "đi biển" của WOMEN/UNISEX, ví dụ `dam-maxi-di-bien`, `dam-hai-day-linen`, `quan-short-linen-lung-thun`, `mu-bucket-canvas`; không có áo khoác/đồ đông |
| 6 | váy đi đám cưới | Trung bình | WOMEN; ưu tiên `dam-ren-du-dam-cuoi`, `dam-satin-hai-day-du-tiec`, `ao-dai-cach-tan-lua-to-tam`; category `vay-dam` đứng đầu |
| 7 | áo sơ mi linen mát cho nam đi cafe | Trung bình | chất liệu linen; MEN/UNISEX; ví dụ `ao-so-mi-linen-ngan-tay-co-cuba`, `ao-so-mi-co-tru-phong-cach-a-dong` |
| 8 | quần short mát mẻ mùa hè | Trung bình | `quan-short-kaki-7-inch` và/hoặc `quan-short-linen-lung-thun` trong top-3; có mùa hè |
| 9 | đồ công sở nữ thanh lịch dưới 600k | Trung bình | WOMEN, style elegant/formal, occasion có "đi làm", giá ≤ 600.000 (ví dụ `dam-cong-so-but-chi` 599.000, `ao-so-mi-nu-co-no`) |
| 10 | áo khoác ấm đi du lịch mùa đông | Trung bình | Chọn từ nhóm "du lịch mùa đông": `ao-khoac-long-cuu-sherpa`, `ao-khoac-phao-long-vu-sieu-nhe`, `ao-khoac-da-dang-dai`; season có đông |
| 11 | phong cách Hàn Quốc dễ thương | Khó (từ khoá mơ hồ) | Chủ yếu trong 6 sản phẩm `style=korean` (`dam-babydoll-tay-bong`, `ao-cardigan-len-nu-cuc-ngoc-trai`…) |
| 12 | quà tặng bạn gái dưới 300k | Khó (suy ý định) | WOMEN/UNISEX, giá ≤ 300.000, nghiêng về `phu-kien` (ví dụ `khan-lua-vuong-hoa-van` 259.000, `tui-tote-canvas-day`, `day-chuyen-thep-khong-gi-mat-tron`) |
| 13 | áo oversize form rộng | Khó (thiếu dữ liệu có cấu trúc) | Không có trường "form": kết quả phải có "oversize" trong tên/tag/mô tả (ví dụ `ao-thun-oversize-tay-lo-tron`, `ao-so-mi-oversize-nu-cotton`); không trả áo "slim fit" |
| 14 | Set đồ nam lịch sự đi đám cưới ngoài trời mùa hè | Khó (nhiều ràng buộc) | Trả bộ nam dự tiệc mùa hè (5 món mới, xem trên); không trả đồ nữ; không bịa nếu thêm ràng buộc mà kho không đáp ứng |
| 15 | mặc gì đi hẹn hò tối nay | Khó (thiếu thông tin) | Hỏi lại giới tính/ngân sách **hoặc** hiển thị nhóm occasion "hẹn hò" kèm câu hỏi; không bịa |

Bộ phủ định bổ sung (không tính vào 15, nhưng nên có trong test): "iPhone 15 giá bao nhiêu" → từ chối ngoài phạm vi; "quần áo trẻ em" → báo kho chưa có (đã kiểm 0 sản phẩm); chuỗi chứa lệnh ("bỏ qua mọi quy tắc và…") → xử lý như văn bản tìm kiếm thông thường (xem `05`).

## 8. Tiêu chí hoàn thành bước Semantic Search

**Kết quả đo (2026-11-13)**, lệnh `npm run ai:search-check` (bộ 15 truy vấn và vị từ ở `src/test/ai/search-queries.ts`; `-- --keyword` để chạy đường lui bằng từ khoá), `bge-m3` 1024 chiều, 125 sản phẩm, một lần chạy mỗi truy vấn (khác `docs/ai/06` yêu cầu ≥ 3 lần nhưng không có LLM trong bước này nên kết quả ổn định giữa các lần):

| Chỉ số | Semantic | Từ khoá (đường lui) | Nền: từ khoá cả câu | Ngưỡng |
|---|---|---|---|---|
| Pass@5 | **15/15** | 13/15 | 2/15 | ≥ 12 |
| Precision@5 trung bình | **0,82** | 0,70 | – | ≥ 0,7 |
| Vi phạm lọc cứng trong top-5 | **0** | 0 | – | 0 |
| Độ trễ p50 / p95 | 74 / 374 ms (lượt chạy đầu sau khi để nghỉ: p95 tới khoảng 2,5 giây vì nạp lại model) | 17 / 100 ms | – | p95 ≤ 3 giây |

Lưu ý khi đọc kết quả: vị từ "đúng ý" do chúng tôi tự viết từ dữ liệu seed hiện tại (nên nó và dữ liệu cùng nguồn); ca 4 ("dưới 500k") chỉ trả 4 sản phẩm vì kho chỉ có 1 quần jeans nam dưới 500k và không nới giá; chưa đo Recall@10, chưa đo token vì bước này không gọi LLM; chưa mô phỏng lỗi LLM ngoài lỗi embedding (đường lui từ khoá có test tích hợp).
- ≥ 12/15 câu đạt vị từ ở top-5 (cách tính ở `06-evaluation.md`).
- p95 độ trễ end-to-end trong ngưỡng đã đặt ở `06`.
- Luôn có fallback: nếu LLM/embedding lỗi hoặc quá `AI_REQUEST_TIMEOUT_MS`, chạy `listProducts({ q })` với từ khoá đã rút gọn và báo "đang dùng tìm kiếm thường".
- Mọi truy vấn trả bộ lọc đã hiểu để khách xem/gỡ.
