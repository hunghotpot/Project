import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DesignSystemView } from "./design-system-view"

export const metadata: Metadata = { title: "Design System (dev)" }

// Dev-only reference page: 404 in production builds.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <DesignSystemView />
}
