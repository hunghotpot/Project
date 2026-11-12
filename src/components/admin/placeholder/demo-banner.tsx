import { InfoIcon } from "lucide-react"

/** Biểu ngữ đầu màn hình dựng tĩnh: dữ liệu là hằng số minh hoạ, mọi nút ghi chưa kết nối backend. */
export function DemoBanner() {
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-5 py-3 text-label font-bold text-warning">
      <InfoIcon className="size-4 shrink-0" aria-hidden />
      Giao diện minh hoạ, chưa kết nối dữ liệu
    </div>
  )
}
