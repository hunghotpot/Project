# 03 · RAG Advisor (tư vấn size, chăm sóc, phối đồ)

Nguyên tắc: **số liệu và quyết định dùng code + SQL; LLM chỉ diễn đạt và chọn trong tập ứng viên đã kiểm.** Dữ liệu dạng bảng (size) tra cứu chính xác, **không** dùng vector.

## 1. Nguồn tri thức

| Nguồn | Hiện trạng | Cách truy xuất | Ghi chú |
|---|---|---|---|
| **SizeChart** (DB) | Có: 83 dòng, mỗi category lá quần áo một bảng (`ao-thun-nam`, `quan-jeans-nu`, `quan-unisex`, `vay-dam`, `vest-du-tiec-nam`…; riêng Urban Ghost ở `ao-thun-unisex`); `phu-kien` không có | SQL theo `categoryId` + `brand` (brand riêng thắng bảng chung — `getSizeChartInfo`/`getSizeChart` trong `catalog.service.ts`, chọn dòng bằng `pickSizeChartRows` ở `src/lib/size-chart.ts`; `getProductBySlug` trả sẵn `sizeChart`) | Không có cột giới tính/độ ôm; xem mục 3 |
| **Chất liệu & chăm sóc** | Có sơ bộ: `getCareTips(material)` trong `src/lib/care.ts` (8 nhóm regex) + câu mô tả chất liệu trong `description` | Gọi `getCareTips` hoặc tra `KnowledgeChunk` loại `care` | Nội dung chung theo nhóm; **bạn cần soạn kỹ hơn** (mục 7) |
| **Quy tắc phối đồ** | **Đã có** (2026-11-13): 35 đoạn trong `docs/ai/knowledge/styling.md` + 23 dịp chuẩn trong `occasions.md`; bản nháp dùng tạm, cần chủ cửa hàng duyệt | `KnowledgeChunk` loại `styling` qua vector + lọc metadata; Mix & Match chọn món bằng code (mục 4.1) | Nội dung do bạn duyệt |
| **Kho hàng thực tế** | Có: `ProductVariant.stock`, `Product.isActive` | SQL lúc truy vấn (không embed) | Mọi gợi ý phải qua bước kiểm tồn kho |
| **Mô tả sản phẩm** | Có, đã định hướng embed (`01-data-for-ai.md`) | Vector search sản phẩm | |
| **Chính sách cửa hàng** (đổi trả, vận chuyển, thanh toán) | Một phần trong code: phí ship (`FREE_SHIPPING_THRESHOLD = 500_000`, `FLAT_SHIPPING_FEE = 30_000`, `src/lib/shipping.ts`), hạn thanh toán VNPay 15 phút (`PAYMENT_WINDOW_MINUTES`, `src/lib/order.ts`), gom thành trang chính sách ở `src/lib/policies.ts` (vận chuyển, thanh toán); **chính sách đổi trả và bảo mật CHƯA CÓ** (đang để "đang cập nhật") | `KnowledgeChunk` loại `policy` | Chỉ trả lời điều đã có trong tài liệu |

### Bảng chunk kiến thức (ĐÃ CÓ từ 2026-11-13)
> Bản đã làm khác mẫu dưới đây: `embedding` là `vector(1024)` (bge-m3), khoá tự nhiên `(source, title)` thay cho `id` tự sinh, có cột `source` (tên file nguồn), không có `templateVersion` riêng theo `model` mà dùng hằng `KNOWLEDGE_TEMPLATE_VERSION`, không có chỉ mục vector (94 đoạn quét tuần tự đủ nhanh). Xem `prisma/schema.prisma`, `src/server/ai/advisor/knowledge-*.ts` và ngưỡng truy xuất 0,45 trong `knowledge.service.ts`.
```prisma
model KnowledgeChunk {
  id              String   @id @default(cuid())
  type            String   // care | styling | policy | faq
  title           String
  content         String   // 1 ý hoàn chỉnh, 80–300 từ
  metadata        Json     // { categories?: string[], gender?: string, seasons?: string[], materials?: string[] }
  embedding       Unsupported("vector(1024)") // cùng N với ProductEmbedding (bge-m3)
  contentHash     String
  model           String
  templateVersion Int      @default(1)
  updatedAt       DateTime @updatedAt
}
```
Nguồn gốc nội dung: file Markdown trong `docs/ai/knowledge/*.md` (**đã có**: care, size-guide, policy, styling, occasions; 94 đoạn), mỗi `##` là một chunk; script nạp tính hash và chỉ embed phần đổi (cùng cơ chế `ProductEmbedding`).

