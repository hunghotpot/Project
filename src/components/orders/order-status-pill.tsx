import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import type { OrderStatusValue } from "@/types/order"

// Figma: pill có chấm màu. Thẻ đơn hàng gọi SHIPPING là "Đang vận chuyển" (bộ lọc/timeline dùng "Đang giao hàng").
const PILL: Record<OrderStatusValue, { label: string; variant: "warning" | "info" | "success" | "default" }> = {
  PENDING: { label: "Chờ xác nhận", variant: "warning" },
  CONFIRMED: { label: "Đã xác nhận", variant: "info" },
  SHIPPING: { label: "Đang vận chuyển", variant: "info" },
  DELIVERED: { label: "Hoàn thành", variant: "success" },
  CANCELLED: { label: "Đã hủy", variant: "default" },
}

export function OrderStatusPill({
  status,
  uppercase = false,
  className,
}: {
  status: OrderStatusValue
  uppercase?: boolean
  className?: string
}) {
  const { label, variant } = PILL[status]
  return (
    <Badge variant={variant} className={cn("h-7 gap-2 px-4", uppercase && "uppercase", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  )
}
