export type OrderStatusValue = "PENDING" | "CONFIRMED" | "SHIPPING" | "DELIVERED" | "CANCELLED"

export interface OrderSummary {
  id: string
  /** Mã dễ đọc, vd FS-20261109-0001. */
  code: string
  createdAt: Date
  /** VND */
  total: number
  status: OrderStatusValue
  /** Tên sản phẩm đầu tiên của đơn. */
  firstProductName: string
  /** Số dòng sản phẩm khác trong đơn ngoài sản phẩm đầu. */
  otherLines: number
  /** Tổng số lượng sản phẩm. */
  quantity: number
}

export interface OrderAddressSnapshot {
  fullName: string
  phone: string
  street: string
  ward: string
  district: string
  province: string
}

export interface OrderDetail {
  id: string
  code: string
  status: OrderStatusValue
  paymentMethod: string
  paymentStatus: string
  createdAt: Date
  subtotal: number
  shippingFee: number
  total: number
  note: string | null
  shippingAddress: OrderAddressSnapshot
  items: {
    productName: string
    size: string
    color: string
    unitPrice: number
    quantity: number
  }[]
}

export interface OrderItemView {
  variantId: string | null
  productName: string
  size: string
  color: string
  unitPrice: number
  quantity: number
  image: { url: string; alt: string } | null
  slug: string | null
  /** Biến thể còn bán và đủ hàng cho số lượng đã mua (để mua lại). */
  inStock: boolean
}

export interface OrderHistoryView {
  fromStatus: OrderStatusValue | null
  toStatus: OrderStatusValue
  actorType: "CUSTOMER" | "ADMIN" | "SYSTEM"
  /** Tên người đổi (null khi hệ thống). */
  actorName: string | null
  note: string | null
  createdAt: Date
}

export interface OrderListItem {
  id: string
  code: string
  createdAt: Date
  status: OrderStatusValue
  paymentMethod: string
  paymentStatus: string
  total: number
  /** Tổng số lượng sản phẩm. */
  quantity: number
  /** Tối đa 3 dòng đầu của đơn. */
  items: OrderItemView[]
  lineCount: number
  /** Lý do huỷ (nếu có) và thời điểm giao thành công — lấy từ lịch sử trạng thái. */
  cancelReason: string | null
  deliveredAt: Date | null
}

export interface OrderListResult {
  items: OrderListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  /** Số đơn theo từng trạng thái (đã áp từ khoá tìm kiếm, bỏ lọc trạng thái) và tổng. */
  counts: Record<OrderStatusValue | "ALL", number>
}

export interface OrderDetailView extends OrderDetail {
  items: (OrderDetail["items"][number] & Pick<OrderItemView, "variantId" | "image" | "slug" | "inStock">)[]
  history: OrderHistoryView[]
}

export interface ReorderResult {
  /** Số dòng đã thêm vào giỏ (kể cả khi chỉ thêm được một phần số lượng). */
  added: number
  skipped: { productName: string; size: string; color: string; reason: "OUT_OF_STOCK" | "UNAVAILABLE" | "IN_CART_MAX" }[]
}

/** Một dòng không đủ hàng khi đặt đơn. */
export interface StockShortage {
  variantId: string
  productName: string
  size: string
  color: string
  requested: number
  /** Số còn lại trong kho (0 nếu hết hoặc ngừng bán). */
  available: number
}
