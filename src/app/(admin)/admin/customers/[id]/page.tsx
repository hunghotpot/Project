import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { ADMIN_ORDER_STATUS_LABEL, ADMIN_ORDER_STATUS_TONE } from "@/components/admin/admin-nav"
import { CustomerAvatar } from "@/components/admin/customers/customer-avatar"
import { CustomerLockButton } from "@/components/admin/customers/customer-lock-button"
import { StatusPill } from "@/components/admin/status-pill"
import { CUSTOMER_TIER_LABEL, VIP_SPEND_THRESHOLD } from "@/lib/customer-tier"
import { formatDate, formatDateTime, formatVnd } from "@/lib/format"
import { customerIdSchema } from "@/lib/validators/admin-customer"
import { requireAdmin } from "@/server/auth/session"
import { AdminCustomerError, getCustomerDetail, type CustomerDetail } from "@/server/services/admin-customer.service"

export const metadata: Metadata = { title: "Chi tiết khách hàng" }

async function loadCustomer(rawId: string): Promise<CustomerDetail> {
  const id = customerIdSchema.safeParse(rawId)
  if (!id.success) notFound()
  try {
    return await getCustomerDetail(id.data)
  } catch (e) {
    if (e instanceof AdminCustomerError) notFound()
    throw e
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-label font-bold">{children}</dd>
    </div>
  )
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin(`/admin/customers/${id}`)
  const c = await loadCustomer(id)
  const locked = c.status === "LOCKED"

  return (
    <>
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-label font-bold hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden /> Danh sách khách hàng
      </Link>

      <section className="flex flex-wrap items-center gap-5 rounded-3xl border border-border bg-card p-6">
        <CustomerAvatar initial={c.initial} tier={c.tier} locked={locked} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{c.name}</h2>
          <p className="truncate text-label text-muted-foreground">{c.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone={c.tier === "VIP" ? "dark" : "neutral"}>{CUSTOMER_TIER_LABEL[c.tier]}</StatusPill>
            <StatusPill tone={locked ? "danger" : "success"}>{locked ? "Đã khóa" : "Hoạt động"}</StatusPill>
          </div>
        </div>
        <CustomerLockButton customerId={c.id} name={c.name} locked={locked} display="button" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title="Thông tin khách hàng">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Fact label="Số điện thoại">{c.phone ?? "—"}</Fact>
            <Fact label="Ngày đăng ký">{formatDate(c.createdAt)}</Fact>
            <Fact label="Số đơn hàng">{c.orderCount} đơn</Fact>
            <Fact label="Tổng chi tiêu">
              <span className={c.tier === "VIP" ? "text-brand" : undefined}>{formatVnd(c.totalSpend)}</span>
            </Fact>
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">
            Chỉ tính đơn không bị hủy. VIP khi tổng chi tiêu từ {formatVnd(VIP_SPEND_THRESHOLD)}.
          </p>
        </Card>

        <Card title="Sổ địa chỉ">
          {c.addresses.length === 0 ? (
            <p className="text-label text-muted-foreground">Khách chưa lưu địa chỉ nào.</p>
          ) : (
            <ul className="space-y-3">
              {c.addresses.map((a) => (
                <li key={a.id} className="rounded-2xl border border-border p-4 text-label">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {a.fullName} · {a.phone}
                    {a.isDefault && <StatusPill tone="info">Mặc định</StatusPill>}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {a.street}, {a.ward}, {a.district}, {a.province}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Đơn hàng gần đây">
        {c.recentOrders.length === 0 ? (
          <p className="text-label text-muted-foreground">Khách chưa có đơn hàng nào.</p>
        ) : (
          <ul className="divide-y divide-border">
            {c.recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-label">
                <div>
                  <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline">
                    #{o.code}
                  </Link>
                  <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusPill tone={ADMIN_ORDER_STATUS_TONE[o.status]}>{ADMIN_ORDER_STATUS_LABEL[o.status]}</StatusPill>
                  <span className="min-w-28 text-right font-bold">{formatVnd(o.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