### Cách chia chunk
- Theo **ý trọn vẹn**, không cắt theo số ký tự: một quy tắc phối đồ / một nhóm chất liệu / một câu hỏi thường gặp = một chunk (80–300 từ).
- Mỗi chunk mở đầu bằng tiêu đề tự mô tả ("Chăm sóc vải linen", "Phối quần jeans ống rộng") để embedding bắt đúng chủ đề.
- Metadata dùng để **lọc trước** khi tìm vector (ví dụ chỉ lấy chunk `styling` có `gender` phù hợp).
- Lấy top-k nhỏ (3–5), kèm khoảng cách; dưới ngưỡng tương đồng thì coi như **không có tri thức** (xem mục 6).

## 2. Luồng tư vấn size

### 2.1 Đầu vào (Zod, đã có)
```ts
// src/lib/validators/ai.ts
const measure = (min: number, max: number) => z.number().min(min).max(max).optional()

export const sizeAdviceInputSchema = z.object({
  productSlug: z.string().trim().min(1).max(100),
  heightCm: measure(100, 230),
  weightKg: measure(25, 250),
  chestCm: measure(60, 160),
  waistCm: measure(45, 160),
  hipCm: measure(60, 170),
  fit: z.enum(["tight", "regular", "loose"]).default("regular"),
})
```
Bản thiết kế ban đầu còn `categorySlug` (tư vấn theo danh mục, không cần sản phẩm) và `gender`: **CHƯA CÓ**; hiện chỉ tư vấn theo `productSlug`, và giới tính đã nằm trong category lá của sản phẩm nên không có tham số `gender`. Server action `getSizeAdviceAction` (`src/app/actions/size-advice.ts`) bắt buộc đăng nhập, parse bằng schema trên rồi gọi `adviseSizeForProduct` (`src/server/ai/advisor/size.service.ts`).

Số đo thuộc về người dùng nhập trong hội thoại; **không lưu vào DB** trừ khi bạn thêm tính năng hồ sơ số đo (CHƯA CÓ) và có đồng ý.

### 2.2 Thuật toán (code thuần, deterministic — đã có: `getSizeRecommendation` trong `src/server/ai/advisor/size.ts`)
1. Xác định bảng size: `adviseSizeForProduct` gọi `getProductBySlug(slug)` rồi `getSizeChartInfo(categoryId, brand)` (kèm cờ bảng riêng của brand → thêm ghi chú "Đang dùng bảng size riêng của thương hiệu …"). Loại sản phẩm `kind` suy ra từ slug category lá bằng `sizeKindOf`: `vay-dam` → `dress`; `quan-*` → `bottom`; `ao-*` và `vest-*` → `top`; còn lại (ví dụ `phu-kien`) → `other`. Không có bảng (ví dụ `phu-kien`) → trả `status: "no_chart"`, **không đoán**.
2. Thiếu dữ liệu tối thiểu → `status: "need_info"` kèm danh sách trường cần hỏi: tối thiểu **chiều cao + cân nặng**, hoặc **số đo cơ thể** thích hợp loại sản phẩm (áo: ngực; quần: eo; váy: ngực + eo + hông; loại `other`: một số đo bất kỳ). Hiện `missingFields` chỉ liệt kê `heightCm`/`weightKg` còn thiếu (ví dụ chỉ có chiều cao → `["weightKg"]`); chưa gợi ý trường vòng.
3. Chấm điểm từng size (càng thấp càng khớp):
   - `devH` = 0 nếu `heightMin ≤ h ≤ heightMax`, ngược lại khoảng cách tới biên gần nhất (cm); tương tự `devW` với cân nặng (kg).
   - `s = devH/5 + devW/4`; nếu có số đo cơ thể (ngực/eo/hông) thì cộng thêm **độ lệch trung bình** của các số đo đó `mean(|giá trị − số đo của bảng|)/3` (ngực/eo/hông trong bảng là một số cho mỗi size; bỏ qua số đo mà bảng không có, ví dụ ngực của quần).
   - Dùng độ lệch **trung bình** (không phải tổng) để điểm không phụ thuộc số lượng số đo khách cung cấp. Hằng số nằm trong `THRESHOLDS` ở `src/server/ai/advisor/size.ts`.
