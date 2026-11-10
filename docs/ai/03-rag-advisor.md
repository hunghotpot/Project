# 03 · RAG Advisor (tư vấn size, chăm sóc, phối đồ)

Nguyên tắc: **số liệu và quyết định dùng code + SQL; LLM chỉ diễn đạt và chọn trong tập ứng viên đã kiểm.** Dữ liệu dạng bảng (size) tra cứu chính xác, **không** dùng vector.

## 1. Nguồn tri thức

| Nguồn | Hiện trạng | Cách truy xuất | Ghi chú |
|---|---|---|---|
| **SizeChart** (DB) | Có: 34 dòng (`ao-so-mi`, `ao-thun` + riêng Urban Ghost, `ao-khoac`, `quan-jeans`, `quan-tay-kaki`, `vay-dam`); `phu-kien` không có | SQL theo `categoryId` + `brand` (brand riêng thắng bảng chung — logic đã có trong `getProductBySlug`) | Không có cột giới tính/độ ôm; xem mục 3 |
| **Chất liệu & chăm sóc** | Có sơ bộ: `getCareTips(material)` trong `src/lib/care.ts` (8 nhóm regex) + câu mô tả chất liệu trong `description` | Gọi `getCareTips` hoặc tra `KnowledgeChunk` loại `care` | Nội dung chung theo nhóm; **bạn cần soạn kỹ hơn** (mục 7) |
| **Quy tắc phối đồ** | **CHƯA CÓ** (chỉ có câu "Gợi ý phối đồ" lẻ trong `description`) | `KnowledgeChunk` loại `styling` qua vector + lọc metadata | **Bạn tự soạn** |
| **Kho hàng thực tế** | Có: `ProductVariant.stock`, `Product.isActive` | SQL lúc truy vấn (không embed) | Mọi gợi ý phải qua bước kiểm tồn kho |
| **Mô tả sản phẩm** | Có, đã định hướng embed (`01-data-for-ai.md`) | Vector search sản phẩm | |
| **Chính sách cửa hàng** (đổi trả, vận chuyển, thanh toán) | Một phần trong code: phí ship (`FREE_SHIPPING_THRESHOLD = 500_000`, `FLAT_SHIPPING_FEE = 30_000`, `src/lib/shipping.ts`), hạn thanh toán VNPay 15 phút (`PAYMENT_WINDOW_MINUTES`); **chính sách đổi trả CHƯA CÓ** | `KnowledgeChunk` loại `policy` | Chỉ trả lời điều đã có trong tài liệu |

### Bảng chunk kiến thức (đề xuất, CHƯA CÓ)
```prisma
model KnowledgeChunk {
  id              String   @id @default(cuid())
  type            String   // care | styling | policy | faq
  title           String
  content         String   // 1 ý hoàn chỉnh, 80–300 từ
  metadata        Json     // { categories?: string[], gender?: string, seasons?: string[], materials?: string[] }
  embedding       Unsupported("vector(1536)") // cùng N với ProductEmbedding
  contentHash     String
  model           String
  templateVersion Int      @default(1)
  updatedAt       DateTime @updatedAt
}
```
Nguồn gốc nội dung: file Markdown trong `docs/ai/knowledge/*.md` (**CHƯA CÓ**), mỗi `##` là một chunk; script nạp tính hash và chỉ embed phần đổi (cùng cơ chế `ProductEmbedding`).

### Cách chia chunk
- Theo **ý trọn vẹn**, không cắt theo số ký tự: một quy tắc phối đồ / một nhóm chất liệu / một câu hỏi thường gặp = một chunk (80–300 từ).
- Mỗi chunk mở đầu bằng tiêu đề tự mô tả ("Chăm sóc vải linen", "Phối quần jeans ống rộng") để embedding bắt đúng chủ đề.
- Metadata dùng để **lọc trước** khi tìm vector (ví dụ chỉ lấy chunk `styling` có `gender` phù hợp).
- Lấy top-k nhỏ (3–5), kèm khoảng cách; dưới ngưỡng tương đồng thì coi như **không có tri thức** (xem mục 6).

## 2. Luồng tư vấn size

