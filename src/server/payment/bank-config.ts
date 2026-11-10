import "server-only"

/*
 * Tài khoản nhận chuyển khoản. Giá trị mặc định chỉ là DỮ LIỆU MẪU lấy từ Figma — phải đặt BANK_* trong .env
 * trước khi chạy thật, nếu không khách sẽ chuyển tiền tới tài khoản không phải của bạn.
 */
export const bankConfig = {
  name: process.env.BANK_NAME ?? "MB Bank (Quân Đội)",
  bin: process.env.BANK_BIN ?? "970422",
  accountNo: (process.env.BANK_ACCOUNT_NO ?? "999988882026").replace(/\s/g, ""),
  accountName: process.env.BANK_ACCOUNT_NAME ?? "CONG TY TNHH SPORT BRAND",
}

/** 999988882026 → "9999 8888 2026". */
export const formatAccountNo = (no: string) => no.replace(/(.{4})/g, "$1 ").trim()