4. Quyết định:
   - `s_best > 1.5` ⇒ `status: "out_of_range"` (nằm ngoài bảng): nói rõ, không ép size.
   - Hai size đầu **liền kề nhau** trong bảng và có `s` chênh `< 0.5` ⇒ **nằm giữa hai size** (mục 2.3); độ tin cậy `medium` nếu `s_best ≤ 1`, ngược lại `low` (không bao giờ `high`).
   - Còn lại ⇒ size tốt nhất, độ tin cậy `high` nếu `s = 0`, `medium` nếu `s ≤ 1`, ngược lại `low`.
5. **Kiểm tồn kho** của size đề xuất cho sản phẩm cụ thể: `stockBySize` (size → danh sách màu còn `stock > 0`) cho ra `stock: { size, available, colors }`; chưa lọc theo màu khách chọn. Khi `recommended` mà size đề xuất hết hàng ⇒ thêm lý do nêu size liền kề còn hàng (nếu có). Với `between_two` hiện chỉ trả `stock` của size đề xuất, chưa cảnh báo size liền kề.
6. LLM nhận **kết quả đã tính** và chỉ diễn đạt lại (không tự tính size). **Đã nối** qua tool `getSizeRecommendation` (tool phát thẻ size từ kết quả của code, model chỉ tóm tắt bằng lời). Khi model không chịu gọi tool, cổng kiểm chứng (`chat/claims.ts`) thử lại; vẫn không được thì khách nhận câu trung thực "mình chưa tra được", không bao giờ một size do model tự nêu.

### 2.3 Khi nằm giữa hai size
| Điều kiện | Gợi ý |
|---|---|
| `fit = loose` (dáng suông/oversize của sản phẩm: **CHƯA CÓ**, code chỉ dùng `fit` khách chọn) | Chọn size **lớn hơn** |
| `fit = tight` | Chọn size **nhỏ hơn** |
| `fit = regular` | Mặc định size **lớn hơn** (an toàn hơn), kèm lý do |
| Chất liệu co giãn (`material` khớp "co giãn", "spandex", "thun") và `fit = regular` | Nghiêng size nhỏ hơn, nói rõ lý do |
| Váy/đầm (`kind = dress`) | Luôn chọn size **lớn hơn** (ngực/hông khó nới), bất kể `fit` |
| Quần (`kind = bottom`) | Ưu tiên vòng eo; nếu hông khách lớn hơn mốc hông của size nhỏ → size lớn hơn (xét trước `fit`) |

Thứ tự xét trong code: váy → quần (hông) → `fit` (`loose`/`tight`) → co giãn → mặc định lớn hơn. Luôn trình bày **cả hai size** và lý do, rồi hỏi khách thích mặc ôm hay rộng nếu chưa biết.

### 2.4 Ví dụ kiểm tra tay (theo bảng seed thật)
Bảng áo form regular của Nam/Unisex (`ao-so-mi-nam`, `ao-thun-nam`, `vest-du-tiec-nam`, `ao-so-mi-unisex`…; áo Nữ dùng số đo cơ thể nữ riêng, xem `prisma/seed-data/size-charts.ts`): S 160–167cm/50–58kg · M 165–172/58–66 · L 170–177/66–74 · XL 175–182/74–82.

