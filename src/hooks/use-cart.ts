"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { summarizeCart, type CartLine, type CartView } from "@/lib/cart"
import { useCartUi } from "@/stores/cart-ui"

export const CART_KEY = ["cart"] as const

/** Đủ thông tin để dựng dòng giỏ tạm (optimistic) khi sản phẩm chưa có trong giỏ. */
export type CartLinePreview = Pick<
  CartLine,
  "variantId" | "productId" | "slug" | "name" | "sku" | "size" | "color" | "colorHex" | "image" | "unitPrice" | "stock"
>

class CartApiError extends Error {}

async function request(url: string, init?: RequestInit): Promise<CartView> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (data as { error?: { message?: string } } | null)?.error?.message
    throw new CartApiError(message ?? "Có lỗi xảy ra, vui lòng thử lại")
  }
  return data as CartView
}

const send = (url: string, method: string, body?: unknown) =>
  request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })

/** Giỏ hiện tại. Dữ liệu ban đầu do CartProvider nạp từ server nên không nhấp nháy khi tải trang. */
export function useCart() {
  return useQuery({ queryKey: CART_KEY, queryFn: () => request("/api/cart") })
}

// Mutation chung: cập nhật cache ngay (optimistic), lỗi thì hoàn tác + toast, xong thì đồng bộ lại với server.
// Khi còn mutation khác đang chạy thì chưa refetch để không ghi đè trạng thái optimistic mới hơn.
function useCartMutation<V>(opts: {
  request: (v: V) => Promise<CartView>
  optimistic: (cart: CartView, v: V) => CartView
  onSuccess?: () => void
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: CART_KEY,
    mutationFn: opts.request,
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: CART_KEY })
      const previous = qc.getQueryData<CartView>(CART_KEY)
      if (previous) qc.setQueryData<CartView>(CART_KEY, opts.optimistic(previous, v))
      return { previous }
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(CART_KEY, ctx.previous)
      toast.error(err.message)
    },
    onSuccess: opts.onSuccess,
    onSettled: () => {
      if (qc.isMutating({ mutationKey: CART_KEY }) <= 1) void qc.invalidateQueries({ queryKey: CART_KEY })
    },
  })
}

const withQuantity = (line: CartLine, quantity: number): CartLine => ({
  ...line,
  quantity,
  lineTotal: line.unitPrice * quantity,
})

export function useAddToCart() {
  return useCartMutation<{ variantId: string; quantity: number; preview: CartLinePreview }>({
    request: ({ variantId, quantity }) => send("/api/cart/items", "POST", { variantId, quantity }),
    optimistic: (cart, { variantId, quantity, preview }) => {
      const exists = cart.items.some((l) => l.variantId === variantId)
      const items = exists
        ? cart.items.map((l) => (l.variantId === variantId ? withQuantity(l, l.quantity + quantity) : l))
        : [...cart.items, { ...preview, quantity, lineTotal: preview.unitPrice * quantity, warnings: [] }]
      return summarizeCart(items)
    },
    onSuccess: () => {
      toast.success("Đã thêm vào giỏ hàng")
      useCartUi.getState().setOpen(true)
    },
  })
}

/** quantity = 0 xoá dòng (khớp với cart.service). */
export function useUpdateQuantity() {
  return useCartMutation<{ variantId: string; quantity: number }>({
    request: ({ variantId, quantity }) =>
      send(`/api/cart/items/${encodeURIComponent(variantId)}`, "PATCH", { quantity }),
    optimistic: (cart, { variantId, quantity }) =>
      summarizeCart(
        quantity === 0
          ? cart.items.filter((l) => l.variantId !== variantId)
          : cart.items.map((l) => (l.variantId === variantId ? withQuantity(l, quantity) : l))
      ),
  })
}

export function useRemoveItem() {
  return useCartMutation<{ variantId: string }>({
    request: ({ variantId }) => send(`/api/cart/items/${encodeURIComponent(variantId)}`, "DELETE"),
    optimistic: (cart, { variantId }) => summarizeCart(cart.items.filter((l) => l.variantId !== variantId)),
  })
}
