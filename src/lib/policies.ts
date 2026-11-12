import { formatVnd } from "@/lib/format"
import { PAYMENT_WINDOW_MINUTES } from "@/lib/order"
import { FLAT_SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping"

/*
 * Chính sách cửa hàng: MỘT nguồn cho liên kết ở chân trang và trang /chinh-sach/[slug].
 * Chỉ ghi điều có thật trong hệ thống (phí ship, cách thanh toán, hạn thanh toán, điều kiện huỷ đơn lấy từ hằng số/code).
 * Đổi trả và bảo mật: CHƯA có nội dung do cửa hàng cung cấp, nên để trống ở dạng "đang cập nhật". Thay `pending` bằng nội dung thật.
 */

export interface PolicySection {
  heading: string
  body: string[]
}

export interface Policy {
  slug: string
  title: string
  intro: string
  sections: PolicySection[]
  /** true: nội dung đang chờ cửa hàng bổ sung. */
  pending?: boolean
}

export const POLICIES: Policy[] = [
  {
    slug: "van-chuyen",
    title: "Chính sách vận chuyển",
    intro: "Phí giao hàng được tính tự động khi bạn đặt hàng.",
    sections: [
      {
        heading: "Phí vận chuyển",
        body: [
          `Đơn hàng từ ${formatVnd(FREE_SHIPPING_THRESHOLD)} được miễn phí vận chuyển.`,
          `Đơn hàng dưới ${formatVnd(FREE_SHIPPING_THRESHOLD)} tính phí vận chuyển đồng giá ${formatVnd(FLAT_SHIPPING_FEE)}.`,
        ],
      },
    ],
  },
  {
    slug: "thanh-toan",
    title: "Chính sách thanh toán",
    intro: "Cửa hàng hiện hỗ trợ ba phương thức thanh toán.",
    sections: [
      {
        heading: "Phương thức thanh toán",
        body: [
          "Thanh toán khi nhận hàng (COD).",
          "Chuyển khoản: quét mã VietQR ở trang thanh toán. Đơn được xác nhận sau khi cửa hàng nhận được tiền.",
          "Thẻ qua cổng VNPay.",
        ],
      },
      {
        heading: "Hạn thanh toán qua VNPay",
        body: [
          `Đơn thanh toán qua VNPay cần được thanh toán trong ${PAYMENT_WINDOW_MINUTES} phút. Quá hạn, đơn tự động bị huỷ và số lượng hàng được hoàn lại kho.`,
        ],
      },
    ],
  },
  {
    slug: "doi-tra",
    title: "Chính sách đổi trả",
    intro: "Nội dung đổi trả đang được cửa hàng cập nhật.",
    pending: true,
    sections: [
      {
        heading: "Huỷ đơn",
        body: [
          'Bạn có thể huỷ đơn trong mục "Đơn hàng của tôi" khi đơn đang chờ xác nhận hoặc đã xác nhận. Số lượng hàng được hoàn lại kho.',
        ],
      },
    ],
  },
  {
    slug: "bao-mat",
    title: "Chính sách bảo mật",
    intro: "Nội dung bảo mật đang được cửa hàng cập nhật.",
    pending: true,
    sections: [],
  },
]

export const getPolicy = (slug: string): Policy | undefined => POLICIES.find((p) => p.slug === slug)
