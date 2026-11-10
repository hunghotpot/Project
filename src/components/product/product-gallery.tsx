"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProductImageData } from "@/types/catalog"

const ZOOM = 2

// Figma: ảnh lớn bo 24px + nút ">" bên phải, hàng 4 thumbnail bên dưới (viền ink khi đang chọn).
// Desktop: rê chuột để phóng to tại chỗ; mọi thiết bị: bấm ảnh để xem toàn màn hình.
// Cha dùng `key` (màu đang chọn) để reset về ảnh đầu khi bộ ảnh đổi.
export function ProductGallery({ images, name }: { images: ProductImageData[]; name: string }) {
  const [index, setIndex] = useState(0)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(false)

  if (images.length === 0) {
    return (
      <div className="grid aspect-[744/520] place-items-center rounded-3xl bg-secondary text-sm text-subtle-foreground">
        [Hình ảnh sản phẩm]
      </div>
    )
  }

  const current = images[index]
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length)

  function onMove(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    setOrigin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-[744/520] overflow-hidden rounded-3xl bg-secondary">
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseMove={onMove}
          onMouseLeave={() => setOrigin(null)}
          aria-label="Phóng to ảnh"
          className="absolute inset-0 cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <Image
            src={current.url}
            alt={current.alt || name}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-transform duration-150 ease-out"
            style={origin ? { transform: `scale(${ZOOM})`, transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}
          />
        </button>
        {images.length > 1 && (
          <>
            {index > 0 && (
              <ArrowButton label="Ảnh trước" side="left" onClick={() => go(-1)}>
                <ChevronLeftIcon />
              </ArrowButton>
            )}
            <ArrowButton label="Ảnh sau" side="right" onClick={() => go(1)}>
              <ChevronRightIcon />
            </ArrowButton>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3" aria-label="Ảnh sản phẩm">
          {images.slice(0, 8).map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Xem ảnh ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "relative block aspect-[140/108] w-full overflow-hidden rounded-2xl border-2 bg-secondary outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  i === index ? "border-ink" : "border-border opacity-80 hover:opacity-100"
                )}
              >
                <Image src={img.url} alt="" fill sizes="160px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="line-clamp-1">{name}</DialogTitle>
            <DialogDescription className="sr-only">
              Ảnh {index + 1} / {images.length}
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-4/5 max-h-[75vh] w-full overflow-hidden rounded-lg bg-secondary">
            <Image src={current.url} alt={current.alt || name} fill sizes="(min-width: 768px) 48rem, 100vw" className="object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ArrowButton({
  label,
  side,
  onClick,
  children,
}: {
  label: string
  side: "left" | "right"
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      shape="rounded"
      size="icon-lg"
      aria-label={label}
      onClick={onClick}
      className={cn("absolute top-1/2 -translate-y-1/2 bg-white", side === "left" ? "left-4 md:left-8" : "right-4 md:right-8")}
    >
      {children}
    </Button>
  )
}