### 2.1 Đầu vào (Zod, đề xuất)
```ts
export const sizeAdviceInputSchema = z.object({
  productSlug: z.string().max(100).optional(),   // hoặc categorySlug
  categorySlug: z.string().max(100).optional(),
  gender: z.enum(["men", "women", "unisex"]).optional(),
  heightCm: z.number().min(100).max(230).optional(),
  weightKg: z.number().min(25).max(250).optional(),
  chestCm: z.number().min(60).max(160).optional(),
  waistCm: z.number().min(45).max(160).optional(),
  hipCm: z.number().min(60).max(170).optional(),
  fit: z.enum(["tight", "regular", "loose"]).default("regular"),
}).refine((v) => v.productSlug || v.categorySlug, "Cần productSlug hoặc categorySlug")
```
Số đo thuộc về người dùng nhập trong hội thoại; **không lưu vào DB** trừ khi bạn thêm tính năng hồ sơ số đo (CHƯA CÓ) và có đồng ý.

### 2.2 Thuật toán (code thuần, deterministic — đề xuất)
1. Xác định bảng size: từ `productSlug` → `getProductBySlug(slug)` (đã trả `sizeChart`); hoặc đọc thẳng `SizeChart`. Không có bảng (ví dụ `phu-kien`) → trả `status: "no_chart"`, **không đoán**.
2. Thiếu dữ liệu tối thiểu → `status: "need_info"` kèm danh sách trường cần hỏi: tối thiểu **chiều cao + cân nặng**, hoặc **vòng ngực/eo/hông** thích hợp loại sản phẩm (áo: ngực; quần: eo + hông; váy: ngực + eo + hông).
3. Chấm điểm từng size (càng thấp càng khớp):
   - `devH` = 0 nếu `heightMin ≤ h ≤ heightMax`, ngược lại khoảng cách tới biên gần nhất (cm); tương tự `devW` với cân nặng (kg).
   - `s = devH/5 + devW/4`; mỗi số đo cơ thể được cung cấp cộng thêm `|giá trị − số đo của bảng|/3` (ngực/eo/hông trong bảng là một số cho mỗi size).
   - Ưu tiên số đo cơ thể khi có đủ; chiều cao/cân nặng chỉ là tín hiệu phụ.
4. Quyết định:
   - `s_best > 1.5` ⇒ `status: "out_of_range"` (nằm ngoài bảng): nói rõ, không ép size.
   - Hai size đầu có `s` bằng nhau, hoặc chênh `< 0.5` (theo tổng độ lệch cm khi dùng số đo cơ thể: chênh `< 3`) ⇒ **nằm giữa hai size** (mục 2.3).
   - Còn lại ⇒ size tốt nhất, độ tin cậy `high` nếu `s = 0`, `medium` nếu `s ≤ 1`.
5. **Kiểm tồn kho** của size đề xuất (và size liền kề) cho sản phẩm cụ thể (`variants[].stock`, theo màu nếu khách chọn). Size đề xuất hết hàng ⇒ nêu rõ và đưa size liền kề còn hàng kèm cảnh báo.
6. LLM nhận **kết quả đã tính** và chỉ diễn đạt lại (không tự tính size).

### 2.3 Khi nằm giữa hai size
| Điều kiện | Gợi ý |
|---|---|
| `fit = loose` hoặc dáng suông/oversize | Chọn size **lớn hơn** |
| `fit = tight` | Chọn size **nhỏ hơn** |
| `fit = regular` | Mặc định size **lớn hơn** với áo/váy (an toàn hơn), kèm lý do |
| Chất liệu co giãn (tên chất liệu chứa "co giãn", "spandex", "thun") | Nghiêng size nhỏ hơn, nói rõ lý do |
| Váy/đầm | Chọn theo số đo **lớn nhất** trong ngực/hông (phần khó nới) |
| Quần | Ưu tiên vòng eo; nếu hông lớn hơn mốc của size → size lớn hơn |
Luôn trình bày **cả hai size** và lý do, rồi hỏi khách thích mặc ôm hay rộng nếu chưa biết.

