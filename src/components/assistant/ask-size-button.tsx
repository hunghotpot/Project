"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { loginUrlFor, useAssistantAccess } from "@/components/assistant/assistant-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { useAssistantUi } from "@/stores/assistant-ui"

// Nút "Tư vấn size" trên trang chi tiết sản phẩm, đặt cạnh "Hướng dẫn chọn size".
// Khách chưa đăng nhập: dẫn sang trang đăng nhập rồi quay lại đúng sản phẩm.
export function AskSizeButton({ slug, name }: { slug: string; name: string }) {
  const { enabled, authenticated } = useAssistantAccess()
  const openChat = useAssistantUi((s) => s.openChat)
  const pathname = usePathname()
  if (!enabled) return null

  const className = "text-xs text-primary"
  if (!authenticated) {
    return (
      <Link href={loginUrlFor(pathname)} className={`${buttonVariants({ variant: "link", size: "sm" })} ${className}`}>
        Tư vấn size
      </Link>
    )
  }

  return (
    <Button type="button" variant="link" size="sm" className={className} onClick={() => openChat({ slug, name })}>
      Tư vấn size
    </Button>
  )
}
