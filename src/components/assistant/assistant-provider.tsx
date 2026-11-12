"use client"

import { createContext, useContext } from "react"

// enabled: cờ bật/tắt trợ lý (AI_ENABLED, đọc ở server trong layout). Tắt thì không hiện nút mở chat ở bất kỳ đâu.
// authenticated: trợ lý chỉ dành cho người đã đăng nhập; khách bấm nút sẽ được chuyển sang trang đăng nhập.
interface AssistantAccess {
  enabled: boolean
  authenticated: boolean
}

const AssistantAccessContext = createContext<AssistantAccess>({ enabled: false, authenticated: false })

export function AssistantProvider({
  enabled,
  authenticated,
  children,
}: AssistantAccess & { children: React.ReactNode }) {
  return <AssistantAccessContext.Provider value={{ enabled, authenticated }}>{children}</AssistantAccessContext.Provider>
}

export const useAssistantAccess = () => useContext(AssistantAccessContext)

/** Đường dẫn đăng nhập quay lại đúng trang hiện tại (cùng cách với nút giỏ hàng và nút thêm vào giỏ). */
export const loginUrlFor = (pathname: string) => `/login?next=${encodeURIComponent(pathname)}`
