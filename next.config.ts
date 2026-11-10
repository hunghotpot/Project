import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ảnh seed lấy từ picsum.photos (redirect sang fastly.picsum.photos).
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
