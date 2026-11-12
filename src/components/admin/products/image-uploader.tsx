"use client"

import { useRef, useState } from "react"
import { ImagePlusIcon, XIcon } from "lucide-react"
import { cn } from "cn"

const ACCEPT = "image/jpeg,image/png,image/webp"
const MAX_MB = 5

/*
 * Ô "Hình ảnh sản phẩm" (Figma): khung nét đứt "Tải lên từ máy tính (Tối đa N ảnh)", ảnh đã tải hiện thành ô nhỏ có nút xoá.
 * Tải lên qua POST /api/admin/uploads (server kiểm quyền, loại file thật, dung lượng và tự đặt tên); component chỉ giữ danh sách URL.
 * Kiểm tra ở client (loại, dung lượng, số lượng) chỉ để báo lỗi sớm: server luôn kiểm lại.
 */
export function ImageUploader({
  value,
  onChange,
  max,
  error,
  disabled,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  max: number
  error?: string
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const remaining = max - value.length

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // cho phép chọn lại cùng một file
    if (files.length === 0) return
    setMessage(null)

    if (files.length > remaining) return setMessage(`Chỉ còn thêm được ${Math.max(remaining, 0)} ảnh (tối đa ${max} ảnh)`)
    if (files.some((f) => f.size > MAX_MB * 1024 * 1024)) return setMessage(`Mỗi ảnh tối đa ${MAX_MB}MB`)
    if (files.some((f) => !ACCEPT.split(",").includes(f.type))) return setMessage("Chỉ nhận ảnh JPG, PNG hoặc WebP")

    const form = new FormData()
    for (const f of files) form.append("files", f)
    setUploading(true)
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body: form })
      const body = (await res.json().catch(() => null)) as { urls?: string[]; message?: string } | null
      if (!res.ok || !body?.urls) return setMessage(body?.message ?? "Tải ảnh thất bại, vui lòng thử lại")
      onChange([...value, ...body.urls].slice(0, max))
    } catch {
      setMessage("Không kết nối được máy chủ, vui lòng thử lại")
    } finally {
      setUploading(false)
    }
  }

  const shown = message ?? error

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <li key={url} className="relative size-20 overflow-hidden rounded-xl border border-border bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Ảnh sản phẩm ${i + 1}`} className="size-full object-cover" />
              {i === 0 && <span className="absolute bottom-0 left-0 rounded-tr-lg bg-ink px-1.5 py-0.5 text-2xs font-bold text-white">Ảnh chính</span>}
              <button
                type="button"
                disabled={disabled || uploading}
                aria-label={`Xoá ảnh ${i + 1}`}
                onClick={() => onChange(value.filter((u) => u !== url))}
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-ink/80 text-white outline-none hover:bg-ink focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={onPick} aria-label="Chọn ảnh sản phẩm" />
      <button
        type="button"
        disabled={disabled || uploading || remaining <= 0}
        onClick={() => input.current?.click()}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-4 text-label font-bold text-sidebar-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
          shown && "border-destructive"
        )}
      >
        <ImagePlusIcon className="size-4" aria-hidden />
        {uploading ? "Đang tải lên..." : `Tải lên từ máy tính (Tối đa ${max} ảnh)`}
      </button>
      {shown && (
        <p role="alert" className="text-xs text-destructive">
          {shown}
        </p>
      )}
    </div>
  )
}
