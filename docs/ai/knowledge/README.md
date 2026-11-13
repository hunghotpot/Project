# Kho kiến thức cho trợ lý AI (bản dùng tạm)

Nội dung tiếng Việt cho RAG Advisor (`docs/ai/03-rag-advisor.md`). Trợ lý chỉ được khẳng định điều có trong các đoạn này hoặc trong dữ liệu sản phẩm, bảng size lấy từ DB lúc trả lời. Đây là **bản dùng tạm**: đã đối chiếu nguồn bên ngoài cho những chunk có `"basis":"tra-cuu"`, còn lại là kiến thức chung hoặc theo dữ liệu dự án và cần chủ cửa hàng duyệt trước khi dùng thật.

## Quy ước file
| File | `type` của chunk | Nội dung |
|---|---|---|
| `care.md` | `care` | Chăm sóc theo chất liệu, ký hiệu nhãn mác |
| `size-guide.md` | `faq` | Cách đo và chọn size |
| `policy.md` | `policy` | Vận chuyển, thanh toán, huỷ đơn (chỉ điều đã có trong hệ thống) |
| `styling.md` | `styling` | Quy tắc phối đồ, phối màu, theo loại đồ và theo mùa |
| `occasions.md` | `styling` | Gợi ý trang phục cho 23 dịp chuẩn (`OCCASIONS` trong `prisma/seed-data/vocab.ts`) |

## Quy ước chunk
- Mỗi `##` là **một chunk** (một ý trọn vẹn). Tiêu đề tự mô tả chủ đề, vì tiêu đề được embed cùng nội dung.
- Dòng ngay dưới tiêu đề là siêu dữ liệu JSON trong chú thích HTML, dạng `<!-- meta: {"gender":"women"} -->`. Khoá dùng được:
  - `categories`: slug category (lá hoặc gốc `nam`, `nu`, `unisex`, `phu-kien`).
  - `gender`: `men` | `women` | `unisex`.
  - `seasons`: `xuân` | `hè` | `thu` | `đông`.
  - `materials`: nhóm chất liệu (`cotton`, `linen`, `to-lua`, `len`, `ni-sherpa`, `denim`, `da`, `tong-hop`, `kaki-canvas`, `phu-kien`).
  - `occasions`: giá trị thuộc `OCCASIONS`.
  - `basis` (tuỳ chọn): `tra-cuu` = đã đối chiếu nguồn bên ngoài ở bảng dưới; `kinh-nghiem` = kiến thức chung chưa đối chiếu riêng. Chunk không có khoá này là nội dung theo dữ liệu hoặc code của dự án (`policy.md`, phần lớn `size-guide.md`) hoặc quy ước phối đồ phổ thông.
- Mục tiêu độ dài 80–300 từ (chunk chính sách ngắn hơn vì chỉ có vài dữ kiện thật). Không ghi giá, tồn kho, tên sản phẩm cụ thể hay khuyến mãi.
- Không chẩn đoán cơ thể, không so sánh với thương hiệu ngoài kho.

## Nguồn đã tra cứu (2026-11-13)
Đây là các trang hướng dẫn của nhà bán lẻ, thương hiệu và báo; đa số không phải tiêu chuẩn kỹ thuật, nên chỉ coi là nguồn tham khảo cùng chiều.

