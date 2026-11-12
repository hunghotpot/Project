import { cn } from "cn"
import { AdminEmpty, AdminTable, AdminTr } from "@/components/admin/list/admin-table"
import { StatusPill, type PillTone } from "@/components/admin/status-pill"
import { formatVnd } from "@/lib/format"
import { buildListHref, type RawSearchParams } from "@/lib/admin-list"
import { STOCK_STATUS_LABEL, type StockStatus } from "@/lib/inventory"
import type { AdminProductListItem } from "@/server/services/admin-product.service"
import { ProductRowActions } from "./row-actions"

const COLUMNS = [
  { label: "Mã SKU" },
  { label: "Sản phẩm" },
  { label: "Chi tiết màu & size" },
  { label: "Giá bán" },
  { label: "Tồn kho" },
  { label: "Trạng thái" },
  { label: "Thao tác", className: "text-right" },
]

const TONE: Record<StockStatus, PillTone> = { IN_STOCK: "success", LOW: "warning", OUT: "danger" }
const SIZE_CLASS: Record<StockStatus, string> = { IN_STOCK: "text-muted-foreground", LOW: "font-bold text-warning", OUT: "font-bold text-brand" }
const TOTAL_CLASS: Record<StockStatus, string> = { IN_STOCK: "", LOW: "text-warning", OUT: "text-brand" }

function priceLabel(p: AdminProductListItem) {
  return p.priceMax > p.priceMin ? `${formatVnd(p.priceMin)} – ${formatVnd(p.priceMax)}` : formatVnd(p.priceMin)
}

export function ProductTable({ items, searchParams }: { items: AdminProductListItem[]; searchParams: RawSearchParams }) {
  if (items.length === 0) return <AdminEmpty title="Không có sản phẩm nào." hint="Thử đổi từ khoá hoặc bộ lọc, hoặc thêm sản phẩm mới." />

  return (
    <AdminTable columns={COLUMNS} minWidth={980} caption="Kho hàng sản phẩm">
      {items.map((p) => (
        <AdminTr key={p.id} className={cn(!p.isActive && "bg-secondary/40")}>
          <td className="font-bold whitespace-nowrap" title={p.skus.join(", ")}>
            {p.skus[0] ?? "—"}
            {p.skus.length > 1 && <span className="block text-xs font-normal text-muted-foreground">+{p.skus.length - 1} SKU</span>}
          </td>
          <td>
            <div className="flex min-w-0 items-center gap-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image.url} alt={p.image.alt} className="size-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category.name}</p>
              </div>
            </div>
          </td>
          <td className="space-y-1">
            {p.colors.length === 0 && <span className="text-xs text-muted-foreground">Chưa có size/màu</span>}
            {p.colors.map((c) => (
              <div key={c.color} className="text-xs">
                <p className="flex items-center gap-1.5 font-bold text-label">
                  <span aria-hidden className="size-2.5 rounded-full border border-border" style={{ backgroundColor: c.colorHex }} />
                  Màu: {c.color}
                </p>
                <p>
                  <span className="text-muted-foreground">Size: </span>
                  {c.sizes.map((s, i) => (
                    <span key={s.variantId} className={SIZE_CLASS[s.status]}>
                      {i > 0 && ", "}
                      {s.size} ({s.stock})
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </td>
          <td className="font-bold whitespace-nowrap">{priceLabel(p)}</td>
          <td className={cn("font-bold whitespace-nowrap", TOTAL_CLASS[p.status])}>{p.totalStock.toLocaleString("vi-VN")} cái</td>
          <td>
            <div className="flex flex-col items-start gap-1.5">
              <StatusPill tone={TONE[p.status]}>{STOCK_STATUS_LABEL[p.status]}</StatusPill>
              {!p.isActive && (
                <StatusPill tone="neutral" title="Sản phẩm đang ẩn khỏi cửa hàng">
                  Đang ẩn
                </StatusPill>
              )}
            </div>
          </td>
          <td>
            <ProductRowActions
              productId={p.id}
              name={p.name}
              isActive={p.isActive}
              editHref={buildListHref("/admin/products", searchParams, { edit: p.id })}
              variants={p.colors.flatMap((c) => c.sizes.map((s) => ({ variantId: s.variantId, color: c.color, size: s.size, stock: s.stock })))}
            />
          </td>
        </AdminTr>
      ))}
    </AdminTable>
  )
}
