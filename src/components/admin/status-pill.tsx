import { Badge } from "@/components/ui/badge"

export type PillTone = "success" | "warning" | "info" | "danger" | "neutral" | "dark"

const VARIANT = {
  success: "success",
  warning: "warning",
  info: "info",
  danger: "brand",
  neutral: "default",
  dark: "dark",
} as const

/** Pill trạng thái cỡ bảng Admin (đơn hàng, tồn kho, khách hàng, voucher). Màu lấy từ token, không tự đặt màu mới. */
export function StatusPill({ tone, children, title }: { tone: PillTone; children: React.ReactNode; title?: string }) {
  return (
    <Badge variant={VARIANT[tone]} title={title} className="h-7 px-3.5">
      {children}
    </Badge>
  )
}
