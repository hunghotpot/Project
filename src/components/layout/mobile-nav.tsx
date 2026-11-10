"use client"

import { useState } from "react"
import Link from "next/link"
import { MenuIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { NavCategory } from "@/types/catalog"

// Mobile/tablet: menu danh mục nằm trong Sheet (Figma chỉ có bản desktop).
export function MobileNav({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label="Mở menu danh mục"
            className="lg:hidden"
          />
        }
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Danh mục</SheetTitle>
          <SheetDescription className="sr-only">Điều hướng theo danh mục sản phẩm</SheetDescription>
        </SheetHeader>
        <nav aria-label="Danh mục sản phẩm" className="flex flex-col gap-1 px-6 pb-6">
          <Link
            href="/"
            onClick={close}
            className="rounded-xl px-3 py-3 text-nav font-bold uppercase hover:bg-secondary"
          >
            Trang chủ
          </Link>
          {categories.map((c) => (
            <div key={c.id} className="flex flex-col">
              <Link
                href={`/categories/${c.slug}`}
                onClick={close}
                className="rounded-xl px-3 py-3 text-nav font-bold uppercase hover:bg-secondary"
              >
                {c.name}
              </Link>
              {c.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categories/${child.slug}`}
                  onClick={close}
                  className="rounded-xl py-2.5 pr-3 pl-8 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

