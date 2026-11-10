"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { searchQuerySchema } from "@/lib/validators/search"

// Figma: pill nền secondary, placeholder 13px. Hiện tại chỉ điều hướng sang /products?q=...
export function SearchForm({ className }: { className?: string }) {
  const router = useRouter()
  const [value, setValue] = useState("")

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = searchQuerySchema.safeParse({ q: value })
    // Chưa nhập gì mà bấm kính lúp → sang trang tất cả sản phẩm.
    if (!parsed.success) return router.push("/products")
    router.push(`/products?${new URLSearchParams({ q: parsed.data.q })}`)
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <button
        type="submit"
        aria-label="Tìm kiếm"
        className="absolute top-1/2 left-2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-subtle-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <SearchIcon aria-hidden className="size-4" />
      </button>
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={100}
        placeholder="Tìm kiếm sản phẩm..."
        aria-label="Tìm kiếm sản phẩm"
        size="sm"
        className="h-9 rounded-full border-transparent bg-secondary pr-4 pl-10"
      />
    </form>
  )
}
