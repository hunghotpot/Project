import { cn } from "cn"
import type { CustomerTier } from "@/lib/customer-tier"

/** Avatar chữ cái đầu (Figma): VIP nền ink, khách bị khóa nền brand nhạt, còn lại nền xám. */
export function CustomerAvatar({
  initial,
  tier,
  locked,
  className,
}: {
  initial: string
  tier: CustomerTier
  locked: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full text-sm font-bold",
        locked ? "bg-brand-soft text-brand" : tier === "VIP" ? "bg-ink text-white" : "bg-secondary text-muted-foreground",
        className
      )}
    >
      {initial}
    </span>
  )
}
