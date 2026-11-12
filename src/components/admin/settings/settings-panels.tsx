import { AdminTable, AdminTr } from "@/components/admin/list/admin-table"
import { FormField } from "@/components/admin/modal/form-field"
import { NotConnectedButton } from "@/components/admin/placeholder/not-connected-button"
import { StatusPill, type PillTone } from "@/components/admin/status-pill"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatVnd } from "@/lib/format"
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory"
import { PAYMENT_METHOD_LABEL, SUPPORTED_PAYMENT_METHODS } from "@/lib/order"
import { FLAT_SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping"
import { SITE_NAME } from "@/lib/site"

const READONLY = "bg-secondary/60"
const FROM_CODE = "Giá trị lấy từ hằng số trong code, chưa sửa được ở đây."

function Card({ title, id, action, children }: { title: string; id: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-bold">
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function SwitchRow({ id, label, hint }: { id: string; label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
      <div>
        <label htmlFor={id} className="text-label font-bold">
          {label}
        </label>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} disabled />
    </div>
  )
}

/** Tab 1: Cửa hàng & Brand (Figma 06). */
export function StorePanel() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Thông tin thương hiệu" id="brand-title">
        <FormField label="Tên thương hiệu (Logo text)" htmlFor="brand-name" hint={FROM_CODE}>
          <Input id="brand-name" value={SITE_NAME} readOnly className={READONLY} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Hotline hỗ trợ CSKH" htmlFor="brand-hotline">
            <Input id="brand-hotline" inputMode="tel" placeholder="Chưa có cấu hình" />
          </FormField>
          <FormField label="Email liên hệ" htmlFor="brand-email">
            <Input id="brand-email" type="email" placeholder="Chưa có cấu hình" />
          </FormField>
        </div>
        <FormField label="Địa chỉ văn phòng / Store chính" htmlFor="brand-address" hint="Thông tin này sẽ hiển thị tại Header & Footer của trang khách hàng khi được kết nối.">
          <Input id="brand-address" placeholder="Chưa có cấu hình" />
        </FormField>
      </Card>

      <Card title="Quy tắc kho & Đặt hàng" id="rules-title">
        <FormField label="Mức tồn kho tối thiểu để kích hoạt cảnh báo" htmlFor="rule-low-stock" hint={`${FROM_CODE} Biến thể có tồn ≤ mức này được gắn "Sắp hết".`}>
          <Input id="rule-low-stock" value={`${LOW_STOCK_THRESHOLD} đôi/cái`} readOnly className={READONLY} />
        </FormField>
        <FormField label="Ngưỡng đơn hàng miễn phí vận chuyển tự động" htmlFor="rule-free-ship" hint={FROM_CODE}>
          <Input id="rule-free-ship" value={formatVnd(FREE_SHIPPING_THRESHOLD)} readOnly className={READONLY} />
        </FormField>
        <SwitchRow id="rule-preorder" label="Cho phép khách đặt hàng trước khi hết kho (Pre-order)" hint="Tính năng chưa được hỗ trợ." />
        <SwitchRow id="rule-boom" label="Tự động cảnh báo tài khoản boom hàng" hint="Tính năng chưa được hỗ trợ." />
      </Card>
    </div>
  )
}

