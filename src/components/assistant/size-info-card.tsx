"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MeasureField, SizeRecommendationView } from "@/types/assistant"

// Khoảng hợp lệ lấy từ sizeAdviceInputSchema trong docs/ai/03-rag-advisor.md.
const FIELDS: Record<MeasureField, { label: string; unit: string; min: number; max: number }> = {
  heightCm: { label: "Chiều cao", unit: "cm", min: 100, max: 230 },
  weightKg: { label: "Cân nặng", unit: "kg", min: 25, max: 250 },
  chestCm: { label: "Vòng ngực", unit: "cm", min: 60, max: 160 },
  waistCm: { label: "Vòng eo", unit: "cm", min: 45, max: 160 },
  hipCm: { label: "Vòng mông", unit: "cm", min: 60, max: 170 },
}

// Thẻ "cần thêm số đo": ô nhập theo missingFields.
export function SizeInfoCard({
  data,
  onSubmit,
}: {
  data: SizeRecommendationView
  onSubmit?: (values: Partial<Record<MeasureField, number>>) => void
}) {
  const fields = data.missingFields.filter((f) => f in FIELDS)
  const [values, setValues] = useState<Partial<Record<MeasureField, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<MeasureField, string>>>({})
  const [sent, setSent] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: Partial<Record<MeasureField, string>> = {}
    const parsed: Partial<Record<MeasureField, number>> = {}
    for (const f of fields) {
      const { label, min, max } = FIELDS[f]
      const n = Number(values[f])
      if (!values[f] || !Number.isFinite(n) || n < min || n > max) {
        nextErrors[f] = `${label} cần từ ${min} đến ${max}`
      } else {
        parsed[f] = n
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setSent(true)
    onSubmit?.(parsed)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Nhập số đo" className="space-y-3 rounded-2xl border border-dashed border-border-strong bg-white p-4">
      <div>
        <p className="text-sm font-bold">Cần thêm số đo</p>
        <p className="text-xs text-muted-foreground">Để tư vấn chính xác hơn, cho mình biết:</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => {
          const { label, unit } = FIELDS[f]
          const id = `measure-${f}`
          return (
            <div key={f} className="space-y-1">
              <label htmlFor={id} className="text-xs font-bold">
                {label} ({unit})
              </label>
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                size="sm"
                variant="white"
                disabled={sent}
                value={values[f] ?? ""}
                aria-invalid={!!errors[f]}
                aria-describedby={errors[f] ? `${id}-error` : undefined}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [f]: e.target.value }))
                  setErrors((er) => ({ ...er, [f]: undefined }))
                }}
              />
              {errors[f] && (
                <p id={`${id}-error`} className="text-xs text-destructive">
                  {errors[f]}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <Button type="submit" variant="outline" size="sm" disabled={sent}>
        Gửi số đo
      </Button>
    </form>
  )
}
