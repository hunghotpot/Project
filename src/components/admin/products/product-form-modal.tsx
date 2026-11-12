"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { saveProductAction } from "@/app/actions/admin-products"
import { AdminModal, ModalActions } from "@/components/admin/modal/admin-modal"
import { FormField } from "@/components/admin/modal/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ImageUploader } from "./image-uploader"
import { buildPayload, emptyForm, issueMap, type FormIssue, type ProductFormState } from "./product-form-state"
import { VariantEditor } from "./variant-editor"

export interface CategoryOption {
  id: string
  name: string
  children: { id: string; name: string }[]
}

export interface ProductFormOptions {
  categories: CategoryOption[]
  occasions: string[]
  seasons: string[]
  genders: { value: string; label: string }[]
  styles: { value: string; label: string }[]
  maxImages: number
  defaultBrand: string
}

const FORM_ID = "product-form"

/** Danh mục chọn được: lá của cây (danh mục gốc có con chỉ làm nhóm). Nhãn đầy đủ "Gốc / Con" để phân biệt tên trùng. */
function categoryItems(categories: CategoryOption[]) {
  return categories.flatMap((c) => (c.children.length ? c.children.map((x) => ({ value: x.id, label: `${c.name} / ${x.name}` })) : [{ value: c.id, label: c.name }]))
}

