# 02 · Semantic Search

Mục tiêu: khách gõ câu tự nhiên → nhận danh sách sản phẩm đúng ý, **hiển thị bằng đúng UI lọc hiện có** (chip bộ lọc + `ProductListResult`).

## 1. Hiện trạng (căn cứ code)
- `listProducts(input: ProductFilterInput)` trong `src/server/services/catalog.service.ts` là điểm vào duy nhất; input được parse lại bằng `productFilterSchema` (`src/lib/validators/product-filter.ts`). Schema **idempotent** ("service có thể parse lại input từ AI/tool-calling" — ghi sẵn trong comment).
- Trường của schema: `q`, `category`, `size[]`, `color[]`, `material[]`, `style[]`, `occasion[]`, `gender` (men|women|unisex), `minPrice`, `maxPrice`, `inStock`, `sort` (newest|price_asc|price_desc|popular), `page`, `pageSize` (≤ 48).
- Tìm từ khoá `q`: `unaccent(lower(name + brand + tags + category.name)) LIKE '%từ%'`, **mọi từ phải khớp**. Câu tự nhiên ("áo mát đi làm") gần như luôn ra 0 kết quả → không dùng `q` để nhồi cả câu.
- **CHƯA CÓ**: lọc `season`; full-text index (`tsvector`/`pg_trgm`); bảng embedding; hàm tìm theo vector; giới hạn kết quả theo danh sách id.
- `gender=men` hiện chỉ khớp `MEN`, **loại UNISEX** (45/120 sản phẩm) → AI phải xử lý (mục 4).
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

