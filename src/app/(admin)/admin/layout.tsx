import { AdminHeader } from "@/components/admin/admin-header"
import { AdminPageTitle } from "@/components/admin/admin-page-title"
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar"
import { requireAdmin } from "@/server/auth/session"
import { getOrderStatusCounts } from "@/server/services/admin-order.service"

// Luôn render theo request: dữ liệu Admin không được cache và cần kiểm quyền mỗi lần.
export const dynamic = "force-dynamic"

/*
 * Khung Admin (route group riêng, KHÔNG dùng layout cửa hàng: không header/footer cửa hàng, không nút trợ lý AI).
 * Middleware đã chặn /admin theo role; requireAdmin() ở đây là lớp thứ hai (đọc lại DB nên tài khoản bị khoá/đổi role mất quyền ngay).
 * Từng trang bên trong vẫn phải tự kiểm quyền ở Server Action/route handler của nó.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin")
  const { PENDING: pendingOrders } = await getOrderStatusCounts()

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mx-auto max-w-[1440px] space-y-6 rounded-3xl bg-card p-4 sm:space-y-8 sm:p-8">
        <AdminHeader user={{ name: admin.name }} pendingOrders={pendingOrders} />
        <AdminPageTitle />
        <AdminMobileNav pendingOrders={pendingOrders} />
        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          <AdminSidebar pendingOrders={pendingOrders} />
          <main className="min-w-0 space-y-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
