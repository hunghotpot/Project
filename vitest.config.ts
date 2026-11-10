import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@": src(""),
      // "server-only" ném lỗi khi chạy ngoài môi trường react-server; test thì bỏ qua.
      "server-only": src("test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Các test tích hợp dùng chung một DB và bộ đếm mã đơn (OrderSequence): chạy song song sẽ đụng nhau → trùng mã đơn.
    fileParallelism: false,
    // .env cho DATABASE_URL: test tích hợp của order.service chạy trên PostgreSQL thật (dữ liệu test tự dọn).
    env: {
      ...loadEnv("test", process.cwd(), ""),
      JWT_SECRET: "test-secret-test-secret-test-secret-123456",
      // Giá trị giả cố định: test không bao giờ dùng secret VNPay thật trong .env.
      VNP_TMN_CODE: "TESTTMN1",
      VNP_HASH_SECRET: "test-vnpay-hash-secret-0123456789",
      VNP_URL: "https://sandbox.test/vpcpay.html",
      VNP_RETURN_URL: "http://localhost:3000/api/payment/vnpay/return",
    },
  },
})


