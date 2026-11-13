# Chính sách cửa hàng (chỉ điều đã có trong hệ thống)

Nguồn: `src/lib/policies.ts`, `src/lib/shipping.ts`, `src/lib/order.ts`. Khi những file này đổi, phải sửa lại file này cho khớp.

## Phí vận chuyển và miễn phí vận chuyển
<!-- meta: {} -->
Đơn hàng từ 500.000 ₫ được miễn phí vận chuyển. Đơn hàng dưới 500.000 ₫ tính phí vận chuyển đồng giá 30.000 ₫. Phí được tính tự động khi đặt hàng. Cửa hàng hiện chưa có thông tin về thời gian giao hàng, nên trợ lý không hứa ngày giao.

## Các phương thức thanh toán
<!-- meta: {} -->
Cửa hàng hỗ trợ ba phương thức thanh toán. Thứ nhất, thanh toán khi nhận hàng (COD). Thứ hai, chuyển khoản bằng cách quét mã VietQR ở trang thanh toán; đơn được xác nhận sau khi cửa hàng nhận được tiền. Thứ ba, thanh toán bằng thẻ qua cổng VNPay.

## Hạn thanh toán khi dùng VNPay
<!-- meta: {} -->
Đơn thanh toán qua VNPay cần được thanh toán trong 15 phút. Quá hạn, đơn tự động bị huỷ và số lượng hàng được hoàn lại kho.

## Chuyển khoản và thời điểm xác nhận đơn
<!-- meta: {} -->
Với chuyển khoản, khách quét mã VietQR ở trang thanh toán và chuyển đúng số tiền. Cửa hàng xác nhận bằng tay khi nhận được tiền, nên đơn có thể chưa chuyển sang đã thanh toán ngay lập tức. Hệ thống hiện chưa đặt hạn tự huỷ cho đơn chuyển khoản.

## Huỷ đơn hàng
<!-- meta: {} -->
Khách có thể huỷ đơn trong mục Đơn hàng của tôi khi đơn đang chờ xác nhận hoặc đã xác nhận. Khi huỷ, số lượng hàng được hoàn lại kho. Đơn đã chuyển sang giao hoặc hoàn thành thì không huỷ được qua trang này. Chính sách hoàn tiền cho đơn đã thanh toán chưa có thông tin.

## Đổi trả, bảo hành và hoàn tiền: chưa có thông tin
<!-- meta: {} -->
Cửa hàng chưa cung cấp nội dung chính sách đổi trả, bảo hành và hoàn tiền (trang chính sách đang ở trạng thái đang cập nhật). Vì vậy trợ lý không được nói về thời hạn đổi trả, điều kiện đổi trả, phí đổi trả hay thời gian hoàn tiền. Khi khách hỏi, trả lời rằng hiện chưa có thông tin, gợi ý xem trang chính sách trên website hoặc liên hệ cửa hàng. Cập nhật đoạn này khi cửa hàng có chính sách thật.

## Bảo mật thông tin: chưa có thông tin
<!-- meta: {} -->
Cửa hàng chưa cung cấp nội dung chính sách bảo mật. Trợ lý không cam kết về cách lưu trữ hay sử dụng dữ liệu cá nhân. Về số đo cơ thể khách nhập khi nhờ tư vấn size, hiện hệ thống chỉ dùng để tính gợi ý và không lưu lại.

## Khi khách hỏi về khuyến mãi, mã giảm giá hoặc điểm thưởng
<!-- meta: {} -->
Hệ thống hiện chưa có tính năng mã giảm giá hay chương trình khuyến mãi hoạt động trong đơn hàng (màn Voucher bên quản trị mới là giao diện minh hoạ). Trợ lý không được nhắc mã giảm giá, mức giảm hay khuyến mãi đang chạy. Nếu khách hỏi, nói rằng hiện chưa có thông tin về khuyến mãi.
