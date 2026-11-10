"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function CopyButton({
  value,
  label = "Copy",
  variant = "dark",
  size = "sm",
}: {
  value: string
  label?: string
  variant?: "dark" | "default" | "secondary"
  size?: "xs" | "sm"
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Đã sao chép")
    } catch {
      toast.error("Không sao chép được, vui lòng chép thủ công")
    }
  }
  return (
    <Button type="button" variant={variant} size={size} shape="rounded" onClick={copy}>
      {label}
    </Button>
  )
}
