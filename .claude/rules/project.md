# Fashion E-Commerce with AI Shopping Concierge

## Stack
Next.js 15 (App Router, TypeScript strict), Tailwind CSS, shadcn/ui, Prisma,
PostgreSQL (image pgvector/pgvector:pg16), Redis (sau), Zod, TanStack Query, Zustand.

## Kiến trúc
- Logic nghiệp vụ nằm trong `src/server/services/*` (CartService, OrderService...).
  Route handler / Server Action chỉ validate input (Zod) rồi gọi service.
  LÝ DO: giai đoạn sau AI Tool Calling sẽ gọi lại đúng các service này.
- `src/server/` không được import vào client component.
- Mọi input phải validate bằng Zod schema đặt trong `src/lib/validators/`.
- Trạng thái bộ lọc sản phẩm nằm trong URL query (?size=M&color=black&maxPrice=500000).
- Tiền tệ: VND, lưu Decimal/Int, format bằng Intl.NumberFormat('vi-VN').
- Giá trong OrderItem là giá tại thời điểm mua.
- Trừ tồn kho phải nằm trong prisma.$transaction.

## Quy ước
- Giao diện bám sát Figma (dùng Figma MCP), không tự ý đổi layout/màu.
- Component dùng shadcn/ui làm nền, tùy biến theo design token.
- Commit nhỏ, message dạng conventional commits.
- Sau mỗi tính năng: chạy `npm run lint && npm run typecheck`.
- Ngôn ngữ UI: tiếng Việt. Code, tên biến: tiếng Anh.
- Trang Admin (`src/app/(admin)/admin/`): dựng theo `docs/features.md` (mục "Quy ước dựng màn hình Admin"); mọi Server Action/route Admin gọi `getAdminUser()` TRƯỚC rồi mới validate và gọi `admin-*.service` (service không tự kiểm quyền); chỉ tải ảnh qua `/api/admin/uploads`.
- Giai đoạn AI: theo `.claude/rules/ai.md` và thiết kế trong `docs/ai/*.md` (kiến trúc hiện tại: `docs/architecture.md`).

## Lệnh
npm run dev | npm run db:up | npx prisma migrate dev | npm run db:seed