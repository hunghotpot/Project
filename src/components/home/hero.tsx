import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

// Figma: panel ink bo 12px (~192px cao), tiêu đề 32px bold trắng, mô tả 16px, nút "MUA NGAY" pill brand.
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="flex min-h-48 flex-col items-start justify-center gap-4 rounded-xl bg-ink px-6 py-8 text-white md:px-15"
    >
      <h1 id="hero-heading" className="text-2xl font-bold uppercase md:text-4xl">
        Bộ sưu tập Thu Đông 2026
      </h1>
      <p className="text-sm text-subtle-foreground md:text-base">
        Khám phá phong cách thể thao hiện đại và năng động.
      </p>
      <Link href="/products" className={`${buttonVariants()} mt-2 uppercase`}>
        Mua ngay
      </Link>
    </section>
  )
}
