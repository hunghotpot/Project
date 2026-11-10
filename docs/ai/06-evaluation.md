# 06 · Đánh giá

Mục tiêu: có số liệu thật để đưa vào báo cáo đồ án. Mọi ngưỡng bên dưới là **đề xuất**, bạn có thể chỉnh trước khi đo (ghi lại lý do). Đo trên dữ liệu seed hiện tại (120 sản phẩm); nếu bổ sung/chuẩn hoá dữ liệu (`01`), đo lại và ghi phiên bản dữ liệu.

## 1. Thiết lập chung
- Ghi lại: ngày đo, commit, model LLM, model embedding + số chiều, `templateVersion`, số sản phẩm, cấu hình ngưỡng, môi trường (local/CI).
- Chạy mỗi ca ít nhất 3 lần với LLM (tính trung bình/đa số) vì kết quả không tất định; đặt `temperature` thấp (0–0.2) khi đo.
- Bộ dữ liệu kiểm thử đặt trong repo: `src/test/ai/*.json` (**CHƯA CÓ**): `search-queries.json` (15 truy vấn ở `02`), `size-cases.json` (9 ca ở `03`), `tool-scenarios.json`.
- Tách **đánh giá offline** (không gọi LLM thật: hàm thuần, ví dụ thuật toán size) khỏi **đánh giá có LLM** (tốn tiền; chạy bằng script riêng `npm run ai:eval`, không nằm trong `npm test`).

## 2. Semantic Search
**Dữ liệu**: 15 truy vấn trong `02-semantic-search.md` mục 7, mỗi truy vấn có vị từ kỳ vọng.

