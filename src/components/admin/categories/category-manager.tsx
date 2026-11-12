"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { deleteCategoryAction } from "@/app/actions/admin-categories"
import { AdminEmpty, AdminTable, AdminTr, ListCard, ListSection } from "@/components/admin/list/admin-table"
import { ConfirmDialog } from "@/components/admin/modal/confirm-dialog"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"
import { CategoryFormModal, type CategoryFormState, type CategoryNode } from "./category-form-modal"

const COLUMNS = [
  { label: "Tên danh mục" },
  { label: "Slug" },
  { label: "Mô tả" },
  { label: "Sản phẩm", className: "text-right" },
  { label: "Thao tác", className: "text-right" },
]

function Row({
  node,
  child,
  onEdit,
  onAddChild,
  onDelete,
}: {
  node: CategoryNode
  child?: boolean
  onEdit: () => void
  onAddChild?: () => void
  onDelete: () => void
}) {
  return (
    <AdminTr>
      <td className={child ? "pl-10" : "font-bold"}>
        {child && <span className="mr-2 text-subtle-foreground" aria-hidden>└</span>}
        <span className={child ? "font-medium" : undefined}>{node.name}</span>
      </td>
      <td className="text-muted-foreground">{node.slug}</td>
      <td className="max-w-64 truncate text-muted-foreground" title={node.description ?? undefined}>
        {node.description || "—"}
      </td>
      <td className="text-right font-bold">{node.productCount}</td>
      <td>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
            Sửa
          </Button>
          {onAddChild && (
            <Button type="button" size="sm" variant="secondary" onClick={onAddChild}>
              Thêm con
            </Button>
          )}
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
            Xóa
          </Button>
        </div>
      </td>
    </AdminTr>
  )
}

export function CategoryManager({ tree }: { tree: CategoryNode[] }) {
  const [form, setForm] = useState<CategoryFormState | null>(null)
  const [toDelete, setToDelete] = useState<CategoryNode | null>(null)
  const { pending, run } = useAdminAction()

  return (
    <ListSection title="Danh Sách Danh Mục">
      <div className="flex justify-end">
        <Button type="button" size="md" onClick={() => setForm({ mode: "create", parentId: null })}>
          <PlusIcon aria-hidden /> Thêm danh mục
        </Button>
      </div>

      <ListCard>
        {tree.length === 0 ? (
          <AdminEmpty title="Chưa có danh mục nào." hint="Bấm “Thêm danh mục” để tạo danh mục gốc đầu tiên." />
        ) : (
          <AdminTable columns={COLUMNS} minWidth={760} caption="Cây danh mục">
            {tree.flatMap((root) => [
              <Row
                key={root.id}
                node={root}
                onEdit={() => setForm({ mode: "edit", category: root })}
                onAddChild={() => setForm({ mode: "create", parentId: root.id })}
                onDelete={() => setToDelete(root)}
              />,
              ...root.children.map((c) => (
                <Row key={c.id} node={c} child onEdit={() => setForm({ mode: "edit", category: c })} onDelete={() => setToDelete(c)} />
              )),
            ])}
          </AdminTable>
        )}
      </ListCard>

      {form && (
        <CategoryFormModal
          key={form.mode === "edit" ? form.category.id : `new-${form.parentId ?? "root"}`}
          state={form}
          roots={tree}
          onClose={() => setForm(null)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && !pending && setToDelete(null)}
        title="Xóa danh mục?"
        description={`Xóa “${toDelete?.name ?? ""}” sẽ xóa luôn bảng size của danh mục này và không thể hoàn tác. Chỉ xóa được khi danh mục không còn danh mục con và không còn sản phẩm.`}
        confirmLabel="Xóa danh mục"
        pending={pending}
        onConfirm={() => toDelete && run(() => deleteCategoryAction(toDelete.id), { onSuccess: () => setToDelete(null) })}
      />
    </ListSection>
  )
}