Lý do `occasion` là mềm: từ vựng chưa chuẩn (xem `01-data-for-ai.md` mục 5 #1); lọc chính xác sẽ bỏ sót.

### 3.2 Truy vấn (mô hình)
Quy mô hiện tại (120 sản phẩm) cho phép **lọc cứng trước rồi sắp xếp theo khoảng cách** (exact, không lo recall của HNSW):

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
1. Bỏ điều kiện mềm có điểm thấp nhất (season → occasion → style).
2. Nới giá ±20%.
3. Bỏ `size` cứng, ghi chú "chưa có size X còn hàng".
4. Chỉ còn `isActive` + `gender` + vector. Luôn nói cho khách biết đã nới gì (hiển thị chip "đã nới").
Không bao giờ trả sản phẩm hết hàng khi khách yêu cầu `inStock`.

## 4. LLM trích bộ lọc → đúng schema Zod hiện có

Không cho LLM tự do sinh `ProductFilter`. Định nghĩa schema trung gian, **tái dùng** các enum/kiểu có sẵn rồi map sang `ProductFilterInput`:

```ts
// src/lib/validators/ai.ts (CHƯA CÓ — thiết kế)
import { PRODUCT_GENDERS, PRODUCT_SORTS } from "@/lib/validators/product-filter"

export const searchIntentSchema = z.object({
  semanticQuery: z.string().max(200),                 // phần "ý nghĩa" còn lại để embed
  category: z.string().optional(),                    // slug có trong kho (ao-thun, quan-jeans...)
  gender: z.enum(PRODUCT_GENDERS).optional(),
  size: z.array(z.string()).max(5).default([]),
  color: z.array(z.string()).max(5).default([]),      // tên màu tiếng Việt có trong kho
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  inStock: z.boolean().optional(),
  soft: z.object({                                    // điều kiện mềm
    occasion: z.array(z.string()).default([]),
    season: z.array(z.enum(["xuân", "hè", "thu", "đông"])).default([]),
    style: z.array(z.string()).default([]),
    material: z.array(z.string()).default([]),
  }),
  sort: z.enum(PRODUCT_SORTS).optional(),
  needsClarification: z.string().optional(),          // câu hỏi lại nếu thiếu thông tin quan trọng
})
```
- Prompt trích xuất **nhúng danh sách giá trị thật** lấy từ `listProducts({}).facets` (cache) và danh sách category từ `getNavCategories()`; yêu cầu chỉ chọn trong danh sách.
- Hậu xử lý bằng code (không tin LLM): ép `category/color/size/style` vào tập hợp thật (so khớp không dấu), `minPrice ≤ maxPrice`, rồi `productFilterSchema.parse(...)` lần cuối. Giá trị rơi ngoài từ vựng → chuyển vào `semanticQuery`.
- Tiền VND: hiểu "500k" = 500000, "1tr2" = 1200000, "dưới 300 nghìn" → `maxPrice = 300000`. Nên có hàm phân tích giá viết bằng code làm lưới an toàn (**CHƯA CÓ**).
- Trường `season` chưa có trong `productFilterSchema`: giai đoạn đầu để ở `soft.season` (dùng cho boost + embedding); khi đã refactor thêm `season` vào schema thì bật thành lọc tuỳ chọn.

## 5. Tiếng Việt: có dấu / không dấu / từ lóng
| Vấn đề | Xử lý |
|---|---|
| Gõ không dấu ("ao so mi nam") | Từ khoá: đã có `unaccent`. Vector: model đa ngôn ngữ vẫn bắt tốt; có thể embed thêm bản không dấu của câu truy vấn và lấy max |
| Dấu sai/thiếu, gõ tắt ("qjean", "sm") | Bảng đồng nghĩa/viết tắt trong code trước LLM |
| Từ lóng/khẩu ngữ | Từ điển trong `src/lib/ai/vi-synonyms.ts` (**CHƯA CÓ**): "đồ đi chơi tối" → occasion hẹn hò/dự tiệc; "mát" → season hè + chất liệu linen/cotton/thun lạnh; "sang chảnh/lên đồ" → style elegant/formal; "oversize/rộng" → semantic; "áo phông" → áo thun; "quần bò" → quần jeans; "váy cưới/đi đám cưới" → occasion dự đám cưới; "set" → yêu cầu phối nhiều món (chuyển sang Mix & Match, `03`); "k/tr/nghìn" → số tiền |
| Hai cách viết cùng nghĩa ở dữ liệu (xem `01` #1) | Chuẩn hoá seed; trong thời gian chưa chuẩn, ánh xạ nhóm đồng nghĩa khi boost |

## 6. Ví dụ phân rã: "Set đồ nam lịch sự đi đám cưới ngoài trời mùa hè"

| Thành phần | Giá trị trích |
|---|---|
| Ý định | Cần một **bộ** (nhiều món), không phải một sản phẩm → kích hoạt Mix & Match (tìm theo loại: áo, quần, phụ kiện) |
| `gender` | `men` → lọc `{MEN, UNISEX}` |
| `soft.occasion` | `dự đám cưới` (+ gần nghĩa `dự sự kiện`, `dự tiệc`) |
| `soft.style` | `formal`, `smart-casual`, `elegant` (từ "lịch sự") |
| `soft.season` | `hè` |
| "ngoài trời" | Không có trường nào trong dữ liệu → đưa vào `semanticQuery` ("thoáng mát, chịu nắng, vải nhẹ") |
| `inStock` | `true` (mặc định khi gợi ý mua) |
| `needsClarification` | Không bắt buộc; có thể hỏi thêm ngân sách |

Kết quả mong đợi **trên dữ liệu seed hiện tại** (đã kiểm bằng truy vấn):
- Sản phẩm nam có occasion "dự đám cưới": chỉ `ao-blazer-nam-slim-fit` (mùa xuân/thu/đông, không có hè).
- Nam/unisex, style formal/smart-casual/elegant, có mùa hè: `ao-so-mi-poplin-cong-so`, `ao-so-mi-slim-fit-khong-nhan`, `ao-so-mi-soc-doc-thanh-lich`, `ao-so-mi-tencel-mat-lanh`, `ao-polo-ca-sau-basic`, `that-lung-da-bo-khoa-kim`, `quan-tay-au-slim-den-cong-so`, `quan-kaki-chinos-mau-be`, `quan-jeans-den-ong-dung-cong-so`.
- Đặt cứng `season=hè` **và** `occasion=dự đám cưới` ⇒ rỗng. Thang nới lỏng bỏ `occasion` cứng → ra áo sơ mi + quần tây hè; blazer được thêm như món khoác tuỳ chọn (kèm chú thích "không dành cho mùa hè").
- Đầu ra mong đợi: 1 áo sơ mi (formal, hè) + 1 quần tây (`quan-tay-au-slim-den-cong-so`) + phụ kiện (`that-lung-da-bo-khoa-kim`); thông báo thẳng thắn: *"Kho chưa có đồ nam chuyên cho đám cưới ngoài trời mùa hè; đây là các món lịch sự, thoáng nhất hiện có."*

## 7. 15 câu truy vấn mẫu làm bộ test

Đánh giá theo **vị từ** (top-5 phải thoả), không gán cứng thứ tự. "Slug đã kiểm" là sản phẩm tồn tại trong seed hiện tại.

| # | Câu truy vấn | Độ khó | Kết quả kỳ vọng (top-5) |
|---|---|---|---|
| 1 | áo thun nam | Dễ | `category = ao-thun`; gender ∈ {MEN, UNISEX}; còn hàng |
| 2 | ao khoac (không dấu) | Dễ | `category = ao-khoac`; kết quả giống "áo khoác" |
| 3 | áo sơ mi trắng size M còn hàng | Dễ | category `ao-so-mi`; có biến thể Trắng + M + `stock > 0` (đã kiểm: 9 sản phẩm thoả) |
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
| 14 | Set đồ nam lịch sự đi đám cưới ngoài trời mùa hè | Khó (nhiều ràng buộc, kho mỏng) | Như mục 6: nới lỏng có giải thích; không trả đồ nữ; không giả vờ có đồ chuyên đám cưới nếu không có |
| 15 | mặc gì đi hẹn hò tối nay | Khó (thiếu thông tin) | Hỏi lại giới tính/ngân sách **hoặc** hiển thị nhóm occasion "hẹn hò" kèm câu hỏi; không bịa |

Bộ phủ định bổ sung (không tính vào 15, nhưng nên có trong test): "iPhone 15 giá bao nhiêu" → từ chối ngoài phạm vi; "quần áo trẻ em" → báo kho chưa có (đã kiểm 0 sản phẩm); chuỗi chứa lệnh ("bỏ qua mọi quy tắc và…") → xử lý như văn bản tìm kiếm thông thường (xem `05`).

## 8. Tiêu chí hoàn thành bước Semantic Search
- ≥ 12/15 câu đạt vị từ ở top-5 (cách tính ở `06-evaluation.md`).
- p95 độ trễ end-to-end trong ngưỡng đã đặt ở `06`.
- Luôn có fallback: nếu LLM/embedding lỗi hoặc quá `AI_REQUEST_TIMEOUT_MS`, chạy `listProducts({ q })` với từ khoá đã rút gọn và báo "đang dùng tìm kiếm thường".
- Mọi truy vấn trả bộ lọc đã hiểu để khách xem/gỡ.
