"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { SearchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

/* ───────────── layout helpers ───────────── */

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string
  title: string
  note?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-border pt-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      {note && <p className="mt-1 mb-6 max-w-3xl text-xs text-muted-foreground">{note}</p>}
      {!note && <div className="mb-6" />}
      {children}
    </section>
  )
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-8 mb-3 text-xs font-bold tracking-wide text-muted-foreground uppercase first:mt-0">
      {children}
    </h3>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="font-mono text-2xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

/* ───────────── colour swatch (hex read live from CSS) ───────────── */

function Swatch({ name, cls }: { name: string; cls: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hex, setHex] = useState("")
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const c = getComputedStyle(el).backgroundColor
    const m = c.match(/[\d.]+/g)?.map(Number)
    if (!m) return
    const h = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase()
    setHex(
      m.length >= 4 && m[3] < 1
        ? `${c}`
        : `#${h(m[0])}${h(m[1])}${h(m[2])}`
    )
  }, [])
  return (
    <div className="flex flex-col gap-2">
      <div ref={ref} className={`h-16 rounded-xl border border-border ${cls}`} />
      <div>
        <div className="text-xs font-bold">{name}</div>
        <div className="font-mono text-2xs text-muted-foreground">{hex || "…"}</div>
      </div>
    </div>
  )
}

const colorGroups: { title: string; items: [string, string][] }[] = [
  {
    title: "Brand",
    items: [
      ["primary / brand", "bg-primary"],
      ["brand-soft", "bg-brand-soft"],
      ["ink / foreground", "bg-ink"],
      ["ring", "bg-ring"],
      ["destructive", "bg-destructive"],
    ],
  },
  {
    title: "Neutral surfaces",
    items: [
      ["background (page)", "bg-background"],
      ["card / popover", "bg-card"],
      ["surface (input, card in container)", "bg-surface"],
      ["muted / secondary / accent", "bg-muted"],
    ],
  },
  {
    title: "Neutral lines & text",
    items: [
      ["border / input", "bg-border"],
      ["border-strong", "bg-border-strong"],
      ["muted-foreground", "bg-muted-foreground"],
      ["subtle-foreground (placeholder)", "bg-subtle-foreground"],
      ["sidebar-foreground", "bg-sidebar-foreground"],
    ],
  },
  {
    title: "Status",
    items: [
      ["success", "bg-success"],
      ["success-soft", "bg-success-soft"],
      ["warning", "bg-warning"],
      ["warning-soft", "bg-warning-soft"],
      ["info", "bg-info"],
      ["info-soft", "bg-info-soft"],
    ],
  },
  {
    title: "Chart",
    items: [
      ["chart-1", "bg-chart-1"],
      ["chart-2", "bg-chart-2"],
      ["chart-3", "bg-chart-3"],
      ["chart-4", "bg-chart-4"],
      ["chart-5", "bg-chart-5"],
    ],
  },
]

const typeScale: [string, string, string][] = [
  ["text-4xl", "32px", "text-4xl"],
  ["text-3xl", "28px", "text-3xl"],
  ["text-2xl", "24px", "text-2xl"],
  ["text-xl", "20px", "text-xl"],
  ["text-lg", "18px", "text-lg"],
  ["text-base", "16px", "text-base"],
  ["text-nav", "15px", "text-nav"],
  ["text-sm", "14px", "text-sm"],
  ["text-label", "13px", "text-label"],
  ["text-xs", "12px", "text-xs"],
  ["text-caption", "11px", "text-caption"],
  ["text-2xs", "10px", "text-2xs"],
]

const radii: [string, string, string][] = [
  ["rounded-sm", "4px", "rounded-sm"],
  ["rounded-md", "6px", "rounded-md"],
  ["rounded-lg", "8px", "rounded-lg"],
  ["rounded-xl", "12px", "rounded-xl"],
  ["rounded-2xl", "16px", "rounded-2xl"],
  ["rounded-3xl", "24px", "rounded-3xl"],
  ["rounded-4xl", "32px", "rounded-4xl"],
  ["rounded-full", "pill", "rounded-full"],
]

const categoryItems = [
  { value: "shoes", label: "Giày Thể Thao" },
  { value: "tee", label: "Áo Phông & Polo" },
  { value: "pants", label: "Quần Tập" },
  { value: "acc", label: "Phụ Kiện" },
]

