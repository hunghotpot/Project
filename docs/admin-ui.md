# Quy ước dựng màn hình Admin

Đọc trước: `CLAUDE.md`, `.claude/rules/project.md`, `docs/TODO.md` (mục A), file này. Đã có khung và trang Tổng quan làm mẫu: `src/app/(admin)/admin/`, `src/components/admin/`.

## Thiết kế gốc (Figma xuất ra ảnh)
Ảnh nằm ở `docs/design/admin/` (Figma MCP bị giới hạn lượt gọi, nên dùng ảnh): `01-tong-quan`, `02-khach-hang`, `03-don-hang`, `04-ton-kho-san-pham`, `05-voucher`, `06-cai-dat-he-thong`, `07-modal-them-san-pham`, `08-modal-tao-voucher`, `09-modal-them-khach-hang`. Đọc bằng công cụ Read (xem được ảnh).
- Chỉ lấy **bố cục, màu, cỡ chữ** từ ảnh. Dữ liệu mẫu trong ảnh là đồ thể thao ("SPORT BRAND"): nội dung thật lấy từ DB, tên cửa hàng từ `SITE_NAME`.
- Màn **Danh mục** và **Bảng size** không có trong Figma: tự thiết kế bằng đúng các bộ phận dưới đây (thẻ số liệu, bảng, modal), không tạo kiểu mới.
- Màu/cỡ chữ/bo góc dùng token trong `src/app/globals.css` (`bg-ink`, `text-brand`, `bg-brand-soft`, `text-label`, `rounded-3xl`…). Không viết mã màu cứng.

## Bộ phận dùng chung (đừng viết lại, đừng sửa; thiếu gì thì báo lại)
| Cần | Dùng | File |
|---|---|---|
| Hàng 4 thẻ số liệu | `StatGrid` + `StatCard` (+ `formatDelta`) | `components/admin/dashboard/stat-card.tsx` |
| Tiêu đề khối danh sách | `ListSection` | `components/admin/list/admin-table.tsx` |
| Ô tìm kiếm + nút lọc + nút hành động | `ListToolbar` (state trong URL `?q=&status=`) | `components/admin/list/list-toolbar.tsx` |
| Thẻ chứa bảng | `ListCard` | `admin-table.tsx` |
| Bảng | `AdminTable` + `AdminTr` (ô viết thẳng `<td>`), `AdminEmpty` | `admin-table.tsx` |
| Phân trang | `AdminPagination` (nhận `searchParams` thô) | `components/admin/list/admin-pagination.tsx` |
| Pill trạng thái | `StatusPill tone=success\|warning\|info\|danger\|neutral\|dark` | `components/admin/status-pill.tsx` |
| Modal | `AdminModal` + `ModalActions` (nút Lưu nối form qua `formId`) | `components/admin/modal/admin-modal.tsx` |
| Ô form | `FormField` (nhãn, dấu *, gợi ý, lỗi) + `Input`/`Select`/`Textarea`/`Switch` trong `components/ui` | `components/admin/modal/form-field.tsx` |
| Xác nhận thao tác nguy hiểm | `ConfirmDialog` | `components/admin/modal/confirm-dialog.tsx` |
| Chạy Server Action + toast + làm mới | `useAdminAction()` | `components/admin/use-admin-action.ts` |
| URL/phân trang (hàm thuần) | `buildListHref`, `pageWindow`, `pageRange` | `lib/admin-list.ts` |
| Kiểu kết quả action | `AdminActionResult` | `lib/admin-action.ts` |
| Nhãn/màu trạng thái đơn | `ADMIN_ORDER_STATUS_LABEL`, `ADMIN_ORDER_STATUS_TONE` | `components/admin/admin-nav.ts` |

Mẫu ghép đầy đủ: trang Tổng quan (`src/app/(admin)/admin/page.tsx`, `components/admin/dashboard/pending-orders-card.tsx`).

## Cấu trúc một màn hình
```
src/app/(admin)/admin/<màn>/page.tsx        Server Component: đọc searchParams, gọi service, ghép bộ phận dùng chung
src/components/admin/<màn>/*.tsx            Component riêng của màn (client chỉ khi cần tương tác: modal, nút hành động)
src/app/actions/admin-<màn>.ts              Server Action của màn
src/lib/validators/admin-<màn>.ts           (đã có cho đơn/catalog/khách hàng) Zod; chỉ thêm nếu thiếu
```
- Trang `page.tsx` **không** tự gọi `requireAdmin` ngoài layout đã làm; nhưng mọi **Server Action/route handler** phải kiểm quyền (dưới).
- Bộ lọc/trang/tìm kiếm nằm trong URL. Trang truyền `searchParams` thô cho hàm `list...` của service (đã tự validate và rơi về mặc định khi sai).
- Tiêu đề trang, breadcrumb và sidebar lấy từ `components/admin/admin-nav.ts`; **không sửa file này** (chỉ người điều phối sửa). Trang `AdminComingSoon` hiện có thay bằng nội dung thật.
- Service chỉ nhận `{ userId }` của Admin và dữ liệu đã parse; ngày (`Date`) phải chuyển sang chuỗi/số khi truyền xuống component client.

## Server Action Admin (bắt buộc)
```ts
"use server"
export async function xAction(input: unknown): Promise<AdminActionResult> {
  const admin = await getAdminUser()                       // src/server/auth/admin.ts
  if (!admin) return { ok: false, message: NOT_ADMIN_MESSAGE }
  // 1) validate input bằng Zod  2) gọi service với { userId: admin.id }  3) bắt lỗi nghiệp vụ → { ok:false, message }
  revalidatePath("/admin", "layout")                       // hoặc đường dẫn cụ thể
  return { ok: true, message: "…" }
}
```
- Bắt đúng lớp lỗi của service (`OrderError`, `AdminCatalogError`, `AdminCustomerError`…) và trả `message` tiếng Việt; lỗi lạ thì ném lại.
- **Test quyền cho từng action** theo mẫu `src/app/actions/admin-orders.test.ts` (mock `@/server/auth/admin` và service): khách/chưa đăng nhập bị từ chối và service **không** được gọi; Admin hợp lệ truyền đúng `{ userId }`; input sai không gọi service.
- Giao diện ẩn nút theo trạng thái chỉ để tiện dùng; server (service) luôn là chốt cuối.

## Chất lượng và cách làm việc
- Chuỗi giao diện tiếng Việt, tên code tiếng Anh. Không cài thư viện mới. Không chạy `git add/commit/push`.
- Chạy `npm run lint` và `npm run typecheck` (bỏ qua lỗi ở file ngoài phần của mình khi agent khác đang làm song song). Test thuần/mock chạy bằng `npx vitest run <file>`.
- **Không** chạy test tích hợp (dùng chung một DB), **không** bật dev server/trình duyệt (chung cổng 3000): người điều phối kiểm trình duyệt và chạy test tích hợp tuần tự.
- Chỉ sửa file trong phần việc của mình. Cần đổi file dùng chung thì ghi vào báo cáo cuối.
- Báo cáo cuối: file đã tạo/sửa, quyết định/giả định, phần chưa làm hoặc còn lệch Figma, điều cần người điều phối kiểm.