| Ca | Đầu vào | `s` từng size | Kết quả mong đợi |
|---|---|---|---|
| A | 168cm, 60kg | M=0 · S=0,7 · L=1,9 | **M**, tin cậy cao (chênh với S ≥ 0,5) |
| B | 170cm, 66kg | M=0 · L=0 | **Giữa M và L**; `regular` → khuyên L, hỏi sở thích |
| C | 158cm, 48kg | S=0,9 | **S**, tin cậy trung bình, ghi chú "dưới mốc nhỏ nhất của bảng" |
| D | 185cm, 95kg | XL=3,85 | **out_of_range**, không tư vấn size |
| E | Quần jeans nam (`quan-jeans-nam`), eo 80cm | eo size 31=79, size 32=81 | **Giữa 31 và 32**; mặc định khuyên 32, nếu chất liệu co giãn → nghiêng 31 |
| F | Váy đầm (`vay-dam`), ngực 88/eo 70/hông 95 | độ lệch trung bình (cm): M=1,67 · L=2,33 · S=5,67 ⇒ điểm M≈0,56, L≈0,78 | **Giữa M và L** (chênh điểm 0,22 < 0,5); váy luôn chọn size lớn hơn ⇒ **L** |
| G | Chỉ có "tôi cao 1m70" | – | **need_info**: hỏi cân nặng hoặc số đo |
| H | Phụ kiện (`phu-kien`) | không có bảng | **no_chart**; nói đúng: sản phẩm không có bảng size, xem mô tả/size trên sản phẩm |
| I | Áo thun Urban Ghost (`ao-thun-unisex`), 165cm/58kg | Bảng riêng S 158–168/48–60 · M 163–173/56–68 | **Giữa S và M** (cả hai trong khoảng, `s` = 0); `regular` → khuyên M. Ghi chú bảng riêng: code hiện thêm "Đang dùng bảng size riêng của thương hiệu Urban Ghost"; ý "ngực 104–116cm, form rộng hơn bảng chung 88–100cm" **CHƯA có trong code** (test I truyền `chartNote` tự đặt) |

Bộ này dùng lại trong `06-evaluation.md`.

## 3. Hạn chế dữ liệu ảnh hưởng độ chính xác

**Đã chốt (2026-11-10):**
- Số đo trong `SizeChart` là **số đo cơ thể**. Thuật toán so số đo của khách trực tiếp với bảng.
- **Không có cột giới tính** trong `SizeChart`: danh mục đã tách thành cây Nam / Nữ / Unisex (2026-11-12), mỗi category lá một bảng size riêng (`SizeChart.categoryId`). Nam và Unisex dùng số đo form regular; Nữ dùng số đo cơ thể nữ (áo = bảng váy đầm; quần nữ size 26–32). **Số đo bảng nữ là ước lượng, chưa hiệu chỉnh với dữ liệu thật.**
- Bảng riêng của Urban Ghost (`ao-thun-unisex`, ngực 104–116cm) vẫn đang là số liệu của thương hiệu form rộng; khi dùng bảng này, câu trả lời phải ghi chú "form rộng hơn bảng chung" (xem ca I ở mục 2.4; code hiện mới ghi chú "bảng size riêng của thương hiệu", chưa có ý form rộng).

**Đã chốt (2026-11-13), 5 điểm thiết kế:**
1. `fit` mặc định là `regular`.
2. Dùng bảng riêng của Urban Ghost thì thêm ghi chú "form rộng hơn bảng chung" (**CHƯA có trong code**).
3. `between_two`: cảnh báo size liền kề còn hàng hay hết (**CHƯA có trong code**; hiện chỉ trả `stock` của size đề xuất).
4. `reasons` tối đa 4 dòng (khớp `reasons.max(4)`).
5. Tool `getSizeRecommendation` là lớp mỏng gọi `adviseSizeForProduct`; hàm thuần trong `size.ts` giữ tên cũ. LLM chỉ tách số đo từ câu chat rồi gọi tool; kết quả vẫn do code tính và vẽ thẻ từ kết quả đó.

**Còn hạn chế:**
- Bảng size nữ là số liệu ước lượng (xem trên); tư vấn size cho nữ có thể kém chính xác cho đến khi hiệu chỉnh.
- Không có **độ ôm** của từng sản phẩm (slim/regular/oversize): AI chỉ biết qua tên/mô tả.
- Chiều cao/cân nặng chồng lấn giữa size liền kề → ca "nằm giữa" xảy ra thường xuyên; luôn cần hỏi sở thích ôm/rộng.

## 4. Luồng Mix & Match (chỉ dùng hàng còn)

