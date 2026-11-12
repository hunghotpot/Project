import { cn } from "cn"

/*
 * Bảng danh sách Admin (Figma): đầu bảng xám nhạt bo tròn, mỗi hàng là một "thẻ" viền mảnh bo tròn.
 * Dùng: <ListCard><AdminTable columns={[...]}> <AdminTr><td>..</td></AdminTr> </AdminTable><AdminPagination/></ListCard>
 * Ô dữ liệu viết thẳng <td>: kiểu hàng được áp bằng selector con của AdminTr.
 */

export interface AdminColumn {
  label: string
  /** Vd "text-right" cho cột thao tác/tiền. */
  className?: string
}

const HEAD = "px-3 py-3 text-left text-xs font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase"

/** Khung thẻ bo lớn chứa bảng và phân trang. */
export function ListCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-border bg-card p-4 sm:p-5", className)}>{children}</div>
}

/** Tiêu đề khối danh sách ("Danh Sách Khách Hàng") + nội dung bên dưới. */
export function ListSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function AdminTable({
  columns,
  children,
  minWidth = 720,
  caption,
}: {
  columns: AdminColumn[]
  children: React.ReactNode
  /** px: dưới mức này bảng cuộn ngang thay vì bóp cột. */
  minWidth?: number
  caption?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-secondary/70">
            {columns.map((c, i) => (
              <th
                key={c.label}
                scope="col"
                className={cn(HEAD, i === 0 && "rounded-l-xl", i === columns.length - 1 && "rounded-r-xl", c.className)}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function AdminTr({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "text-label [&>td]:border-y [&>td]:border-border [&>td]:px-3 [&>td]:py-4 [&>td:first-child]:rounded-l-2xl [&>td:first-child]:border-l [&>td:last-child]:rounded-r-2xl [&>td:last-child]:border-r",
        className
      )}
      {...props}
    />
  )
}

/** Trạng thái rỗng (không có dữ liệu / không khớp bộ lọc). */
export function AdminEmpty({ title = "Không có dữ liệu", hint }: { title?: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-label font-bold">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
