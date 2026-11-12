import { cn } from "cn"
import { AdminEmpty, AdminTable, AdminTr } from "@/components/admin/list/admin-table"
import { NotConnectedButton } from "@/components/admin/placeholder/not-connected-button"
import { StatusPill } from "@/components/admin/status-pill"
import { type DemoVoucher, VOUCHER_STATUS_LABEL, VOUCHER_STATUS_TONE } from "./voucher-demo-data"

const COLUMNS = [
  { label: "Mã code" },
  { label: "Chương trình & mức giảm" },
  { label: "Điều kiện áp dụng" },
  { label: "Đã dùng / Giới hạn" },
  { label: "Hạn dùng" },
  { label: "Trạng thái" },
  { label: "Thao tác", className: "text-right" },
]

const BENEFIT_TONE = { brand: "text-brand", success: "text-success", neutral: "text-muted-foreground" } as const

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div className="min-w-32">
      <p className="font-bold">
        {used.toLocaleString("vi-VN")} / {limit.toLocaleString("vi-VN")}
      </p>
      <div
        role="progressbar"
        aria-label="Đã dùng"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-brand" : "bg-ink")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function VoucherTable({ vouchers }: { vouchers: DemoVoucher[] }) {
  if (vouchers.length === 0) return <AdminEmpty title="Không có mã nào khớp bộ lọc." />
  return (
    <AdminTable columns={COLUMNS} minWidth={980} caption="Danh sách mã ưu đãi (minh hoạ)">
      {vouchers.map((v) => {
        const inactive = v.status === "EXPIRED" || v.status === "EXHAUSTED"
        return (
          <AdminTr key={v.code}>
            <td>
              <span className={cn("inline-block rounded-xl px-4 py-2 text-xs font-bold", v.status === "ACTIVE" ? "bg-ink text-white" : "bg-secondary text-foreground")}>
                {v.code}
              </span>
            </td>
            <td>
              <p className="font-bold">{v.name}</p>
              <p className={cn("mt-1 text-xs font-bold", BENEFIT_TONE[v.benefitTone])}>{v.benefit}</p>
            </td>
            <td>
              <p className="font-bold">{v.minOrder}</p>
              <p className="mt-1 text-xs text-muted-foreground">{v.scope}</p>
            </td>
            <td>
              <UsageBar used={v.used} limit={v.limit} />
            </td>
            <td className="whitespace-nowrap text-muted-foreground">{v.expiry}</td>
            <td>
              <StatusPill tone={VOUCHER_STATUS_TONE[v.status]}>{VOUCHER_STATUS_LABEL[v.status]}</StatusPill>
            </td>
            <td className="text-right whitespace-nowrap">
              <NotConnectedButton variant="link" size="sm" className="mr-3 text-foreground">
                Sửa
              </NotConnectedButton>
              <NotConnectedButton variant="link" size="sm" className={v.status === "UPCOMING" || !inactive ? "text-destructive" : "text-muted-foreground"}>
                {v.status === "UPCOMING" ? "Xóa" : "Tắt"}
              </NotConnectedButton>
            </td>
          </AdminTr>
        )
      })}
    </AdminTable>
  )
}
