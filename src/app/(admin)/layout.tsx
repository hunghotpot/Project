import type { Metadata } from "next"

// Metadata đặt ở layout cha của /admin để title.template áp dụng cho cả trang trong segment /admin (template không áp cho segment chứa nó).
export const metadata: Metadata = {
  title: { default: "Quản trị", template: "%s | Quản trị" },
  robots: { index: false, follow: false },
}

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return children
}