| Chủ đề | Nguồn | Dùng cho |
|---|---|---|
| Ký hiệu giặt ủi | [Laundry symbol (Wikipedia)](https://en.wikipedia.org/wiki/Laundry_symbol), [GINETEX](https://www.ginetex.net/GB/ginetex/our-mission-and-objectives.asp) (ISO 3758) | `care.md` mục ký hiệu nhãn mác |
| Linen | [Charles Tyrwhitt](https://www.charlestyrwhitt.com/gb/en_GB/how-to-care-for-linen.html), [Alliance Flax Linen Hemp](https://allianceflaxlinenhemp.eu/en/flax-performance-and-properties/washing-linen-care-advice), [Boden](https://boden.com/blogs/care-guides/linen) | `care.md` linen |
| Lụa, satin | [Tide](https://tide.com/en-us/how-to-wash-clothes/washing-different-fabrics/how-to-wash-and-care-for-silk-clothes), [Fashion Magazine](https://fashionmagazine.com/style/how-to-wash-silk-care-guide/), [Who What Wear](https://www.whowhatwear.com/how-to-wash-silk) | `care.md` lụa và satin |
| Len, đồ dệt kim | [Lindex](https://www.lindex.com/bg/guides-and-tips/product-care/product-care-wool), [Suitsupply](https://suitsupply.com/en-gb/journal/how-to-take-care-of-your-knits.html), [House of Bruar](https://www.houseofbruar.com/knitwear-care) | `care.md` len |
| Áo phao, lông vũ | [Mammut](https://www.mammut.com/at/en/stories-guides/how-to-wash-and-dry-your-down-jacket-complete-guide), [Reima](https://us.reima.com/blog/how-to-wash-down-jacket), [GO Outdoors](https://www.gooutdoors.co.uk/blogs/article/how-to-wash-and-dry-your-down-jacket) | `care.md` áo phao |
| Denim | [Levi's](https://levihelp.levi.com/hc/en-at/articles/17527822456081-How-often-should-you-wash-Raw-Denim), [Denim Hunters](https://denimhunters.com/how-to-wash-jeans/) | `care.md` denim |
| Da và da PU | [Lakeland Leather](https://www.lakelandleather.co.uk/care-leather-jacket), [Aritzia](https://www.aritzia.com/en/fabric-care-guide-leather-and-suede), [Utopia](https://utopia.org/guide/how-to-clean-faux-leather-jackets-couches-and-more) | `care.md` da |
| Cách tự đo | [Lulus](https://www.lulus.com/blog/lifestyle/how-to-take-your-own-measurements/amp/), [NMSU C-220](https://pubs.nmsu.edu/_c/C220/), [Maurices](https://www.maurices.com/size-chart/how-to-measure) | `size-guide.md` cách đo |
| Nằm giữa hai size | [Dessy](https://dessy.com/size-charts/), [Stitch Fix](https://stitchfix.com/men/blog/?p=1320), [Macy's](https://www.macys.com/s/guides/dress-fabrics-stretch-vs-non-stretch/) | `size-guide.md` giữa hai size |
| Phối màu 3 màu, 60-30-10 | [The Vou](https://thevou.com/blog/3-color-rule-outfits/), [The Everygirl](https://theeverygirl.com/60-30-10-color-rule/), [Woman & Home](https://www.womanandhome.com/fashion/three-colour-rule/) | `styling.md` (blog thời trang, không phải nghiên cứu) |
| Mặc nhiều lớp | [Columbia](https://www.columbia.com/t/guide/how-to-layer-for-cold-weather/), [Patagonia](https://eu.patagonia.com/ie/en/guides/cold-weather-layering/) | `styling.md` mặc nhiều lớp |
| Trang phục đi chùa | [Vietnam Tourism](https://www.vietnamtourism.com/vi/temple-etiquette-in-vietnam-what-to-wear-do-and-avoid), [VnExpress](https://vnexpress.net/12-quy-tac-mac-do-can-nho-4740127.html) | `occasions.md` đi lễ chùa |
| Trang phục dự đám cưới | [VnExpress](https://vnexpress.net/mac-gi-khi-du-tiec-cuoi-2263613.html), [Vietcetera](https://vietcetera.com/vn/di-dam-cuoi-mac-gi-de-khong-la-ky) | `occasions.md` dự đám cưới |

## Những chỗ nguồn không thống nhất (đã chọn cách thận trọng)
- Chất tẩy cho áo phao: một số nguồn bắt buộc chất giặt riêng cho lông vũ, nguồn khác cho phép chất giặt dịu nhẹ. Chunk nói "ưu tiên loại dành riêng, nhãn mác thắng".
- Tần suất giặt denim: từ "mười lần mặc" đến "vài tháng một lần". Chunk nêu khoảng, không chốt một con số.
- Mẹo cất quần denim vào tủ lạnh để khử mùi chỉ xuất hiện ở một nguồn nên **không** đưa vào.
- Trang phục đám cưới: một số nguồn tránh cả màu đen vào tiệc ban ngày, nguồn khác chỉ nói tiệc tối chọn màu tối. Chunk ghi theo thời điểm.

## Việc cần chủ cửa hàng xác nhận
- Phần chăm sóc là hướng dẫn chung: nhãn mác trên từng sản phẩm luôn thắng. Nên đối chiếu với nhãn mác các sản phẩm bán chạy.
- `policy.md` mới có điều đã tồn tại trong code (`src/lib/policies.ts`). **Đổi trả, bảo hành, hoàn tiền, bảo mật, khuyến mãi chưa có nội dung**; trợ lý phải nói chưa có thông tin cho tới khi bạn cung cấp. Khi sửa phí ship, hạn thanh toán hay quy tắc huỷ đơn trong code, phải sửa `policy.md` cho khớp (sau này nên sinh file này từ `POLICIES`).
- Quy ước thời trang phổ thông (phối màu, theo dịp) cần bạn duyệt giọng văn và các quan niệm văn hoá, vì mỗi nơi có thông lệ khác nhau.
- Bảng size nữ trong DB là số đo ước lượng; hướng dẫn size nói "tham khảo" cho đúng.

## Chưa làm
- Nội dung chính sách đổi trả, bảo hành, hoàn tiền, bảo mật, liên hệ (cần thông tin thật của cửa hàng).

## Đã nạp vào hệ thống
`npm run ai:embed` đọc các file trong bảng ở trên, kiểm quy ước (sai là báo lỗi nêu file và tiêu đề), embed phần mới hoặc đã đổi và dọn đoạn đã xoá. **Sửa file Markdown xong phải chạy lại lệnh này** thì chat mới thấy nội dung mới. Chat truy xuất tối đa 3 đoạn gần nhất (khoảng cách cosine không quá 0,45), nên đoạn viết đúng chủ đề, tiêu đề tự mô tả, mới được tìm thấy.
