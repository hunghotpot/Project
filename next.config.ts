import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ảnh seed là ảnh giữ chỗ từ placehold.co. Giữ picsum để dữ liệu cũ (chưa seed lại) vẫn hiển thị khi picsum hoạt động.
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  // Ảnh Admin tải lên (public/uploads): file có sẵn lúc khởi động được Next phát thẳng, không qua route handler,
  // nên header an toàn đặt ở đây để áp cho MỌI ảnh: không đoán loại nội dung, không chạy script nếu ai đó mở trực tiếp.
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: "default-src 'none'; sandbox" },
        ],
      },
    ];
  },
};

export default nextConfig;