> **Đã làm 2026-11-13, khác thiết kế dưới đây ở bước 3: code chọn món, LLM không chọn.** Lý do: model 4B bịa điều kiện, bịa tên sản phẩm và hay bỏ qua tool (`04-tool-calling.md` mục 7), nên việc chọn món, kiểm tồn kho, tính tổng tiền và viết lý do từng món đều do code (`advisor/outfit.ts` là hàm thuần, `advisor/outfit.service.ts` nạp ứng viên từ DB); LLM chỉ tóm tắt kết quả bằng lời. Giới tính, dịp, mùa, ngân sách, size lấy bằng code từ các câu gần đây của khách (`wantedFrom`), chưa biết nam hay nữ thì hỏi lại (`NEED_GENDER`), không đoán. Xem mục 4.1.

```
Đầu vào: sản phẩm gốc (slug) HOẶC {dịp, giới tính, ngân sách, mùa}
 1. Xác định các "ô" cần có theo quy tắc phối (knowledge): ví dụ áo + quần/chân váy [+ áo khoác] [+ phụ kiện]
 2. Với mỗi ô trống: lấy ứng viên
      - lọc cứng: isActive, có biến thể stock > 0, gender tương thích (tính cả UNISEX), khung giá
      - xếp hạng: vector (câu truy vấn dựng từ quy tắc + sản phẩm gốc) + khớp style/occasion/season
      - giữ top 8 ứng viên mỗi ô (id đóng)
 3. LLM CHỌN trong tập ứng viên (chỉ được trả về id nằm trong danh sách) và viết lý do dựa trên quy tắc truy xuất
 4. Code kiểm lại: id ∈ ứng viên, còn hàng (đọc lại stock), tính tổng tiền bằng code, loại trùng
 5. Trả JSON outfit; khách bấm "Thêm cả bộ" ⇒ tool addToCart cần xác nhận (04)
```
Sản phẩm nào hết hàng toàn bộ biến thể (`inStock = false` trong `ProductCardData`) **không bao giờ** được đưa vào bước 3. Nếu một ô không có ứng viên hợp lệ, nói rõ "chưa có món phù hợp" thay vì nhồi món không hợp.

## 5. Schema JSON đầu ra (Zod, đề xuất)

```ts
export const sizeRecommendationSchema = z.object({
  status: z.enum(["recommended", "between_two", "need_info", "out_of_range", "no_chart"]),
  recommendedSize: z.string().nullable(),          // size cuối cùng gợi ý
  alternativeSize: z.string().nullable(),          // size còn lại khi nằm giữa
  confidence: z.enum(["high", "medium", "low"]),
  reasons: z.array(z.string()).max(4),             // dựa trên số liệu bảng, ví dụ "170cm nằm trong 170–177cm của size L"
  missingFields: z.array(z.enum(["heightCm", "weightKg", "chestCm", "waistCm", "hipCm", "fit"])).default([]),
  inStock: z.object({ size: z.string(), available: z.boolean(), color: z.string().nullable() }).nullable(),
  chartSource: z.object({ categorySlug: z.string(), brand: z.string().nullable() }).nullable(),
  followUpQuestion: z.string().nullable(),
})

export const outfitSchema = z.object({
  title: z.string().max(80),
  occasion: z.string().nullable(),
  items: z.array(z.object({
    slot: z.enum(["top", "bottom", "dress", "outer", "accessory"]),
    productId: z.string(),                         // phải thuộc tập ứng viên đã truy xuất
    slug: z.string(),
    variantId: z.string().nullable(),              // nếu đã chọn được size/màu còn hàng
    reason: z.string().max(200),                   // phải dựa trên quy tắc/ mô tả truy xuất
  })).min(2).max(5),
  totalPrice: z.number().int(),                    // do code tính, bỏ qua giá trị LLM
  knowledgeSources: z.array(z.string()),           // id/tiêu đề chunk đã dùng
  missingSlots: z.array(z.string()).default([]),   // ô không tìm được món phù hợp
  note: z.string().nullable(),
})
```
Hiện trạng (2026-11-14): `sizeRecommendationSchema` và `outfitViewSchema` (Zod) **đã có** trong `src/lib/validators/ai.ts` (cùng `sizeChartRowSchema`, `confirmViewSchema`) và được `lib/ai/chat-events.ts` dùng để kiểm từng dòng của luồng NDJSON phía client. Giao diện vẫn vẽ bằng kiểu thuần ở `src/types/assistant.ts` (không kéo Zod vào component): `SizeRecommendationView` (có `productName`, `stock: { size, available, colors }`, `message`; chưa có `chartSource`, `followUpQuestion`; `missingFields` chỉ gồm các trường số đo, không có `fit`) và `OutfitView` (món có `name`, `image`, `variantLabel`, `price`; chưa có `productId`, `variantId`). Hai kiểu này chưa thay bằng `z.infer`.

