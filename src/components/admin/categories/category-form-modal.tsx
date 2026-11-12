"use client"

import { useState } from "react"
import { createCategoryAction, updateCategoryAction } from "@/app/actions/admin-categories"
import { AdminModal, ModalActions } from "@/components/admin/modal/admin-modal"
import { FormField } from "@/components/admin/modal/form-field"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export interface CategoryNode {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  productCount: number
  sizeChartRowCount: number
  children: CategoryNode[]
}

export type CategoryFormState = { mode: "create"; parentId: string | null } | { mode: "edit"; category: CategoryNode }

const NO_PARENT = "__root"
const FORM_ID = "category-form"

// Chỉ để xem trước; slug thật do server sinh (thêm hậu tố nếu trùng).
function previewSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function CategoryFormModal({
  state,
  roots,
  onClose,
}: {
  state: CategoryFormState
  roots: CategoryNode[]
  onClose: () => void
}) {
  const editing = state.mode === "edit" ? state.category : null
  const [name, setName] = useState(editing?.name ?? "")
  const [description, setDescription] = useState(editing?.description ?? "")
  const [parentId, setParentId] = useState<string>((editing ? editing.parentId : state.mode === "create" ? state.parentId : null) ?? NO_PARENT)
  const { pending, run } = useAdminAction()

  // Danh mục đang có con không thể trở thành con của danh mục khác (tối đa 2 cấp).
  const lockParent = !!editing && editing.children.length > 0
  const parentOptions = roots.filter((r) => r.id !== editing?.id)
  const parentLabel = (id: string) => (id === NO_PARENT ? "Không có (danh mục gốc)" : (roots.find((r) => r.id === id)?.name ?? ""))
  const slug = editing ? editing.slug : previewSlug(name)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const parent = parentId === NO_PARENT ? null : parentId
    if (editing) {
      run(() => updateCategoryAction(editing.id, { name, description: description.trim() || null, parentId: parent }), { onSuccess: onClose })
    } else {
      run(() => createCategoryAction({ name, description, parentId: parent }), { onSuccess: onClose })
    }
  }

  return (
    <AdminModal
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      size="md"
      title={editing ? "Sửa danh mục" : state.mode === "create" && state.parentId ? "Thêm danh mục con" : "Thêm danh mục"}
      description="Danh mục chỉ có tối đa 2 cấp: danh mục gốc và danh mục con."
      footer={<ModalActions submitLabel={editing ? "Lưu thay đổi" : "Thêm danh mục"} pending={pending} formId={FORM_ID} onCancel={onClose} />}
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-5">
        <FormField label="Tên danh mục" htmlFor="category-name" required>
          <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Áo polo" maxLength={80} required autoFocus />
        </FormField>

        <FormField
          label="Slug (đường dẫn)"
          htmlFor="category-slug"
          hint={
            editing
              ? "Đổi tên không đổi slug, để các đường dẫn đã có không bị hỏng."
              : "Tự sinh từ tên; nếu trùng, hệ thống thêm số phía sau (-2, -3…) khi lưu."
          }
        >
          <Input id="category-slug" value={slug} readOnly placeholder="tự sinh từ tên" />
        </FormField>

        <FormField
          label="Danh mục cha"
          htmlFor="category-parent"
          hint={lockParent ? "Danh mục đang có danh mục con nên không thể chuyển làm con của danh mục khác." : undefined}
        >
          <Select value={parentId} onValueChange={(v) => v && setParentId(v)} disabled={lockParent}>
            <SelectTrigger id="category-parent">
              <SelectValue>{(v: string) => parentLabel(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>Không có (danh mục gốc)</SelectItem>
              {parentOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Mô tả ngắn" htmlFor="category-description" hint="Không bắt buộc, tối đa 500 ký tự.">
          <Textarea id="category-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
        </FormField>
      </form>
    </AdminModal>
  )
}
