"use client"

import { PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { emptyGroup, emptyRow, totalStock, type ColorGroupState } from "./product-form-state"

/*
 * Bảng "Phân loại Kích cỡ (Size) & Tồn kho ban đầu" (Figma), gom theo màu: mỗi màu có tên + ô chọn mã màu và các dòng size/tồn.
 * `errors` là bản đồ "variants.<i>.<trường>" → thông báo, với <i> là chỉ số trong dãy biến thể phẳng theo thứ tự hiển thị.
 */
export function VariantEditor({
  groups,
  onChange,
  errors,
  editing,
  disabled,
}: {
  groups: ColorGroupState[]
  onChange: (groups: ColorGroupState[]) => void
  errors: Record<string, string>
  /** Đang sửa sản phẩm có sẵn: hiện SKU từng biến thể và nhắc về ô tồn kho. */
  editing: boolean
  disabled?: boolean
}) {
  const setGroup = (key: string, patch: Partial<ColorGroupState>) => onChange(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)))
  const setRow = (gKey: string, rKey: string, patch: { size?: string; stock?: string }) =>
    onChange(groups.map((g) => (g.key === gKey ? { ...g, rows: g.rows.map((r) => (r.key === rKey ? { ...r, ...patch } : r)) } : g)))

  let flat = 0 // chỉ số biến thể phẳng, tăng dần theo thứ tự render

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-secondary/50 p-4">
      {groups.map((g, gi) => {
        const first = flat
        const colorError = g.rows.map((_, ri) => errors[`variants.${first + ri}.color`] ?? errors[`variants.${first + ri}.colorHex`]).find(Boolean)
        return (
          <fieldset key={g.key} className="space-y-3 rounded-xl border border-border bg-card p-3">
            <legend className="sr-only">Màu {gi + 1}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={g.colorHex}
                disabled={disabled}
                aria-label={`Mã màu ${g.color || gi + 1}`}
                onChange={(e) => setGroup(g.key, { colorHex: e.target.value })}
                className="size-10 shrink-0 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
              />
              <Input
                value={g.color}
                disabled={disabled}
                placeholder="Tên màu (vd: Đen)"
                aria-label={`Tên màu ${gi + 1}`}
                aria-invalid={colorError ? true : undefined}
                maxLength={40}
                size="sm"
                className="min-w-0 flex-1"
                onChange={(e) => setGroup(g.key, { color: e.target.value })}
              />
              {groups.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={`Xoá màu ${g.color || gi + 1}`}
                  onClick={() => onChange(groups.filter((x) => x.key !== g.key))}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              )}
            </div>
            {colorError && (
              <p role="alert" className="text-xs text-destructive">
                {colorError}
              </p>
            )}

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] gap-x-3 gap-y-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <span>Size</span>
              <span>Số lượng trong kho</span>
              <span className="text-right">Xóa</span>
            </div>
            <ul className="space-y-2">
              {g.rows.map((r) => {
                const i = flat++
                const sizeError = errors[`variants.${i}.size`]
                const stockError = errors[`variants.${i}.stock`]
                const skuError = errors[`variants.${i}.sku`]
                return (
                  <li key={r.key} className="space-y-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-x-3">
                      <Input
                        value={r.size}
                        disabled={disabled}
                        placeholder="M, 40…"
                        aria-label={`Size, màu ${g.color || gi + 1}`}
                        aria-invalid={sizeError ? true : undefined}
                        maxLength={20}
                        size="sm"
                        onChange={(e) => setRow(g.key, r.key, { size: e.target.value })}
                      />
                      <Input
                        value={r.stock}
                        disabled={disabled}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`Số lượng trong kho, size ${r.size || "mới"}, màu ${g.color || gi + 1}`}
                        aria-invalid={stockError ? true : undefined}
                        size="sm"
                        onChange={(e) => setRow(g.key, r.key, { stock: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled || g.rows.length === 1}
                        aria-label={`Xoá size ${r.size || "mới"}`}
                        onClick={() => setGroup(g.key, { rows: g.rows.filter((x) => x.key !== r.key) })}
                      >
                        <XIcon className="text-destructive" aria-hidden />
                      </Button>
                    </div>
                    {(sizeError || stockError || skuError) && (
                      <p role="alert" className="text-xs text-destructive">
                        {sizeError ?? stockError ?? skuError}
                      </p>
                    )}
                    {editing && r.sku && <p className="text-2xs text-muted-foreground">SKU: {r.sku}</p>}
                  </li>
                )
              })}
            </ul>
            <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => setGroup(g.key, { rows: [...g.rows, emptyRow()] })}>
              <PlusIcon aria-hidden /> Thêm Size
            </Button>
          </fieldset>
        )
      })}

      {errors.variants && (
        <p role="alert" className="text-xs text-destructive">
          {errors.variants}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...groups, emptyGroup()])}>
          <PlusIcon aria-hidden /> Thêm màu
        </Button>
        <p className="text-label font-bold">
          Tổng cộng: <span className="text-brand">{totalStock(groups).toLocaleString("vi-VN")} cái</span>
        </p>
      </div>
      {editing && (
        <p className="text-xs text-muted-foreground">
          Số lượng ở đây sẽ được đặt lại đúng bằng số bạn nhập. Muốn cộng thêm hàng mới nhập một cách an toàn, hãy dùng nút Nhập ở bảng.
        </p>
      )}
    </div>
  )
}