Khi dùng structured output của SDK, validate lại bằng cùng schema ở server; sai schema ⇒ thử lại 1 lần rồi fallback (câu trả lời thường, không JSON).

## 6. Quy tắc "không bịa"
1. Chỉ khẳng định điều **có trong dữ liệu truy xuất** (SizeChart, chunk kiến thức, sản phẩm). Mỗi câu về kích cỡ/chất liệu phải truy ngược được tới một dòng dữ liệu (`chartSource`, `knowledgeSources`).
2. Tri thức không đủ (similarity dưới ngưỡng, không có bảng size, không có chính sách) ⇒ nói "mình chưa có thông tin này" và **hỏi lại** hoặc gợi ý liên hệ cửa hàng. Không suy diễn.
3. Không đưa ra giá, tồn kho, khuyến mãi, thời gian giao từ trí nhớ của mô hình: luôn lấy từ service ở thời điểm trả lời.
4. Không tư vấn y tế/cơ thể (giảm cân, "bạn hơi béo"); chỉ nói theo số đo.
5. Không so sánh với thương hiệu ngoài kho; không hứa "chắc chắn vừa" — dùng mức tin cậy.
6. System prompt cho Advisor ghi rõ các điều trên; kiểm thử bằng các ca `need_info`, `no_chart`, `out_of_range` ở `06`.

## 7. Nội dung kiến thức bạn phải tự soạn

| # | Nội dung | Dạng | Số lượng gợi ý | Ghi chú |
|---|---|---|---|---|
| 1 | **Quy tắc phối đồ** theo loại món: áo × quần, váy, áo khoác, phụ kiện; quy tắc phối màu (cùng tông, tương phản, màu trung tính); phối theo dịp (đi làm, đám cưới, đi biển, hẹn hò) và theo mùa | Markdown, mỗi quy tắc một `##` | 30–50 chunk | **Quan trọng nhất**, kho hiện chưa có |
| 2 | **Hướng dẫn chọn size**: cách tự đo (ngực, eo, hông), mặc ôm/vừa/rộng, khác biệt theo loại đồ, form của từng thương hiệu (ví dụ Urban Ghost rộng hơn) | Markdown | 8–12 | Kèm xác định bảng là số đo cơ thể hay sản phẩm |
| 3 | **Chăm sóc theo chất liệu** (mở rộng `care.ts`): giặt, phơi, ủi, bảo quản cho cotton, linen, lụa/satin, len, denim, da, polyester, phụ kiện… | Markdown | 10–15 | Kiểm lại với nhãn mác thực tế |
| 4 | **Chính sách cửa hàng**: đổi trả, bảo hành, vận chuyển, thanh toán, hoàn tiền | Markdown | 5–10 | Đã có vận chuyển và thanh toán trong `src/lib/policies.ts`; đổi trả/bảo mật chưa có nội dung; chỉ điều bạn xác nhận mới được AI nói |
| 5 | **Từ điển đồng nghĩa/lóng** tiếng Việt cho thời trang (xem `02`, mục 5) | file TS/JSON | 50–100 mục | |
| 6 | **Bảng size bổ sung**: độ ôm, số liệu cho `phu-kien` (nếu cần); giới tính đã giải quyết bằng bảng riêng theo category lá | Dữ liệu seed | | |
| 7 | **Mô tả mỗi dịp (dress code)** cho danh sách `occasion` chuẩn (đã có 23 giá trị `OCCASIONS` trong `prisma/seed-data/vocab.ts`) | Danh sách + chú thích | 23 mục | Dùng cho cả tìm kiếm và phối đồ |

