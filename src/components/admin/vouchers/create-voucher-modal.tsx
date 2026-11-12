"use client"

import { useState } from "react"
import { cn } from "cn"
import { AdminModal, ModalActions } from "@/components/admin/modal/admin-modal"
import { FormField } from "@/components/admin/modal/form-field"
import { notifyNotConnected } from "@/components/admin/placeholder/not-connected-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DEMO_CATEGORY_ITEMS } from "./voucher-demo-data"

const FORM_ID = "create-voucher-form"

const DISCOUNT_TYPES = [
  { value: "cash", label: "Tiền mặt (VND)", amountLabel: "Số tiền giảm (VND)", hint: "Trừ trực tiếp vào tổng thanh toán", placeholder: "VD: 300000" },
  { value: "percent", label: "Theo % đơn hàng", amountLabel: "Phần trăm giảm (%)", hint: "Tính theo giá trị đơn hàng", placeholder: "VD: 20" },
  { value: "freeship", label: "Freeship", amountLabel: "Hỗ trợ phí vận chuyển tối đa (VND)", hint: "Trừ vào phí vận chuyển", placeholder: "VD: 40000" },
]

/** Nút "+ Tạo Voucher Mới" và modal Figma 08. Biểu mẫu chỉ là giao diện: Lưu hiện toast "chưa kết nối". */
export function CreateVoucherModal() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState("cash")
  const active = DISCOUNT_TYPES.find((t) => t.value === type) ?? DISCOUNT_TYPES[0]

  return (
    <>
      <Button size="md" onClick={() => setOpen(true)}>
        + Tạo Voucher Mới
      </Button>
      <AdminModal
        open={open}
        onOpenChange={setOpen}
        title="Tạo Mã Giảm Giá Mới"
        description="Thiết lập chương trình khuyến mãi và điều kiện áp dụng (minh hoạ, chưa lưu được)"
        footer={<ModalActions formId={FORM_ID} submitLabel="Lưu & Kích Hoạt" onCancel={() => setOpen(false)} />}
      >
        <form
          id={FORM_ID}
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            notifyNotConnected()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Mã Voucher (Code)" htmlFor="voucher-code" required>
              <Input id="voucher-code" placeholder="VD: THUDONG2026" className="uppercase" />
            </FormField>
            <FormField label="Tên chương trình ưu đãi" htmlFor="voucher-name" required>
              <Input id="voucher-name" placeholder="VD: Ưu đãi BST Thu Đông" />
            </FormField>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-label font-bold">Loại giảm giá</legend>
            <RadioGroup value={type} onValueChange={(v) => setType(String(v))} className="grid-cols-1 sm:grid-cols-3" aria-label="Loại giảm giá">
              {DISCOUNT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    "flex h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 text-label font-bold",
                    type === t.value ? "border-brand bg-brand-soft text-brand" : "border-border bg-card text-sidebar-foreground"
                  )}
                >
                  <RadioGroupItem value={t.value} />
                  {t.label}
                </label>
              ))}
            </RadioGroup>
          </fieldset>

          <FormField label={active.amountLabel} htmlFor="voucher-amount" required hint={active.hint}>
            <Input id="voucher-amount" inputMode="numeric" placeholder={active.placeholder} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Giá trị đơn hàng tối thiểu (VND)" htmlFor="voucher-min-order">
              <Input id="voucher-min-order" inputMode="numeric" placeholder="VD: 500000" />
            </FormField>
            <FormField label="Áp dụng danh mục" htmlFor="voucher-category">
              <Select defaultValue="all" items={DEMO_CATEGORY_ITEMS}>
                <SelectTrigger id="voucher-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_CATEGORY_ITEMS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tổng số lượt phát hành (hạn mức)" htmlFor="voucher-limit" hint="Số lượt sử dụng tối đa">
              <Input id="voucher-limit" inputMode="numeric" placeholder="VD: 500" />
            </FormField>
            <FormField label="Thời gian hết hạn" htmlFor="voucher-expiry">
              <Input id="voucher-expiry" type="date" />
            </FormField>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-secondary px-5 py-4">
            <label htmlFor="voucher-active" className="text-label font-bold">
              Kích hoạt mã ngay sau khi lưu
            </label>
            <Switch id="voucher-active" defaultChecked />
          </div>
        </form>
      </AdminModal>
    </>
  )
}
