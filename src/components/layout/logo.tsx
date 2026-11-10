import Link from "next/link"
import { cn } from "cn"
import { SITE_NAME } from "@/lib/site"

// Figma: khối ink bo 4px, chữ trắng 14px bold (≈132×36 ở 1440).
export function Logo({
  inverted = false,
  className,
}: {
  inverted?: boolean
  className?: string
}) {
  return (
    <Link
      href="/"
      aria-label={`${SITE_NAME} - Trang chủ`}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center rounded-sm px-5 text-sm font-bold whitespace-nowrap uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        inverted ? "bg-white text-ink" : "bg-ink text-white",
        className
      )}
    >
      {SITE_NAME}
    </Link>
  )
}
