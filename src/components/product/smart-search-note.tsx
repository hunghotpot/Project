import { InfoIcon, SparklesIcon, WandSparklesIcon } from "lucide-react"

/**
 * Điều đã hiểu từ câu tìm kiếm (chỉ đọc; muốn đổi thì sửa câu tìm kiếm). Dữ liệu thuần, không kéo code server vào component.
 * `semantic`: có dùng vector (người đã đăng nhập, AI bật). `keyword`: chỉ hiểu câu bằng code và xếp theo từ khoá.
 */
export interface SmartSearchSummary {
  mode: "semantic" | "keyword"
  chips: { label: string; soft: boolean }[]
  /** Điều đã nới để có kết quả. */
  relaxed: string[]
  /** Lý do vector tạm không dùng được (khi có cấu hình AI nhưng lỗi). */
  notice?: string
  /** Kho chưa có loại khách hỏi. */
  outOfScope?: string
}

export function SmartSearchNote({ smart }: { smart: SmartSearchSummary }) {
  const semantic = smart.mode === "semantic"
  const messages = [smart.outOfScope, ...smart.relaxed, smart.notice].filter(Boolean) as string[]
  if (!semantic && smart.chips.length === 0 && messages.length === 0) return null

  const Icon = semantic ? SparklesIcon : WandSparklesIcon
  return (
    <section aria-label="Điều đã hiểu từ câu tìm kiếm" className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold">
        <Icon aria-hidden className="size-3.5 text-primary" />
        {semantic ? "Tìm kiếm thông minh" : "Đã hiểu câu tìm kiếm"} · sắp xếp theo mức phù hợp
      </p>
      {smart.chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Điều kiện đã hiểu">
          {smart.chips.map((c) => (
            <li
              key={c.label}
              title={c.soft ? "Chỉ ưu tiên xếp hạng, không loại sản phẩm" : "Chỉ hiện sản phẩm thoả điều kiện này"}
              className={
                c.soft
                  ? "inline-flex h-7 items-center rounded-full border border-border-strong px-3 text-xs text-muted-foreground"
                  : "inline-flex h-7 items-center rounded-full bg-secondary px-3 text-xs font-bold"
              }
            >
              {c.label}
            </li>
          ))}
        </ul>
      )}
      {messages.map((m) => (
        <p key={m} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
          {m}
        </p>
      ))}
    </section>
  )
}
