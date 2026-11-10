"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { CART_KEY } from "@/hooks/use-cart"
import type { CartView } from "@/lib/cart"

// Nạp giỏ do server render sẵn vào cache để header/drawer/trang giỏ hiển thị đúng ngay từ HTML đầu tiên.
export function CartProvider({ initialCart, children }: { initialCart: CartView; children: React.ReactNode }) {
  const [client] = useState(() => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
    qc.setQueryData(CART_KEY, initialCart)
    return qc
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