## 8. UI hiển thị (đã chốt bản phác)

Bản phác đã duyệt: khung chat trợ lý, kết quả của Advisor hiện bằng **thẻ** nằm trong luồng chat; chữ của LLM đi kèm phía trên thẻ. Giao diện đã dựng theo bản phác (xem thử ở `/dev/assistant`; nút chỉ hiện khi `AI_ENABLED=true` và cần đăng nhập). Chưa có thiết kế Figma, nên bản phác này là tham chiếu; dùng design token hiện có trong `src/app/globals.css` (`--brand` `#e61e4d`, `--background` `#f8f9fa`, `--ink` `#0f172a`, `--border` `#e2e8f0`, `--success` `#059669`, `--radius` 0.5rem). Khi có Figma thì Figma thắng.

| Trạng thái / đầu ra | Thẻ | Nội dung chính |
|---|---|---|
| `recommended`, `between_two` | **Thẻ size** | Size gợi ý nổi bật; size thay thế khi `between_two` (nhãn "Giữa hai size"); 1–3 dòng `reasons`; dòng báo còn hàng (`inStock`); nút "Chọn size …" và "Xem bảng size"; mức tin cậy (`confidence`) |
| `between_two` (chưa biết sở thích) | **Câu hỏi nhanh** | Nút "Ôm / Vừa / Rộng" (giá trị `fit`) |
| `need_info` | **Thẻ cần thêm số đo** | Ô nhập theo `missingFields` (chiều cao, cân nặng…) và nút gửi |
| `out_of_range`, `no_chart` | **Thẻ báo ngắn** | Nói rõ lý do, không đưa size |
| Outfit | **Thẻ bộ đồ** | Tên bộ + dịp/mùa; mỗi món một dòng theo ô (áo, quần, phụ kiện) gồm ảnh, tên, màu/size, giá; ghi chú lý do; tổng tiền (do code tính); nguồn kiến thức; nút "Xem từng món" và "Thêm cả bộ"; ô thiếu món (`missingSlots`) thì báo bằng chữ |
| Thêm vào giỏ | **Thẻ xác nhận** (viền `--brand`) | Tóm tắt các món và tổng tiền, nút "Xác nhận" / "Huỷ", hạn 5 phút; xem cơ chế ở `04-tool-calling.md` mục 3 |
| Chăm sóc, chính sách | Văn bản trong chat | Kèm dòng "Nguồn: …" từ `knowledgeSources` |

### Điểm vào
1. Nút **"Tư vấn size"** (`ask-size-button.tsx`) trên trang chi tiết sản phẩm, cạnh "Xem bảng size": mở khung chat đã gắn sản phẩm (`productSlug`). **Đã có**, chạy thật qua `getSizeAdviceAction`.
2. **Nút tròn cố định ở góc phải dưới** (thay cho ngăn kéo bên phải và nút ✨ ở header theo bản thiết kế chốt 2026-11-11): bấm thì mở ô chat chữ nhật đứng ngay phía trên nút (khoảng 380 × 560px; mobile: toàn màn hình); dùng cho hỏi đáp chung và Mix & Match. Đóng ô chat không xoá hội thoại; `Esc` thu nhỏ. Nút màu xám đen (`bg-slate-700`, để khác màu footer `bg-ink`), đầu ô chat màu `bg-ink`; các nút hành động trong thẻ (ví dụ "Chọn size") vẫn dùng màu thương hiệu.
3. Kết quả tìm kiếm vẫn hiện ở lưới sản phẩm hiện có; chat chỉ điều khiển bộ lọc trong URL (`04`, mục 2).

### Component (đã có trong `src/components/assistant/`, dữ liệu mẫu ở `fixtures.ts`)
`assistant-widget` (nút tròn + ô chat), `assistant-panel` (thân ô chat), `message-bubble`, `size-card`, `size-info-card` (thiếu số đo), `outfit-card`, `confirm-card`, `quick-replies`, cùng `notice-card` (thẻ báo ngắn), `ask-size-button`, `assistant-provider`. Chỉ tư vấn size nối dữ liệu thật; `outfit-card`/`confirm-card` mới là giao diện (chưa có backend Mix & Match và `addToCart` xác nhận). Tái dùng: `size-guide-dialog.tsx` (bảng size), `ProductCardData` / `product-card.tsx` (dữ liệu món), `useCartUi` và `cart-drawer.tsx` (mở giỏ sau khi xác nhận).

