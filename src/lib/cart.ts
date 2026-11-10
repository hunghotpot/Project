// Kiểu giỏ hàng + hàm tính tổng dùng chung server/client (client dùng cho optimistic update).

export type CartWarningCode = "PRICE_CHANGED" | "STOCK_REDUCED" | "OUT_OF_STOCK" | "UNAVAILABLE"

export interface CartWarning {
  code: CartWarningCode
  message: string
}

export interface CartLine {
  variantId: string
  productId: string
  slug: string
  name: string
  sku: string
  size: string
  color: string
  colorHex: string
  image: { url: string; alt: string } | null
  /** Giá hiện tại của biến thể (VND). */
  unitPrice: number
  quantity: number
  lineTotal: number
  /** Tồn kho hiện tại của biến thể. */
  stock: number
  warnings: CartWarning[]
}

export interface CartView {
  items: CartLine[]
  /** Tổng số lượng (badge ở header). */
  itemCount: number
  /** Tạm tính, chỉ gồm dòng còn bán được (còn hàng, sản phẩm đang bán). */
  subtotal: number
}

export const EMPTY_CART: CartView = { items: [], itemCount: 0, subtotal: 0 }

/** Dòng còn mua được: sản phẩm đang bán và còn hàng. */
export function isPurchasable(line: Pick<CartLine, "warnings">): boolean {
  return !line.warnings.some((w) => w.code === "UNAVAILABLE" || w.code === "OUT_OF_STOCK")
}

export function summarizeCart(items: CartLine[]): CartView {
  return {
    items,
    itemCount: items.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: items.filter(isPurchasable).reduce((sum, l) => sum + l.lineTotal, 0),
  }
}

export const MAX_LINE_QUANTITY = 99
