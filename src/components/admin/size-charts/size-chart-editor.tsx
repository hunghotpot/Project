"use client"

import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { replaceSizeChartAction, type SizeChartIssue } from "@/app/actions/admin-size-charts"
import { AdminModal, ModalActions } from "@/components/admin/modal/admin-modal"
import { FormField } from "@/components/admin/modal/form-field"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface SizeChartRow {
  id: string
  categoryId: string
  brand: string | null
  size: string
  chest: number | null
  waist: number
  hip: number
  heightMin: number
  heightMax: number
  weightMin: number
  weightMax: number
}

/** `brand` = null: bảng chung. `fixedBrand`: đang sửa bảng có sẵn nên không đổi tên thương hiệu. */
export interface EditorTarget {
  brand: string | null
  rows: SizeChartRow[]
  fixedBrand: boolean
}

const NUM_FIELDS = ["chest", "waist", "hip", "heightMin", "heightMax", "weightMin", "weightMax"] as const
type NumField = (typeof NUM_FIELDS)[number]
type Draft = { size: string } & Record<NumField, string>

const COLUMNS: { key: "size" | NumField; label: string }[] = [
  { key: "size", label: "Size" },
  { key: "chest", label: "Ngực" },
  { key: "waist", label: "Eo" },
  { key: "hip", label: "Mông" },
  { key: "heightMin", label: "Cao từ" },
  { key: "heightMax", label: "Cao đến" },
  { key: "weightMin", label: "Nặng từ" },
  { key: "weightMax", label: "Nặng đến" },
]

const blank = (): Draft => ({ size: "", chest: "", waist: "", hip: "", heightMin: "", heightMax: "", weightMin: "", weightMax: "" })
const toDraft = (r: SizeChartRow): Draft => ({
  size: r.size,
  chest: r.chest === null ? "" : String(r.chest),
  waist: String(r.waist),
  hip: String(r.hip),
  heightMin: String(r.heightMin),
  heightMax: String(r.heightMax),
  weightMin: String(r.weightMin),
  weightMax: String(r.weightMax),
})
// Ô trống → undefined để Zod báo "phải là số" (riêng ngực trống = null, dành cho quần).
const toPayload = (d: Draft) => ({
  size: d.size,
  ...Object.fromEntries(NUM_FIELDS.map((f) => [f, d[f].trim() === "" ? (f === "chest" ? null : undefined) : Number(d[f])])),
})

const FORM_ID = "size-chart-form"

export function SizeChartEditor({ categoryId, categoryName, target, onClose }: { categoryId: string; categoryName: string; target: EditorTarget; onClose: () => void }) {
  const [brand, setBrand] = useState(target.brand ?? "")
  const [rows, setRows] = useState<Draft[]>(target.rows.length ? target.rows.map(toDraft) : [blank()])
  const [issues, setIssues] = useState<SizeChartIssue[]>([])
  const { pending, run } = useAdminAction()

  const setCell = (i: number, key: keyof Draft, value: string) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)))
  const invalid = (i: number, key: string) => issues.some((x) => x.path[0] === i && x.path[1] === key)
  const generalIssues = issues.filter((x) => typeof x.path[0] !== "number" || typeof x.path[1] !== "string")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setIssues([])
    run(
      async () => {
        const res = await replaceSizeChartAction({ categoryId, brand: brand.trim() || null, rows: rows.map(toPayload) })
        if (!res.ok) setIssues(res.issues ?? [])
        return res
      },
      { onSuccess: onClose }
    )
  }

  return (
    <AdminModal
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      size="xl"
      title={`Sửa bảng size: ${categoryName}`}
      description="Số đo là số đo cơ thể người mặc (cm/kg). Lưu sẽ thay toàn bộ bảng này; các bảng khác của danh mục không bị đụng tới."
      footer={<ModalActions submitLabel="Lưu bảng size" pending={pending} formId={FORM_ID} onCancel={onClose} />}
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-5">
        <FormField
          label="Thương hiệu"
          htmlFor="size-chart-brand"
          hint={target.fixedBrand ? "Không đổi được thương hiệu của bảng đang sửa." : "Để trống nếu là bảng chung cho cả danh mục; nhập tên nếu là bảng riêng của một thương hiệu."}
        >
          <Input id="size-chart-brand" value={brand} onChange={(e) => setBrand(e.target.value)} readOnly={target.fixedBrand} maxLength={80} placeholder="Bảng chung" />
        </FormField>

        {generalIssues.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-destructive">
            {generalIssues.map((x, i) => (
              <li key={i}>{x.message}</li>
            ))}
          </ul>
        )}

        <div className="max-h-[45vh] overflow-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-1 pb-1 text-left text-xs font-bold text-muted-foreground">
                    {c.label}
                  </th>
                ))}
                <th className="w-10" aria-label="Xóa dòng" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 align-top">
                      <Input
                        size="sm"
                        type={c.key === "size" ? "text" : "number"}
                        inputMode={c.key === "size" ? undefined : "numeric"}
                        value={r[c.key]}
                        onChange={(e) => setCell(i, c.key, e.target.value)}
                        aria-label={`${c.label}, dòng ${i + 1}`}
                        aria-invalid={invalid(i, c.key) || undefined}
                        placeholder={c.key === "chest" ? "Quần: trống" : undefined}
                        className="px-2"
                      />
                    </td>
                  ))}
                  <td className="px-1 align-top">
                    <Button type="button" variant="ghost" size="icon" aria-label={`Xóa dòng ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
                      <Trash2Icon aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {issues.some((x) => typeof x.path[0] === "number") && (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-destructive">
            {issues
              .filter((x) => typeof x.path[0] === "number")
              .map((x, i) => (
                <li key={i}>
                  Dòng {Number(x.path[0]) + 1}: {x.message}
                </li>
              ))}
          </ul>
        )}

        <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, blank()])} disabled={rows.length >= 30}>
          <PlusIcon aria-hidden /> Thêm dòng
        </Button>
      </form>
    </AdminModal>
  )
}