function Chips({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: string[]
  value: string[]
  onChange: (next: string[]) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
              on ? "border-ink bg-ink text-white" : "border-border bg-card text-sidebar-foreground hover:bg-secondary"
            )}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function ProductForm({
  initial,
  editing,
  options,
  issues,
  failure,
  pending,
  onSubmit,
}: {
  initial: ProductFormState
  editing: boolean
  options: ProductFormOptions
  issues: FormIssue[]
  failure: string | null
  pending: boolean
  onSubmit: (state: ProductFormState) => void
}) {
  const [s, setS] = useState(initial)
  const errors = issueMap(issues)
  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => setS((prev) => ({ ...prev, [key]: value }))
  const catItems = categoryItems(options.categories)
  const imageError = Object.entries(errors).find(([k]) => k === "images" || k.startsWith("images."))?.[1]

  return (
    <form
      id={FORM_ID}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(s)
      }}
    >
      {failure && (
        <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-label font-bold text-destructive">
          {failure}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FormField label="Tên sản phẩm" htmlFor="pf-name" required error={errors.name}>
          <Input id="pf-name" value={s.name} maxLength={200} aria-invalid={errors.name ? true : undefined} onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField
          label={editing ? "Mã SKU chung (cho size/màu mới)" : "Mã SKU"}
          htmlFor="pf-sku"
          required={!editing}
          error={errors.skuPrefix}
          hint={editing ? "Chỉ dùng cho biến thể mới thêm; SKU hiện có được giữ nguyên." : "SKU từng size được sinh dạng MÃ-MÀU-SIZE."}
        >
          <Input
            id="pf-sku"
            value={s.skuPrefix}
            maxLength={30}
            placeholder="vd: UB-22"
            className="uppercase"
            aria-invalid={errors.skuPrefix ? true : undefined}
            onChange={(e) => set("skuPrefix", e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Danh mục" htmlFor="pf-category" required error={errors.categoryId}>
          <Select items={catItems} value={s.categoryId || null} onValueChange={(v) => set("categoryId", v ?? "")}>
            <SelectTrigger id="pf-category" aria-invalid={errors.categoryId ? true : undefined}>
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent>
              {options.categories.map((c) =>
                c.children.length ? (
                  <SelectGroup key={c.id}>
                    <SelectLabel>{c.name}</SelectLabel>
                    {c.children.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Giá bán (VNĐ)" htmlFor="pf-price" required error={errors.basePrice}>
          <Input
            id="pf-price"
            value={s.basePrice}
            inputMode="numeric"
            placeholder="vd: 299000"
            className="font-bold text-brand"
            aria-invalid={errors.basePrice ? true : undefined}
            onChange={(e) => set("basePrice", e.target.value.replace(/[^\d]/g, ""))}
          />
        </FormField>
      </div>

      <FormField label="Hình ảnh sản phẩm" htmlFor="pf-images" hint="Ảnh đầu tiên là ảnh chính. JPG, PNG hoặc WebP, tối đa 5MB mỗi ảnh.">
        <ImageUploader value={s.images} onChange={(urls) => set("images", urls)} max={options.maxImages} error={imageError} disabled={pending} />
      </FormField>

      <div className="space-y-2">
        <p className="text-sm font-bold">Phân loại Kích cỡ (Size) &amp; Tồn kho{editing ? "" : " ban đầu"}</p>
        <VariantEditor
          groups={s.groups}
          onChange={(groups) => set("groups", groups)}
          errors={errors}
          editing={editing}
          disabled={pending}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <FormField label="Mô tả tóm tắt" htmlFor="pf-desc" required error={errors.description}>
          <Textarea id="pf-desc" value={s.description} maxLength={5000} rows={4} aria-invalid={errors.description ? true : undefined} onChange={(e) => set("description", e.target.value)} />
        </FormField>
        <FormField label="Tags tìm kiếm" htmlFor="pf-tags" error={errors.tags} hint="Phân tách bằng dấu phẩy, vd: #thethao, áo thun">
          <Textarea id="pf-tags" value={s.tags} rows={4} className="font-bold text-brand" aria-invalid={errors.tags ? true : undefined} onChange={(e) => set("tags", e.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Giới tính" htmlFor="pf-gender" required error={errors.gender}>
          <Select items={options.genders} value={s.gender} onValueChange={(v) => set("gender", v ?? "")}>
            <SelectTrigger id="pf-gender" aria-invalid={errors.gender ? true : undefined}>
              <SelectValue placeholder="Chọn giới tính" />
            </SelectTrigger>
            <SelectContent>
              {options.genders.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Phong cách" htmlFor="pf-style" required error={errors.style}>
          <Select items={options.styles} value={s.style || null} onValueChange={(v) => set("style", v ?? "")}>
            <SelectTrigger id="pf-style" aria-invalid={errors.style ? true : undefined}>
              <SelectValue placeholder="Chọn phong cách" />
            </SelectTrigger>
            <SelectContent>
              {options.styles.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Chất liệu" htmlFor="pf-material" required error={errors.material}>
          <Input id="pf-material" value={s.material} maxLength={120} placeholder="vd: Cotton 100%" aria-invalid={errors.material ? true : undefined} onChange={(e) => set("material", e.target.value)} />
        </FormField>
        <FormField label="Thương hiệu" htmlFor="pf-brand" required error={errors.brand}>
          <Input id="pf-brand" value={s.brand} maxLength={80} aria-invalid={errors.brand ? true : undefined} onChange={(e) => set("brand", e.target.value)} />
        </FormField>
      </div>

      <FormField label="Dịp mặc" htmlFor="pf-occasion" error={errors.occasion} hint="Chọn các dịp phù hợp (dùng cho bộ lọc và trợ lý AI).">
        <Chips options={options.occasions} value={s.occasion} onChange={(v) => set("occasion", v)} label="Dịp mặc" disabled={pending} />
      </FormField>
      <FormField label="Mùa" htmlFor="pf-season" error={errors.season}>
        <Chips options={options.seasons} value={s.season} onChange={(v) => set("season", v)} label="Mùa" disabled={pending} />
      </FormField>

      <label className="flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-4">
        <span className="flex items-center gap-3 text-label font-bold">
          <span aria-hidden className={cn("size-3 rounded-full", s.isActive ? "bg-success" : "bg-border-strong")} />
          Hiển thị ngay trên Trang Chủ &amp; Danh Mục Sản Phẩm
        </span>
        <Switch checked={s.isActive} onCheckedChange={(v) => set("isActive", v)} aria-label="Hiển thị trên cửa hàng" />
      </label>
    </form>
  )
}

/** Modal thêm (không `product`) hoặc sửa (có `initial` điền sẵn từ getAdminProduct). */
export function ProductFormModal({
  open,
  onClose,
  productId,
  initial,
  options,
}: {
  open: boolean
  onClose: () => void
  /** Có = sửa sản phẩm này. */
  productId?: string
  initial?: ProductFormState
  options: ProductFormOptions
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [issues, setIssues] = useState<FormIssue[]>([])
  const [failure, setFailure] = useState<string | null>(null)
  const editing = productId !== undefined

  function close() {
    setIssues([])
    setFailure(null)
    onClose()
  }

  function submit(state: ProductFormState) {
    startTransition(async () => {
      const res = await saveProductAction({ id: productId, data: buildPayload(state) })
      if (res.ok) {
        toast.success(res.message)
        close()
        router.refresh()
      } else {
        setIssues(res.issues ?? [])
        setFailure(res.message)
        toast.error(res.message)
      }
    })
  }

  return (
    <AdminModal
      open={open}
      onOpenChange={(next) => !next && !pending && close()}
      title={editing ? "Sửa Sản Phẩm" : "Thêm Sản Phẩm Mới"}
      description={
        editing ? "Cập nhật thông tin, ảnh, phân loại size/màu và tồn kho của sản phẩm." : "Khởi tạo sản phẩm, phân loại kích cỡ, màu sắc và cấu hình tồn kho ban đầu."
      }
      size="xl"
      footer={<ModalActions submitLabel="Lưu Sản Phẩm" pending={pending} formId={FORM_ID} onCancel={close} />}
    >
      <ProductForm
        initial={initial ?? emptyForm(options.defaultBrand)}
        editing={editing}
        options={options}
        issues={issues}
        failure={failure}
        pending={pending}
        onSubmit={submit}
      />
    </AdminModal>
  )
}

/** Nút "+ Thêm mới" ở thanh công cụ. */
export function AddProductButton({ options }: { options: ProductFormOptions }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="md" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden /> Thêm mới
      </Button>
      <ProductFormModal open={open} onClose={() => setOpen(false)} options={options} />
    </>
  )
}

/** Modal sửa mở theo URL (?edit=<id>): trang (server) nạp sản phẩm rồi truyền `initial`; đóng = bỏ `edit` khỏi URL. */
export function EditProductModal({ productId, initial, options }: { productId: string; initial: ProductFormState; options: ProductFormOptions }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(true)

  function close() {
    setOpen(false)
    const next = new URLSearchParams(params.toString())
    next.delete("edit")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return <ProductFormModal key={productId} open={open} onClose={close} productId={productId} initial={initial} options={options} />
}
