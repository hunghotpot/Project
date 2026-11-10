// Phí vận chuyển đơn giản theo tổng tiền hàng. Gom một chỗ để thay bằng bảng phí theo vùng/trọng lượng sau này.

export const FREE_SHIPPING_THRESHOLD = 500_000
export const FLAT_SHIPPING_FEE = 30_000

/** Miễn phí từ 500.000đ, dưới mức đó đồng giá 30.000đ. Giỏ rỗng không mất phí. */
export function calculateShippingFee(subtotal: number): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0
  return FLAT_SHIPPING_FEE
}
