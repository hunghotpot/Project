"use client"

import { useState } from "react"
import { adjustStockAction } from "@/app/actions/admin-products"
import { AdminModal, ModalActions } from "@/components/admin/modal/admin-modal"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import { toast } from "sonner"

export interface StockVariant {
  variantId: string
  color: string
  size: string
  stock: number
}

type Mode = "add" | "set"

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "add", label: "Cộng thêm", hint: "Nhập số lượng nhập thêm (số âm để trừ khi kiểm kê). Cộng thẳng vào tồn hiện tại nên không đè lên đơn đang đặt." },
  { value: "set", label: "Đặt lại số", hint: "Đặt tồn kho đúng bằng số bạn nhập (dùng khi kiểm kê)." },
]

const FORM_ID = "stock-form"

/** Modal nhỏ của nút "Nhập": mỗi biến thể một ô số lượng; chỉ gửi các ô đã điền. */
export function StockModal({ open, onClose, productName, variants }: { open: boolean; onClose: () => void; productName: string; variants: StockVariant[] }) {
  return (
    <AdminModal open={open} onOpenChange={(next) => !next && onClose()} title="Nhập kho" description={productName} size="md">
      <StockForm variants={variants} onClose={onClose} />
    </AdminModal>
  )
}

function StockForm({ variants, onClose }: { variants: StockVariant[]; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("add")
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { pending, run } = useAdminAction()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const items: { variantId: string; change: { delta: number } | { newStock: number } }[] = []
    for (const v of variants) {
      const raw = (values[v.variantId] ?? "").trim()
      if (raw === "") continue
      if (!/^-?\d+$/.test(raw)) return setError(`Số lượng của ${v.color} / ${v.size} phải là số nguyên`)
      const n = Number(raw)
      if (mode === "add") {
        if (n === 0) continue
        items.push({ variantId: v.variantId, change: { delta: n } })
      } else {
        if (n < 0) return setError(`Tồn kho của ${v.color} / ${v.size} không được âm`)
        items.push({ variantId: v.variantId, change: { newStock: n } })
      }
    }
    if (items.length === 0) {
      setError("Chưa nhập số lượng nào")
      return toast.error("Chưa nhập số lượng nào")
    }
    setError(null)
    run(() => adjustStockAction(items), { onSuccess: onClose })
  }

  const hint = MODES.find((m) => m.value === mode)!.hint

  return (
    <>
      <form id={FORM_ID} noValidate onSubmit={submit} className="space-y-4">
        <div role="group" aria-label="Cách nhập" className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "h-10 rounded-xl border px-4 text-label font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                mode === m.value ? "border-ink bg-ink text-white" : "border-border bg-card text-sidebar-foreground hover:bg-secondary"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{hint}</p>

        <ul className="space-y-2">
          {variants.map((v) => (
            <li key={v.variantId} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 rounded-xl border border-border px-4 py-2.5">
              <label htmlFor={`stock-${v.variantId}`} className="min-w-0 text-label">
                <span className="block truncate font-bold">
                  {v.color} / {v.size}
                </span>
                <span className="text-xs text-muted-foreground">Hiện có: {v.stock}</span>
              </label>
              <Input
                id={`stock-${v.variantId}`}
                value={values[v.variantId] ?? ""}
                inputMode="numeric"
                size="sm"
                placeholder={mode === "add" ? "+0" : String(v.stock)}
                onChange={(e) => setValues((prev) => ({ ...prev, [v.variantId]: e.target.value }))}
              />
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </form>
      <DialogFooter>
        <ModalActions submitLabel="Cập nhật kho" pending={pending} formId={FORM_ID} onCancel={onClose} />
      </DialogFooter>
    </>
  )
}
