import Link from "next/link"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import { cn } from "cn"
import { buildListHref, pageRange, pageWindow, type RawSearchParams } from "@/lib/admin-list"

const BTN =
  "grid size-10 place-items-center rounded-xl border text-label font-bold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30"

/**
 * Chân bảng (Figma): "Hiển thị 1 - 5 trong tổng số N <noun>" bên trái, nút số trang bên phải.
 * Server component: mỗi nút là một <Link> giữ nguyên các tham số lọc khác, chỉ đổi ?page=.
 */
export function AdminPagination({
  page,
  pageSize,
  total,
  noun,
  basePath,
  searchParams,
}: {
  page: number
  pageSize: number
  total: number
  /** "khách hàng", "đơn hàng"… */
  noun: string
  basePath: string
  searchParams: RawSearchParams
}) {
  const range = pageRange(page, pageSize, total)
  if (!range) return null
  const pageCount = Math.ceil(total / pageSize)
  const href = (p: number) => buildListHref(basePath, searchParams, { page: p === 1 ? undefined : p })

  return (
    <nav aria-label="Phân trang" className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
      <p className="text-xs text-muted-foreground">
        Hiển thị {range.from} - {range.to} trong tổng số {total.toLocaleString("vi-VN")} {noun}
      </p>

      {pageCount > 1 && (
        <ul className="flex items-center gap-2">
          {page > 1 && (
            <li>
              <Link href={href(page - 1)} aria-label="Trang trước" className={cn(BTN, "border-border bg-card hover:bg-secondary")}>
                <ArrowLeftIcon className="size-4" aria-hidden />
              </Link>
            </li>
          )}
          {pageWindow(page, pageCount).map((p) => (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(BTN, p === page ? "border-ink bg-ink text-white" : "border-border bg-card hover:bg-secondary")}
              >
                {p}
              </Link>
            </li>
          ))}
          {page < pageCount && (
            <li>
              <Link href={href(page + 1)} aria-label="Trang sau" className={cn(BTN, "border-border bg-card hover:bg-secondary")}>
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </li>
          )}
        </ul>
      )}
    </nav>
  )
}