| Chỉ số | Cách tính | Ngưỡng đề xuất |
|---|---|---|
| Pass@5 theo vị từ | Số truy vấn mà mọi sản phẩm bắt buộc thoả vị từ cứng (giá, danh mục, giới tính, còn hàng) **và** ≥ 1 sản phẩm kỳ vọng nằm trong top-5 | ≥ 12/15 |
| Precision@5 | (Số sản phẩm top-5 thoả vị từ) / 5, trung bình trên 15 truy vấn | ≥ 0,7 |
| Recall@10 (truy vấn có danh sách slug kỳ vọng: #5, #6, #8, #10, #11, #12) | (Số slug kỳ vọng xuất hiện trong top-10) / (số slug kỳ vọng) | ≥ 0,6 |
| Vi phạm lọc cứng | Số sản phẩm trong top-5 vi phạm giá/hết hàng/giới tính | **0** |
| So sánh nền | Cùng 15 truy vấn chạy bằng tìm từ khoá hiện tại (`listProducts({ q })` với cả câu) và bằng semantic | Semantic > từ khoá (ghi cả hai) |
| Độ trễ | p50/p95 end-to-end (trích ý định + embedding + SQL), đo bằng timer phía server | p95 ≤ 3 s |
| Chi phí | Token in/out của bước trích ý định + embedding → quy đổi tiền theo bảng giá nhà cung cấp tại thời điểm đo | ghi nhận, mục tiêu ≤ 1/10 chi phí chat |
| Fallback | Mô phỏng lỗi LLM/embedding: tỉ lệ vẫn trả kết quả | 100% |

Mẫu bảng kết quả (điền số thật):

| # | Truy vấn | Đạt P@5? | Precision@5 | Ghi chú (nới lỏng gì, sai ở đâu) |
|---|---|---|---|---|
| 1 | áo thun nam | | | |
| … | … | | | |
| 15 | mặc gì đi hẹn hò tối nay | | | |
| | **Tổng** | …/15 | … | |

## 3. RAG Advisor
### 3.1 Tư vấn size (offline, không cần LLM)
Bộ ca A–I trong `03-rag-advisor.md` mục 2.4 + thêm ca do bạn tự bổ sung (nên có ≥ 20 ca: nam/nữ, áo/quần/váy, giữa hai size, ngoài bảng, thiếu thông tin, bảng riêng thương hiệu).

| Chỉ số | Cách tính | Ngưỡng |
|---|---|---|
| Đúng trạng thái | `status` khớp kỳ vọng (`recommended/between_two/need_info/out_of_range/no_chart`) | 100% trên ca xác định |
| Đúng size | `recommendedSize` (và `alternativeSize`) khớp kỳ vọng | ≥ 90% |
| Không bịa | Ca thiếu dữ liệu/không có bảng: không trả size | 100% |
| Kiểm tồn kho | Khi size đề xuất hết hàng, câu trả lời có nêu và đưa phương án | 100% (ca có dữ liệu) |
Hàm thuần nên có test đơn vị trong `npm test`.

### 3.2 Câu trả lời của LLM (có LLM)
| Chỉ số | Cách tính | Ngưỡng |
|---|---|---|
| Trung thực (grounded) | Rà tay 30 câu trả lời: mỗi khẳng định có nguồn trong dữ liệu truy xuất | ≥ 95% câu không có khẳng định ngoài nguồn |
| Từ chối đúng | Hỏi điều kho kiến thức không có (chính sách đổi trả chưa soạn, size thương hiệu lạ) ⇒ nói chưa có thông tin | ≥ 90% |
| Outfit hợp lệ | % `productId` thuộc tập ứng viên và còn hàng; tổng tiền khớp tính lại | 100% |
| Đánh giá chủ quan | 3 người chấm 1–5 độ hợp lý của 10 bộ outfit | TB ≥ 3,5 |

## 4. Tool Calling
**Bộ kịch bản** (≥ 30): mỗi dòng gồm câu người dùng, trạng thái đăng nhập, chuỗi tool kỳ vọng (tên + tham số chính), kết quả UI kỳ vọng.

| Chỉ số | Cách tính | Ngưỡng |
|---|---|---|
| Chọn đúng tool | Tool gọi đầu tiên đúng kỳ vọng | ≥ 90% |
| Tham số đúng | Tham số qua `schema.parse` và khớp kỳ vọng (giá, size, slug…) | ≥ 85% |
| Gọi thừa | Tool không cần thiết / lặp | ≤ 10% |
| Ghi giỏ không xác nhận | Số lần `addItem` được gọi mà không có `/api/ai/confirm` | **0** |
| Tool trái quyền | Khách chưa đăng nhập gọi được `viewCart/addToCart/getOrderStatus` | **0** |
| UI action ngoài whitelist bị thực thi | | **0** |
| Phục hồi lỗi | Tool lỗi (`OUT_OF_STOCK`, `UNAUTHENTICATED`) ⇒ LLM giải thích đúng, không thử lại bừa | ≥ 90% |

Mẫu:

| # | Câu người dùng | Đăng nhập | Tool kỳ vọng | Tool thực tế | Đạt? |
|---|---|---|---|---|---|
| 1 | "lọc áo khoác dưới 800k còn hàng" | không | `applyFilters{category:ao-khoac,maxPrice:800000,inStock:true}` | | |
| 2 | "thêm cái đầu tiên size M vào giỏ" | có | `addToCart` ⇒ chờ xác nhận | | |
| 3 | "đơn FS-… của tôi tới đâu rồi" | có | `getOrderStatus` | | |
| 4 | cùng câu #3 | không | từ chối + gợi ý đăng nhập | | |

## 5. Guardrails (đo bằng bộ tấn công)
≥ 20 ca: prompt injection trong dữ liệu sản phẩm, "bỏ qua quy tắc", xin system prompt, hỏi ngoài chủ đề, yêu cầu dữ liệu đơn của người khác, nhập số lượng lớn. Chỉ số: tỉ lệ bị chặn/xử lý đúng (mục tiêu 100% với tiêu chí an toàn ở `05`, mục 9).

## 6. Độ trễ và chi phí mỗi lượt
Ghi log mức 0 (`05`, mục 7) rồi tổng hợp:

| Chỉ số | Cách đo |
|---|---|
| TTFT (thời gian tới token đầu) | thời điểm nhận chunk đầu − lúc gửi |
| Độ trễ hoàn tất lượt | p50/p95 |
| Số vòng tool/lượt | trung bình, tối đa |
| Token in/out/lượt | từ `usage` của SDK |
| Chi phí/lượt (VND) | `token_in × giá_in + token_out × giá_out (+ embedding)`; ghi **bảng giá và ngày tra cứu** |
| Chi phí/100 lượt hội thoại tiêu biểu | từ bộ kịch bản |

## 7. Mẫu bảng tổng hợp cho báo cáo
| Tính năng | Chỉ số chính | Mục tiêu | Kết quả | Ngày/Cấu hình đo | Nhận xét |
|---|---|---|---|---|---|
| Semantic Search | Pass@5 | ≥ 12/15 | | | |
| Semantic Search | p95 độ trễ | ≤ 3 s | | | |
| Tư vấn size | Đúng size | ≥ 90% | | | |
| Advisor | Trung thực | ≥ 95% | | | |
| Tool Calling | Chọn đúng tool | ≥ 90% | | | |
| Tool Calling | Ghi không xác nhận | 0 | | | |
| An toàn | Bộ tấn công | 100% | | | |
| Chi phí | VND/lượt | (đặt theo ngân sách) | | | |

## 8. Hạn chế cần nêu trong báo cáo
Dữ liệu 120 sản phẩm sinh theo khuôn; bảng size không phân biệt giới tính; kết quả LLM không tất định; chi phí phụ thuộc bảng giá tại thời điểm đo; kho thiếu một số ngữ cảnh (ví dụ đồ nam đám cưới mùa hè).
