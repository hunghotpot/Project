"use client"

import { useEffect, useState } from "react"
import { cn } from "cn"

/**
 * Thẻ (sản phẩm, size, bộ đồ, xác nhận) hiện SAU tin nhắn: nở chiều cao từ 0, mờ dần và trượt xuống nhẹ, để người xem thấy thẻ
 * "trượt ra" thay vì bật lên đột ngột. `delay` (ms) dùng để các thẻ liền nhau hiện lần lượt. `animate = false` thì hiện ngay
 * (tin cũ khi mở lại khung chat không chạy lại hiệu ứng). Tôn trọng `prefers-reduced-motion`.
 * Chiều cao nở bằng lưới (`grid-rows` 0fr → 1fr) nên không cần đo chiều cao của thẻ.
 */
export function Reveal({ children, animate = true, delay = 0 }: { children: React.ReactNode; animate?: boolean; delay?: number }) {
  const [open, setOpen] = useState(!animate)
  // Sau khi nở xong thì bỏ `overflow-hidden` để bóng đổ và viền focus của thẻ không bị cắt.
  const [settled, setSettled] = useState(!animate)

  useEffect(() => {
    if (!animate) return
    const t = setTimeout(() => setOpen(true), delay + 30)
    return () => clearTimeout(t)
  }, [animate, delay])

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        open ? "translate-y-0 grid-rows-[1fr] opacity-100" : "-translate-y-3 grid-rows-[0fr] opacity-0",
      )}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && open) setSettled(true)
      }}
    >
      <div className={cn("min-h-0", !settled && "overflow-hidden")}>{children}</div>
    </div>
  )
}