### 2.4 Ví dụ kiểm tra tay (theo bảng seed thật)
Bảng `ao-so-mi`/`ao-thun` chung: S 160–167cm/50–58kg · M 165–172/58–66 · L 170–177/66–74 · XL 175–182/74–82.

| Ca | Đầu vào | `s` từng size | Kết quả mong đợi |
|---|---|---|---|
| A | 168cm, 60kg | M=0 · S=0,7 · L=1,9 | **M**, tin cậy cao (chênh với S ≥ 0,5) |
| B | 170cm, 66kg | M=0 · L=0 | **Giữa M và L**; `regular` → khuyên L, hỏi sở thích |
| C | 158cm, 48kg | S=0,9 | **S**, tin cậy trung bình, ghi chú "dưới mốc nhỏ nhất của bảng" |
| D | 185cm, 95kg | XL=3,85 | **out_of_range**, không tư vấn size |
| E | Quần jeans, eo 80cm | eo size 31=79, size 32=81 | **Giữa 31 và 32**; nếu chất liệu co giãn → nghiêng 31 |
| F | Váy đầm, ngực 88/eo 70/hông 95 | tổng lệch cm: M=5, L=7, S=17 | **Giữa M và L** (chênh < 3); ngực/hông lớn hơn mốc M ⇒ khuyên L nếu muốn thoải mái |
| G | Chỉ có "tôi cao 1m70" | – | **need_info**: hỏi cân nặng hoặc số đo |
| H | Phụ kiện (`phu-kien`) | không có bảng | **no_chart**; nói đúng: sản phẩm không có bảng size, xem mô tả/size trên sản phẩm |
| I | `ao-thun` thương hiệu Urban Ghost, 165cm/58kg | Bảng riêng S 158–168/48–60 · M 163–173/56–68 | **Giữa S và M** (cả hai trong khoảng); nêu rằng bảng Urban Ghost có ngực 104–116cm (form rộng hơn bảng chung 88–100cm) |

Bộ này dùng lại trong `06-evaluation.md`.

## 3. Hạn chế dữ liệu ảnh hưởng độ chính xác (cần bạn quyết định)
- `SizeChart` **không có giới tính**: cùng bảng cho nam và nữ → tư vấn nữ có thể sai. Đề xuất thêm cột `gender` hoặc bảng riêng.
- Không rõ số đo trong bảng là **số đo cơ thể** hay **số đo sản phẩm** (bảng Urban Ghost có ngực 104–116cm trông như số đo sản phẩm). Cần ghi chú trong dữ liệu.
- Không có **độ ôm** của từng sản phẩm (slim/regular/oversize): AI chỉ biết qua tên/mô tả.
- Chiều cao/cân nặng chồng lấn giữa size liền kề → ca "nằm giữa" xảy ra thường xuyên; luôn cần hỏi sở thích ôm/rộng.

## 4. Luồng Mix & Match (chỉ dùng hàng còn)

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
| 4 | **Chính sách cửa hàng**: đổi trả, bảo hành, vận chuyển, thanh toán, hoàn tiền | Markdown | 5–10 | Hiện chưa có tài liệu; chỉ điều bạn xác nhận mới được AI nói |
| 5 | **Từ điển đồng nghĩa/lóng** tiếng Việt cho thời trang (xem `02`, mục 5) | file TS/JSON | 50–100 mục | |
| 6 | **Bảng size bổ sung**: giới tính, độ ôm, số liệu cho `phu-kien` (nếu cần) | Dữ liệu seed | | |
| 7 | **Danh sách `occasion` chuẩn** và mô tả mỗi dịp (dress code) | Danh sách + chú thích | 15–20 mục | Dùng cho cả tìm kiếm và phối đồ |

## 8. Tiêu chí hoàn thành bước RAG Advisor
- `getSizeRecommendation` đúng toàn bộ 9 ca ở mục 2.4 (kiểm bằng test đơn vị trên hàm thuần, không cần LLM).
- Outfit: 100% `productId` thuộc tập ứng viên và còn hàng; tổng tiền do code tính.
- Các ca thiếu tri thức trả `need_info`/`no_chart`/"chưa có thông tin" thay vì bịa (kiểm theo `06`).