### Quy tắc dựng
- Component nhận dữ liệu đã qua Zod (`sizeRecommendationSchema`, `outfitSchema`; hiện nhận kiểu thuần `SizeRecommendationView`/`OutfitView` ở `src/types/assistant.ts`); chọn thẻ bằng `switch` trên `status` hoặc tên tool.
- Văn bản do LLM render dạng text thuần, không `dangerouslySetInnerHTML`.
- Giá và tồn kho hiển thị lấy từ dữ liệu server, không lấy từ chữ LLM viết.
- Ảnh sản phẩm dùng ảnh thật (`images[0]`); ô xám có biểu tượng chỉ là placeholder trong bản phác.
- Khung chat trên mobile hiển thị toàn màn hình; thẻ xếp một cột.
- Chữ UI tiếng Việt, sentence case, nút bắt đầu bằng động từ, câu dẫn không dấu chấm than.

## 9. Tiêu chí hoàn thành bước RAG Advisor
- `getSizeRecommendation` đúng toàn bộ 9 ca ở mục 2.4 (kiểm bằng test đơn vị trên hàm thuần, không cần LLM).
- Outfit: 100% `productId` thuộc tập ứng viên và còn hàng; tổng tiền do code tính.
- Các ca thiếu tri thức trả `need_info`/`no_chart`/"chưa có thông tin" thay vì bịa (kiểm theo `06`).

### 4.1 Triển khai Mix & Match (B1.8)
- **Ô và quy tắc phối** (`planSlots`): nam và unisex dùng áo + quần; nữ dùng váy đầm khi dịp là dự tiệc, hẹn hò, dự đám cưới, dự sự kiện, đi nghe nhạc, chụp ảnh, dịp Tết (và kho có váy), còn lại dùng áo + quần; thêm áo khoác khi mùa thu/đông hoặc dịp trang trọng (đi họp, phỏng vấn, đám cưới, tiệc, sự kiện); phụ kiện là món thêm (không có thì không báo thiếu); thiếu áo, quần, váy hoặc áo khoác thì ghi vào `missingSlots` thay vì nhồi món khác. Chân váy nằm trong danh mục "Váy đầm" nhưng được phối như quần (không phải bộ hoàn chỉnh).
- **Chọn món**: lọc cứng (đang bán, có biến thể còn hàng, hợp giới tính gồm cả unisex, còn size khách nói nếu có), giữ 6 món điểm cao nhất mỗi ô (điểm: hợp dịp +3, hợp mùa +1,5), mỗi món tối đa 2 màu (màu trung tính trước). Tìm vét cạn tổ hợp: điểm cao nhất (cộng điểm hài hoà: cùng phong cách, cùng nhóm lịch sự hoặc thường ngày, tối đa một màu nổi, không trùng màu nổi) trong ngân sách; hoà thì rẻ hơn rồi theo mã sản phẩm nên kết quả ổn định. Ngân sách là tổng cả bộ: không bộ nào vừa thì `OVER_BUDGET`.
- **Món khách đã chọn sẵn** (tên sản phẩm, qua `resolveProduct`) luôn nằm trong bộ, giới tính theo món đó. Tên sản phẩm chỉ được nhận khi chính khách đã nói (model hay bịa tên cho tham số này).
- **Lý do từng món do code dựng** từ thuộc tính thật (dịp, mùa, phong cách, màu), `knowledgeSources` là tiêu đề các đoạn kiến thức phối đồ truy xuất được (lỗi thì bỏ qua), tổng tiền do code cộng.
- **Chưa làm**: nút "Thêm cả bộ" (cần xác nhận nhiều món trong một lần; hiện thẻ không có nút này, khách bấm vào từng sản phẩm để chọn size rồi thêm), phối theo màu cụ thể khách yêu cầu, ghi nhớ bộ đã gợi ý để gợi ý bộ khác.
