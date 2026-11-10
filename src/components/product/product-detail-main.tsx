"use client"

import { useMemo, useState } from "react"
import { MinusIcon, PlusIcon } from "lucide-react"
import { cn } from "cn"
import { ProductGallery } from "@/components/product/product-gallery"
import { SizeGuideDialog } from "@/components/product/size-guide-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatVnd, GENDER_LABEL, STYLE_LABEL } from "@/lib/format"
import {
  findVariant,
  imagesForColor,
  initialSelection,
  listColors,
  listSizes,
  optionState,
  priceRange,
  select,
  type Axis,
  type OptionState,
  type Selection,
} from "@/lib/product-variants"
import type { ProductDetail } from "@/types/catalog"

export interface CartItemInput {
  variantId: string
  quantity: number
}

const LOW_STOCK = 5

// Phần tương tác của trang chi tiết (bám Figma): gallery | tên, giá, màu, size, số lượng, nút mua, mô tả, tags.
// Thuần giao diện: giỏ hàng được nối ở ProductDetailConnected qua onAddToCart / onBuyNow.
export function ProductDetailMain({
  product,
  careTips,
  onAddToCart,
  onBuyNow,
}: {
  product: ProductDetail
  careTips: string[]
  onAddToCart?: (item: CartItemInput) => void
  onBuyNow?: (item: CartItemInput) => void
}) {
  const { variants } = product
  const [sel, setSel] = useState<Selection>(() => initialSelection(variants))
  const [qty, setQty] = useState(1)

  const colors = useMemo(() => listColors(variants), [variants])
  const sizes = useMemo(() => listSizes(variants), [variants])
  const variant = findVariant(variants, sel)
  const range = priceRange(variants, sel)
  const images = imagesForColor(product.images, sel.color)

  // Tồn kho: biến thể đang chọn, hoặc tổng của các biến thể khớp lựa chọn dở dang.
  const stock = variant
    ? variant.stock
    : variants
        .filter((v) => (!sel.color || v.color === sel.color) && (!sel.size || v.size === sel.size))
        .reduce((sum, v) => sum + v.stock, 0)
  const soldOutAll = variants.every((v) => v.stock <= 0)
  const canBuy = !!variant && variant.stock > 0
  const quantity = variant ? Math.min(qty, Math.max(variant.stock, 1)) : qty

  // Bấm lại giá trị đang chọn = bỏ chọn (để đổi sang màu/size không có tổ hợp với lựa chọn kia).
  function pick(axis: Axis, value: string) {
    setSel((cur) => {
      if (cur[axis] === value) {
        const rest = { ...cur }
        delete rest[axis]
        return rest
      }
      return select(variants, cur, axis, value)
    })
  }

  const subtitle = [product.category.name, GENDER_LABEL[product.gender], STYLE_LABEL[product.style] ?? product.style]
  const item = variant ? { variantId: variant.id, quantity } : null

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
      <ProductGallery key={sel.color ?? "all"} images={images} name={product.name} />

      <div className="flex flex-col gap-6">
        <div className="space-y-3 border-b border-border pb-6">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-label text-muted-foreground">{subtitle.join(" • ")}</p>
          <p className="pt-1 text-3xl font-bold text-primary" aria-live="polite">
            {range.min === range.max ? formatVnd(range.min) : `${formatVnd(range.min)} – ${formatVnd(range.max)}`}
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-label font-bold">
            Màu sắc: <span className="font-normal text-muted-foreground">{sel.color ?? "Chưa chọn"}</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => {
              const state = optionState(variants, sel, "color", c.name)
              const active = sel.color === c.name
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${c.name}${stateLabel(state)}`}
                  disabled={state !== "available" && !active}
                  title={c.name}
                  onClick={() => pick("color", c.name)}
                  className={cn(
                    "relative grid size-10 place-items-center rounded-full border outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    active ? "border-2 border-ink" : "border-transparent",
                    state !== "available" && !active && "cursor-not-allowed opacity-40",
                    state === "soldout" && !active && STRIKE
                  )}
                >
                  <span className="size-7 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-label font-bold">Kích cỡ (Size)</legend>
            <SizeGuideDialog rows={product.sizeChart} categoryName={product.category.name} />
          </div>
          <div className="flex flex-wrap gap-3">
            {sizes.map((s) => {
              const state = optionState(variants, sel, "size", s)
              const active = sel.size === s
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${s}${stateLabel(state)}`}
                  disabled={state !== "available" && !active}
                  onClick={() => pick("size", s)}
                  className={cn(
                    "relative inline-flex h-11 min-w-[72px] items-center justify-center overflow-hidden rounded-xl px-4 text-label font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    active ? "bg-ink text-white" : "bg-secondary text-foreground hover:bg-border",
                    state !== "available" && !active && "cursor-not-allowed text-muted-foreground opacity-40 hover:bg-secondary",
                    state === "soldout" && !active && cn("line-through", STRIKE)
                  )}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-[52px] items-center rounded-xl bg-secondary">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={quantity <= 1}
                onClick={() => setQty(quantity - 1)}
                className="grid h-full w-11 place-items-center disabled:opacity-40"
              >
                <MinusIcon className="size-3.5" />
              </button>
              <span className="w-10 text-center text-sm font-bold" aria-live="polite" aria-label="Số lượng">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={!variant || quantity >= variant.stock}
                onClick={() => setQty(quantity + 1)}
                className="grid h-full w-11 place-items-center disabled:opacity-40"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>
            <Button
              variant="dark"
              size="lg"
              className="min-w-0 flex-1 basis-48"
              disabled={!canBuy}
              onClick={() => item && onAddToCart?.(item)}
            >
              Thêm vào giỏ hàng
            </Button>
            <Button
              size="lg"
              className="min-w-0 flex-1 basis-36"
              disabled={!canBuy}
              onClick={() => item && onBuyNow?.(item)}
            >
              Mua ngay
            </Button>
          </div>
          <p className="text-label" aria-live="polite">
            {soldOutAll ? (
              <Badge shape="tag" variant="dark">
                HẾT HÀNG
              </Badge>
            ) : !variant ? (
              <span className="text-muted-foreground">
                {sel.color || sel.size ? `Còn ${stock} sản phẩm · ` : ""}Vui lòng chọn đủ màu và size
              </span>
            ) : variant.stock <= 0 ? (
              <span className="font-bold text-destructive">Hết hàng</span>
            ) : variant.stock <= LOW_STOCK ? (
              <span className="font-bold text-warning">Chỉ còn {variant.stock} sản phẩm</span>
            ) : (
              <span className="text-success">Còn {variant.stock} sản phẩm</span>
            )}
            {variant && <span className="ml-3 text-xs text-subtle-foreground">SKU: {variant.sku}</span>}
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-label font-bold">Mô tả sản phẩm</h2>
          <p className="text-label leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</p>
          <dl className="space-y-1.5 pt-1 text-label">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">Chất liệu</dt>
              <dd className="font-bold">{product.material}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 text-muted-foreground">Thương hiệu</dt>
              <dd className="font-bold">{product.brand}</dd>
            </div>
          </dl>
          <details className="group pt-1">
            <summary className="cursor-pointer text-label font-bold">Thông tin chăm sóc</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-label text-muted-foreground">
              {careTips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        </section>

        {product.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-label font-bold">Tags:</span>
            {product.tags.map((t) => (
              <span key={t} className="inline-flex h-8 items-center rounded-full bg-secondary px-4 text-xs font-bold text-sidebar-foreground">
                #{t.replace(/\s+/g, "")}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Đường gạch chéo cho option hết hàng.
const STRIKE =
  "after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),var(--color-muted-foreground)_calc(50%-1px),var(--color-muted-foreground)_calc(50%+1px),transparent_calc(50%+1px))]"

function stateLabel(state: OptionState) {
  return state === "soldout" ? " (hết hàng)" : state === "unavailable" ? " (không có)" : ""
}

