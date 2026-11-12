"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { deleteSizeChartRowsAction } from "@/app/actions/admin-size-charts"
import { AdminEmpty, AdminTable, AdminTr, ListCard, ListSection } from "@/components/admin/list/admin-table"
import { ConfirmDialog } from "@/components/admin/modal/confirm-dialog"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"
import { SizeChartEditor, type EditorTarget, type SizeChartRow } from "./size-chart-editor"

const COLUMNS = [
  { label: "Size" },
  { label: "Ngực (cm)" },
  { label: "Eo (cm)" },
  { label: "Mông (cm)" },
  { label: "Chiều cao (cm)" },
  { label: "Cân nặng (kg)" },
]

export function SizeChartSection({ categoryId, categoryName, rows }: { categoryId: string; categoryName: string; rows: SizeChartRow[] }) {
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [toDelete, setToDelete] = useState<{ brand: string | null; rows: SizeChartRow[] } | null>(null)
  const { pending, run } = useAdminAction()

  // Bảng chung (brand = null) đứng đầu, rồi từng thương hiệu (service đã sắp sẵn).
  const groups = new Map<string | null, SizeChartRow[]>()
  for (const r of rows) groups.set(r.brand, [...(groups.get(r.brand) ?? []), r])

  return (
    <ListSection title={`Bảng size: ${categoryName}`}>
      <p className="text-label text-muted-foreground">Số đo là số đo cơ thể người mặc (cm/kg). Bảng riêng của thương hiệu được ưu tiên hơn bảng chung khi tư vấn size.</p>
      <div className="flex justify-end">
        <Button type="button" size="md" onClick={() => setEditor({ brand: null, rows: [], fixedBrand: false })}>
          <PlusIcon aria-hidden /> Thêm bảng
        </Button>
      </div>

      {groups.size === 0 ? (
        <ListCard>
          <AdminEmpty title="Danh mục này chưa có bảng size." hint="Bấm “Thêm bảng” để tạo bảng chung hoặc bảng theo thương hiệu." />
        </ListCard>
      ) : (
        [...groups].map(([brand, list]) => (
          <ListCard key={brand ?? "__common"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-bold">{brand ? `Thương hiệu: ${brand}` : "Bảng chung"}</h3>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setEditor({ brand, rows: list, fixedBrand: true })}>
                  Sửa bảng
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => setToDelete({ brand, rows: list })}>
                  Xóa bảng
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <AdminTable columns={COLUMNS} minWidth={640} caption={brand ? `Bảng size ${brand}` : "Bảng size chung"}>
                {list.map((r) => (
                  <AdminTr key={r.id}>
                    <td className="font-bold">{r.size}</td>
                    <td>{r.chest ?? "—"}</td>
                    <td>{r.waist}</td>
                    <td>{r.hip}</td>
                    <td>
                      {r.heightMin}–{r.heightMax}
                    </td>
                    <td>
                      {r.weightMin}–{r.weightMax}
                    </td>
                  </AdminTr>
                ))}
              </AdminTable>
            </div>
          </ListCard>
        ))
      )}

      {editor && (
        <SizeChartEditor
          key={`${editor.brand ?? "__common"}-${editor.fixedBrand}`}
          categoryId={categoryId}
          categoryName={categoryName}
          target={editor}
          onClose={() => setEditor(null)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && !pending && setToDelete(null)}
        title="Xóa bảng size?"
        description={`Xóa toàn bộ ${toDelete?.rows.length ?? 0} dòng của ${toDelete?.brand ? `bảng thương hiệu “${toDelete.brand}”` : "bảng chung"} trong “${categoryName}”. Việc tư vấn size cho danh mục này sẽ dùng bảng còn lại (nếu có). Không thể hoàn tác.`}
        confirmLabel="Xóa bảng"
        pending={pending}
        onConfirm={() =>
          toDelete &&
          run(() => deleteSizeChartRowsAction({ categoryId, rowIds: toDelete.rows.map((r) => r.id) }), { onSuccess: () => setToDelete(null) })
        }
      />
    </ListSection>
  )
}
