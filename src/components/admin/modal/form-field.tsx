import { cn } from "cn"
import { Label } from "@/components/ui/label"

/**
 * Một ô form Admin: nhãn đậm (+ dấu * brand nếu bắt buộc), điều khiển, rồi gợi ý hoặc lỗi.
 * Đặt `id` cho điều khiển và truyền cùng giá trị vào `htmlFor`; ô lỗi nên có `aria-invalid` ở điều khiển.
 */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
