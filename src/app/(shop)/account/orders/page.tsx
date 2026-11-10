import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { OrderCard } from "@/components/orders/order-card"
import { OrderFilters } from "@/components/orders/order-filters"
import { OrderPagination } from "@/components/orders/order-pagination"
import { buttonVariants } from "@/components/ui/button"
import { parseOrderListFilters, serializeOrderListFilters } from "@/lib/validators/order-list"
import { requireUser } from "@/server/auth/session"
import { listOrders } from "@/server/services/order.service"

export const metadata: Metadata = { title: "Đơn hàng của tôi", robots: { index: false } }

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser("/account/orders")
  const filters = parseOrderListFilters(await searchParams)
  const result = await listOrders(user.id, filters)

  // Trang vượt quá số trang (vd. link cũ sau khi lọc thu hẹp) → về trang cuối.
  if (result.total > 0 && filters.page > result.pageCount) {
    const qs = serializeOrderListFilters({ ...filters, page: result.pageCount }).toString()
    redirect(qs ? `/account/orders?${qs}` : "/account/orders")
  }

  const filtering = !!filters.status || !!filters.q

  return (
    <div className="space-y-6 pb-16">
      <div>
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Trang chủ
          </Link>
          {" / "}
          <Link href="/account/profile" className="hover:text-foreground">
            Tài khoản
          </Link>
          {" / "}
          <span className="font-bold text-foreground">Tất cả đơn mua</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Đơn Hàng Của Tôi</h1>
          <p className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-2 text-xs font-bold text-sidebar-foreground">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            Chủ đơn: <span className="text-foreground">{user.name}</span>
          </p>
        </div>
      </div>

      <OrderFilters filters={filters} counts={result.counts} />

      {result.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
          <p className="text-lg font-bold">{filtering ? "Không tìm thấy đơn hàng phù hợp" : "Bạn chưa có đơn hàng nào"}</p>
          <p className="max-w-sm text-label text-muted-foreground">
            {filtering ? "Thử bỏ bộ lọc hoặc đổi từ khoá tìm kiếm." : "Khi đặt hàng, đơn của bạn sẽ hiển thị ở đây để theo dõi."}
          </p>
          <Link
            href={filtering ? "/account/orders" : "/products"}
            className={buttonVariants({ variant: "dark", size: "md" })}
          >
            {filtering ? "Xoá bộ lọc" : "Tiếp tục mua sắm"}
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {result.items.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}

      <OrderPagination filters={filters} total={result.total} pageCount={result.pageCount} />
    </div>
  )
}