const spacing = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20]

/* ───────────── page ───────────── */

export function DesignSystemView() {
  const [radio, setRadio] = useState("cod")

  return (
    <main className="mx-auto max-w-page space-y-12 px-6 py-12">
      <header className="space-y-2">
        <Badge variant="brand">DEV ONLY</Badge>
        <h1 className="text-4xl font-bold">Design System</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Reference page to compare against Figma &ldquo;Modern&rdquo; (Customer + Admin). Not
          rendered in production builds. All values come from CSS variables in{" "}
          <code className="font-mono text-xs">globals.css</code>.
        </p>
        <nav className="flex flex-wrap gap-4 pt-2 text-xs font-bold">
          {["colors", "typography", "radius", "shadow", "spacing", "buttons", "forms", "badges", "tabs", "table", "overlays", "feedback"].map((s) => (
            <a key={s} href={`#${s}`} className="text-primary hover:underline">
              #{s}
            </a>
          ))}
        </nav>
      </header>

      {/* ───── Colors ───── */}
      <Section
        id="colors"
        title="Colors"
        note="Figma defines no variables. Login, Checkout and Admin frames use the slate palette + #E61E4D; the Home frame uses a gray palette + #E11D48 — unified onto slate/#E61E4D (see conflict list)."
      >
        {colorGroups.map((g) => (
          <div key={g.title} className="mb-8">
            <Sub>{g.title}</Sub>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {g.items.map(([n, c]) => (
                <Swatch key={n} name={n} cls={c} />
              ))}
            </div>
          </div>
        ))}
        <Sub>Overlay</Sub>
        <div className="relative h-16 w-48 overflow-hidden rounded-xl border border-border bg-[repeating-linear-gradient(45deg,#fff,#fff_8px,#e2e8f0_8px,#e2e8f0_16px)]">
          <div className="absolute inset-0 bg-overlay" />
          <span className="absolute inset-0 grid place-items-center font-mono text-2xs text-white">
            overlay slate-900 / 55%
          </span>
        </div>
      </Section>

      {/* ───── Typography ───── */}
      <Section
        id="typography"
        title="Typography"
        note="Font: Inter via next/font (latin, latin-ext, vietnamese). Figma only uses Regular 400 and Bold 700."
      >
        <div className="mb-8 flex flex-wrap gap-10">
          <div>
            <div className="text-4xl font-bold">Aa Ắằẳẵặ</div>
            <div className="font-mono text-2xs text-muted-foreground">Inter Bold 700</div>
          </div>
          <div>
            <div className="text-4xl">Aa Ắằẳẵặ</div>
            <div className="font-mono text-2xs text-muted-foreground">Inter Regular 400</div>
          </div>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {typeScale.map(([name, px, cls]) => (
            <div key={name} className="flex items-baseline gap-4 px-5 py-3">
              <div className="w-28 shrink-0 font-mono text-2xs text-muted-foreground">
                {name} · {px}
              </div>
              <div className={`${cls} truncate font-bold`}>BỘ SƯU TẬP THU ĐÔNG 2026 — Giày Chạy Bộ Ultraboost 22</div>
            </div>
          ))}
          <div className="flex items-baseline gap-4 px-5 py-3">
            <div className="w-28 shrink-0 font-mono text-2xs text-muted-foreground">body regular</div>
            <div className="text-sm">Khám phá phong cách thể thao hiện đại và năng động.</div>
          </div>
          <div className="flex items-baseline gap-4 px-5 py-3">
            <div className="w-28 shrink-0 font-mono text-2xs text-muted-foreground">price (VND)</div>
            <div className="flex items-baseline gap-3">
              <span className="text-base font-bold text-primary">
                {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(2800000)}
              </span>
              <span className="text-label text-subtle-foreground line-through">
                {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(3500000)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ───── Radius ───── */}
      <Section id="radius" title="Radius" note="Figma shape radii ÷ 1.4917 (canvas is 2148px wide ≈ 1440 × 1.4917), snapped to the nearest clean value.">
        <div className="flex flex-wrap gap-6">
          {radii.map(([n, v, c]) => (
            <Cell key={n} label={`${n} · ${v}`}>
              <div className={`size-20 border border-border-strong bg-surface ${c}`} />
            </Cell>
          ))}
        </div>
      </Section>

      {/* ───── Shadow ───── */}
      <Section id="shadow" title="Shadow" note="Figma is flat (1px borders only). These two shadows are not from Figma — added for floating layers.">
        <div className="flex flex-wrap gap-8 rounded-2xl bg-background p-8">
          <Cell label="border only (cards)">
            <div className="h-20 w-40 rounded-xl border border-border bg-surface" />
          </Cell>
          <Cell label="shadow-float (popover, select, toast)">
            <div className="h-20 w-40 rounded-xl bg-card shadow-float" />
          </Cell>
          <Cell label="shadow-modal (dialog, sheet)">
            <div className="h-20 w-40 rounded-xl bg-card shadow-modal" />
          </Cell>
        </div>
      </Section>

      {/* ───── Spacing ───── */}
      <Section id="spacing" title="Spacing & layout" note="Tailwind 4px scale. Page container: max-w-page = 1280px (80px side margin at 1440 width).">
        <div className="space-y-2">
          {spacing.map((n) => (
            <div key={n} className="flex items-center gap-4">
              <span className="w-24 font-mono text-2xs text-muted-foreground">
                {n} · {n * 4}px
              </span>
              <div className="h-4 rounded-sm bg-primary" style={{ width: n * 4 }} />
            </div>
          ))}
        </div>
      </Section>

      {/* ───── Buttons ───── */}
      <Section id="buttons" title="Button" note="Variant × size, plus states. Sizes: xs 24 · sm 32 · default 40 · md 44 · lg 52 · xl 60.">
        <Sub>Variants</Sub>
        <div className="flex flex-wrap items-center gap-4">
          {(["default", "dark", "outline", "secondary", "ghost", "destructive", "link"] as const).map((v) => (
            <Cell key={v} label={v}>
              <Button variant={v}>{v === "destructive" ? "Đăng xuất" : "MUA NGAY"}</Button>
            </Cell>
          ))}
        </div>
        <Sub>Sizes</Sub>
        <div className="flex flex-wrap items-end gap-4">
          {(["xs", "sm", "default", "md", "lg", "xl"] as const).map((s) => (
            <Cell key={s} label={s}>
              <Button size={s}>Đặt hàng</Button>
            </Cell>
          ))}
          <Cell label="icon-sm">
            <Button size="icon-sm" variant="secondary" aria-label="search"><SearchIcon /></Button>
          </Cell>
          <Cell label="icon">
            <Button size="icon" variant="secondary" aria-label="search"><SearchIcon /></Button>
          </Cell>
          <Cell label="icon-lg">
            <Button size="icon-lg" variant="secondary" aria-label="search"><SearchIcon /></Button>
          </Cell>
        </div>
        <Sub>Shape rounded (Áp dụng · Xem Store · Đăng xuất)</Sub>
        <div className="flex flex-wrap items-end gap-4">
          <Button shape="rounded" variant="dark" size="md">Áp dụng</Button>
          <Button shape="rounded" variant="secondary" size="md">Xem Store ↗</Button>
          <Button shape="rounded" variant="destructive" size="md">Đăng xuất</Button>
        </div>
        <Sub>States (default · hover/focus via interaction · disabled · invalid)</Sub>
        <div className="flex flex-wrap items-center gap-4">
          {(["default", "dark", "secondary", "outline"] as const).map((v) => (
            <Button key={v} variant={v} disabled>
              Disabled
            </Button>
          ))}
          <Button aria-invalid>Invalid</Button>
        </div>
      </Section>

      {/* ───── Forms ───── */}
      <Section id="forms" title="Input · Select · Textarea · Checkbox · Radio · Switch">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <Sub>Input sizes (sm 40 · default 48 · lg 56)</Sub>
            <Input size="sm" placeholder="vidu@email.com" />
            <Input placeholder="vidu@email.com" />
            <Input size="lg" placeholder="vidu@email.com" />
            <Sub>Input states</Sub>
            <Input placeholder="Placeholder" />
            <Input defaultValue="Nguyễn Văn A" />
            <Input variant="white" defaultValue="SPORT2026" />
            <Input disabled placeholder="Disabled" />
            <Input readOnly defaultValue="Read only" />
            <Input aria-invalid defaultValue="Giá trị không hợp lệ" />
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input className="rounded-full bg-secondary pl-11" placeholder="Tìm kiếm sản phẩm..." />
            </div>
          </div>

          <div className="space-y-4">
            <Sub>Label + field</Sub>
            <div className="space-y-2">
              <Label>
                Tên sản phẩm <span className="text-destructive">*</span>
              </Label>
              <Input defaultValue="Giày Chạy Bộ Ultraboost 22" />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select defaultValue="shoes" items={categoryItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select — disabled</Label>
              <Select disabled defaultValue="shoes" items={categoryItems}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shoes">Giày Thể Thao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mô tả tóm tắt</Label>
              <Textarea placeholder="Trải nghiệm năng lượng tối đa…" />
            </div>

            <Sub>Checkbox</Sub>
            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <label className="flex items-center gap-2"><Checkbox /> unchecked</label>
              <label className="flex items-center gap-2"><Checkbox defaultChecked /> Ghi nhớ đăng nhập</label>
              <label className="flex items-center gap-2"><Checkbox indeterminate /> indeterminate</label>
              <label className="flex items-center gap-2"><Checkbox disabled /> disabled</label>
              <label className="flex items-center gap-2"><Checkbox disabled defaultChecked /> disabled</label>
            </div>

            <Sub>Radio (payment method)</Sub>
            <RadioGroup value={radio} onValueChange={(v) => setRadio(v as string)}>
              {[
                ["cod", "Thanh toán khi nhận hàng (COD)"],
                ["card", "Thẻ Tín dụng / Ghi nợ"],
                ["qr", "Chuyển khoản Ngân hàng / Quét mã VietQR"],
              ].map(([v, l]) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 text-label font-bold has-data-checked:border-2 has-data-checked:border-ink has-data-checked:bg-white"
                >
                  <RadioGroupItem value={v} />
                  {l}
                </label>
              ))}
            </RadioGroup>

            <Sub>Switch</Sub>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <label className="flex items-center gap-2"><Switch /> off</label>
              <label className="flex items-center gap-2"><Switch defaultChecked /> on</label>
              <label className="flex items-center gap-2"><Switch size="sm" defaultChecked /> sm</label>
              <label className="flex items-center gap-2"><Switch disabled /> disabled</label>
            </div>
          </div>
        </div>
      </Section>

      {/* ───── Badges ───── */}
      <Section id="badges" title="Badge" note="Pill (status) and tag (product label) shapes.">
        <Sub>Pill</Sub>
        <div className="flex flex-wrap gap-3">
          <Badge>Mặc định</Badge>
          <Badge variant="warning">Chờ duyệt</Badge>
          <Badge variant="info">Đang đóng gói</Badge>
          <Badge variant="success">Đang giao</Badge>
          <Badge variant="brand">Sắp hết</Badge>
          <Badge variant="dark">Hết hàng</Badge>
          <Badge variant="solid">5</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <Sub>Tag</Sub>
        <div className="flex flex-wrap gap-3">
          <Badge shape="tag" variant="solid">NEW</Badge>
          <Badge shape="tag" variant="dark">-20%</Badge>
        </div>
      </Section>

      {/* ───── Tabs ───── */}
      <Section id="tabs" title="Tabs" note="Not present in Figma — inferred (see conflict list).">
        <div className="grid gap-8 md:grid-cols-2">
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">Tất cả</TabsTrigger>
              <TabsTrigger value="b">Chờ duyệt</TabsTrigger>
              <TabsTrigger value="c">Đang giao</TabsTrigger>
              <TabsTrigger value="d" disabled>Disabled</TabsTrigger>
            </TabsList>
            <TabsContent value="a">Nội dung tab Tất cả</TabsContent>
            <TabsContent value="b">Nội dung tab Chờ duyệt</TabsContent>
            <TabsContent value="c">Nội dung tab Đang giao</TabsContent>
          </Tabs>
          <Tabs defaultValue="a">
            <TabsList variant="line">
              <TabsTrigger value="a">Thông tin</TabsTrigger>
              <TabsTrigger value="b">Tồn kho</TabsTrigger>
              <TabsTrigger value="c">Đánh giá</TabsTrigger>
            </TabsList>
            <TabsContent value="a">Nội dung Thông tin</TabsContent>
            <TabsContent value="b">Nội dung Tồn kho</TabsContent>
            <TabsContent value="c">Nội dung Đánh giá</TabsContent>
          </Tabs>
        </div>
      </Section>

      {/* ───── Table ───── */}
      <Section id="table" title="Table" note="Admin “Đơn hàng mới nhất cần xử lý” pattern.">
        <div className="rounded-3xl border border-border bg-card p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Tổng tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Xử lý</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["#SB-2026-102", "Nguyễn Văn A", "4.000.000 đ", "warning", "Chờ duyệt", "Duyệt"],
                ["#SB-2026-101", "Trần Thị B", "1.500.000 đ", "info", "Đang đóng gói", "Chi tiết"],
                ["#SB-2026-100", "Lê Hoàng Nam", "960.000 đ", "success", "Đang giao", "Chi tiết"],
              ].map(([id, name, total, v, st, act]) => (
                <TableRow key={id}>
                  <TableCell className="font-bold">{id}</TableCell>
                  <TableCell className="font-bold">{name}</TableCell>
                  <TableCell className="font-bold text-primary">{total}</TableCell>
                  <TableCell>
                    <Badge variant={v as "warning" | "info" | "success"}>{st}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={act === "Duyệt" ? "dark" : "secondary"}>{act}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      {/* ───── Overlays ───── */}
      <Section id="overlays" title="Dialog · Sheet · Skeleton">
        <div className="flex flex-wrap gap-4">
          <Dialog>
            <DialogTrigger render={<Button variant="dark">Mở Dialog</Button>} />
            <DialogContent className="sm:max-w-[760px]">
              <DialogHeader>
                <DialogTitle>Thêm Sản Phẩm Mới</DialogTitle>
                <DialogDescription>
                  Khởi tạo sản phẩm thể thao, phân loại kích cỡ, màu sắc và cấu hình tồn kho ban đầu
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tên sản phẩm <span className="text-destructive">*</span></Label>
                  <Input placeholder="Giày Chạy Bộ Ultraboost 22" />
                </div>
                <div className="space-y-2">
                  <Label>Mã SKU <span className="text-destructive">*</span></Label>
                  <Input placeholder="UB-22-BLK" />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-xl bg-secondary px-5 py-4 text-xs font-bold">
                Hiển thị ngay trên Trang Chủ & Danh Mục Sản Phẩm
                <Switch defaultChecked />
              </label>
              <DialogFooter>
                <Button variant="secondary" size="lg">Hủy bỏ</Button>
                <Button size="lg">Lưu Sản Phẩm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger render={<Button variant="outline">Mở Sheet (phải)</Button>} />
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Giỏ hàng (3)</SheetTitle>
                <SheetDescription>Sheet side=right</SheetDescription>
              </SheetHeader>
              <div className="flex-1 px-6 text-sm text-muted-foreground">Nội dung sheet</div>
              <SheetFooter>
                <Button size="lg">Đặt hàng ngay</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger render={<Button variant="outline">Mở Sheet (trái)</Button>} />
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Bộ lọc</SheetTitle>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>

        <Sub>Skeleton</Sub>
        <div className="grid max-w-3xl grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-4/3 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </Section>

      {/* ───── Toast ───── */}
      <Section id="feedback" title="Toast (sonner)" note="Not present in Figma — inferred from card/status tokens.">
        <div className="flex flex-wrap gap-4">
          <Button variant="dark" onClick={() => toast("Đã thêm vào giỏ hàng", { description: "Giày Chạy Bộ Ultraboost 22 · Size 40" })}>Default</Button>
          <Button variant="secondary" onClick={() => toast.success("Đặt hàng thành công")}>Success</Button>
          <Button variant="secondary" onClick={() => toast.info("Voucher SPORT2026 đã được áp dụng")}>Info</Button>
          <Button variant="secondary" onClick={() => toast.warning("Sản phẩm sắp hết hàng")}>Warning</Button>
          <Button variant="destructive" onClick={() => toast.error("Thanh toán thất bại")}>Error</Button>
        </div>
      </Section>
    </main>
  )
}