/** Tab 2: Cổng thanh toán. Chỉ hiển thị phương thức mà code đang hỗ trợ. */
export function PaymentPanel() {
  return (
    <Card title="Phương thức thanh toán đang hỗ trợ" id="payment-title">
      <ul className="space-y-3">
        {SUPPORTED_PAYMENT_METHODS.map((m) => (
          <li key={m} className="flex items-center justify-between gap-4 rounded-2xl border border-border px-5 py-4">
            <div>
              <p className="text-label font-bold">{PAYMENT_METHOD_LABEL[m] ?? m}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m === "VNPAY" ? "Cần cấu hình biến môi trường VNP_* ở máy chủ." : m === "BANK_TRANSFER" ? "Thông tin tài khoản nhận tiền đặt trong cấu hình máy chủ." : "Thu tiền khi giao hàng."}
              </p>
            </div>
            <StatusPill tone="success">Đang hỗ trợ</StatusPill>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Danh sách lấy từ code (chỉ đọc). Bật/tắt cổng và nhập khoá API sẽ làm sau khi có bảng cấu hình.</p>
    </Card>
  )
}

/** Tab 3: Vận chuyển & Kho. */
export function ShippingPanel() {
  return (
    <Card title="Phí vận chuyển & Tồn kho" id="shipping-title">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Phí vận chuyển đồng giá" htmlFor="ship-flat" hint={FROM_CODE}>
          <Input id="ship-flat" value={formatVnd(FLAT_SHIPPING_FEE)} readOnly className={READONLY} />
        </FormField>
        <FormField label="Miễn phí vận chuyển từ" htmlFor="ship-free" hint={FROM_CODE}>
          <Input id="ship-free" value={formatVnd(FREE_SHIPPING_THRESHOLD)} readOnly className={READONLY} />
        </FormField>
        <FormField label="Ngưỡng cảnh báo tồn kho thấp" htmlFor="ship-low" hint={FROM_CODE}>
          <Input id="ship-low" value={String(LOW_STOCK_THRESHOLD)} readOnly className={READONLY} />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">Chưa có tích hợp đơn vị vận chuyển hay bảng phí theo vùng.</p>
    </Card>
  )
}

interface DemoAdmin {
  initials: string
  name: string
  role: string
  roleTone: PillTone
  scope: string
}

// Hiện schema chỉ có CUSTOMER/ADMIN; các vai trò nhân viên dưới đây là minh hoạ, không phải tài khoản thật.
const DEMO_ADMINS: DemoAdmin[] = [
  { initials: "SA", name: "Quản trị viên chính", role: "Super Admin", roleTone: "danger", scope: "Toàn quyền hệ thống" },
  { initials: "TK", name: "Nhân viên kho", role: "Quản lý Kho", roleTone: "info", scope: "Chỉ Tồn kho & Đơn hàng" },
  { initials: "CS", name: "Nhân viên CSKH", role: "Nhân viên CSKH", roleTone: "success", scope: "Chỉ Khách hàng & Voucher" },
]

const ADMIN_COLUMNS = [
  { label: "Quản trị viên" },
  { label: "Vai trò / Phân quyền" },
  { label: "Phạm vi quản lý" },
  { label: "Lần đăng nhập cuối" },
  { label: "Thao tác", className: "text-right" },
]

/** Tab 4: danh sách tài khoản quản trị minh hoạ (Figma đặt khối này dưới tab 1). */
export function AdminAccountsPanel() {
  return (
    <Card
      title="Danh sách tài khoản quản trị (Staff & Admin)"
      id="admins-title"
      action={
        <NotConnectedButton variant="dark" size="md">
          + Thêm Admin
        </NotConnectedButton>
      }
    >
      <p className="rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
        Minh hoạ: hệ thống hiện chỉ có hai vai trò CUSTOMER và ADMIN. Các dòng dưới đây không phải tài khoản thật.
      </p>
      <AdminTable columns={ADMIN_COLUMNS} minWidth={760} caption="Tài khoản quản trị (minh hoạ)">
        {DEMO_ADMINS.map((a, i) => (
          <AdminTr key={a.initials}>
            <td>
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{a.initials}</span>
                <div>
                  <p className="font-bold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">Minh hoạ</p>
                </div>
              </div>
            </td>
            <td>
              <StatusPill tone={a.roleTone}>{a.role}</StatusPill>
            </td>
            <td className="text-muted-foreground">{a.scope}</td>
            <td className="text-muted-foreground">—</td>
            <td className="text-right whitespace-nowrap">
              {i === 0 ? (
                <span className="text-muted-foreground">Mặc định</span>
              ) : (
                <>
                  <NotConnectedButton variant="link" size="sm" className="mr-3 text-foreground">
                    Sửa
                  </NotConnectedButton>
                  <NotConnectedButton variant="link" size="sm" className="text-destructive">
                    Xóa
                  </NotConnectedButton>
                </>
              )}
            </td>
          </AdminTr>
        ))}
      </AdminTable>
    </Card>
  )
}
