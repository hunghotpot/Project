import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AssistantPreview } from "./assistant-preview"

export const metadata: Metadata = { title: "Assistant UI (dev)" }

// Trang xem thử giao diện trợ lý với dữ liệu mẫu: 404 ở bản production.
export default function AssistantPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <AssistantPreview />
}
