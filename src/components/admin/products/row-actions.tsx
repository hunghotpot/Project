"use client"

import { useState } from "react"
import Link from "next/link"
import { EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react"
import { deleteProductAction, setProductActiveAction } from "@/app/actions/admin-products"
import { ConfirmDialog } from "@/components/admin/modal/confirm-dialog"
import { useAdminAction } from "@/components/admin/use-admin-action"
import { Button } from "@/components/ui/button"
import { StockModal, type StockVariant } from "./stock-modal"

/** Cột "Thao tác": Sửa (mở modal qua ?edit=), Nhập (modal nhập kho), ẩn/hiện và xoá (có xác nhận). */
export function ProductRowActions({
  productId,
  name,
  isActive,
  editHref,
  variants,
}: {
  productId: string
  name: string
  isActive: boolean
  editHref: string
  variants: StockVariant[]
}) {
  const [stockOpen, setStockOpen] = useState(false)
  const [confirm, setConfirm] = useState<"hide" | "delete" | null>(null)
  const { pending, run } = useAdminAction()

  const toggle = (next: boolean) => run(() => setProductActiveAction(productId, next), { onSuccess: () => setConfirm(null) })

  return (
    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
      <Link href={editHref} scroll={false} aria-label={`Sửa ${name}`} className="text-label font-bold hover:underline">
        Sửa
      </Link>
      <button
        type="button"
        aria-label={`Nhập kho ${name}`}
        disabled={variants.length === 0}
        onClick={() => setStockOpen(true)}
        className="text-label font-bold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        Nhập
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={isActive ? `Ẩn ${name} khỏi cửa hàng` : `Hiện ${name} trên cửa hàng`}
        title={isActive ? "Ẩn khỏi cửa hàng" : "Hiện trên cửa hàng"}
        onClick={() => (isActive ? setConfirm("hide") : toggle(true))}
      >
        {isActive ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" disabled={pending} aria-label={`Xoá ${name}`} title="Xoá sản phẩm" onClick={() => setConfirm("delete")}>
        <Trash2Icon className="text-destructive" aria-hidden />
      </Button>

      <StockModal open={stockOpen} onClose={() => setStockOpen(false)} productName={name} variants={variants} />

      <ConfirmDialog
        open={confirm === "hide"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Ẩn sản phẩm?"
        description={`"${name}" sẽ không còn hiển thị trên cửa hàng và trong tìm kiếm của khách. Đơn hàng cũ vẫn giữ nguyên, bạn có thể hiện lại bất cứ lúc nào.`}
        confirmLabel="Ẩn sản phẩm"
        pending={pending}
        onConfirm={() => toggle(false)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Xoá sản phẩm?"
        description={`Xoá vĩnh viễn "${name}" cùng ảnh, size/màu và tồn kho; không thể hoàn tác. Sản phẩm đã có trong đơn hàng sẽ không xoá được, khi đó hãy chọn ẩn sản phẩm.`}
        confirmLabel="Xoá sản phẩm"
        pending={pending}
        onConfirm={() => run(() => deleteProductAction(productId), { onSuccess: () => setConfirm(null) })}
      />
    </div>
  )
}
