import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatVnd, GENDER_LABEL } from "@/lib/format"
import type { ProductCardData } from "@/types/catalog"

const MAX_DOTS = 5
const IMAGE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"

// Figma: ảnh nền secondary bo 8px, tên 15px bold, mô tả 13px, giá 16px bold.
// Tag "NEW" nằm góc trên trái và giá chuyển sang màu brand.
export function ProductCard({
  product,
  isNew = false,
}: {
  product: ProductCardData
  isNew?: boolean
}) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <div className="relative aspect-6/5 overflow-hidden rounded-lg bg-secondary">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={product.image.alt}
            fill
            sizes={IMAGE_SIZES}
            className={`object-cover transition-all duration-300 ${
              product.hoverImage ? "group-hover:opacity-0" : "group-hover:scale-105"
            }`}
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm text-subtle-foreground">
            [Hình ảnh sản phẩm]
          </span>
        )}
        {product.hoverImage && (
          <Image
            src={product.hoverImage.url}
            alt={product.hoverImage.alt}
            fill
            sizes={IMAGE_SIZES}
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {!product.inStock ? (
          <Badge shape="tag" variant="dark" className="absolute top-3 left-3">
            HẾT HÀNG
          </Badge>
        ) : (
          isNew && (
            <Badge shape="tag" variant="solid" className="absolute top-3 left-3">
              NEW
            </Badge>
          )
        )}
      </div>

      <div className="space-y-1">
        <h3 className="line-clamp-1 text-nav leading-snug font-bold">{product.name}</h3>
        <p className="line-clamp-1 text-label text-subtle-foreground">
          {product.categoryName} • {GENDER_LABEL[product.gender]}
        </p>
        {product.colors.length > 0 && (
          <ul aria-label="Màu sắc" className="flex items-center gap-1.5 pt-0.5">
            {product.colors.slice(0, MAX_DOTS).map((c) => (
              <li
                key={c.name}
                title={c.name}
                className="size-3.5 rounded-full border border-border-strong"
                style={{ backgroundColor: c.hex }}
              >
                <span className="sr-only">{c.name}</span>
              </li>
            ))}
            {product.colors.length > MAX_DOTS && (
              <li className="text-xs text-subtle-foreground">+{product.colors.length - MAX_DOTS}</li>
            )}
          </ul>
        )}
        <p className={`text-base font-bold ${isNew ? "text-primary" : "text-foreground"}`}>
          {formatVnd(product.price)}
        </p>
      </div>
    </Link>
  )
}

