"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export const NOT_CONNECTED_MESSAGE = "Chức năng này chưa được kết nối"

/** Hiện toast "chưa kết nối" (dùng cho nút/biểu mẫu ghi của màn minh hoạ). Không gọi backend. */
export function notifyNotConnected() {
  toast.info(NOT_CONNECTED_MESSAGE)
}

/** Nút ghi của màn minh hoạ: bấm chỉ hiện toast, không đổi dữ liệu. */
export function NotConnectedButton({ onClick, type = "button", ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type={type}
      onClick={(e) => {
        onClick?.(e)
        notifyNotConnected()
      }}
      {...props}
    />
  )
}
