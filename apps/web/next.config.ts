import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // output: "standalone" ถูกเปิดใช้ตอน T9.1 (Dockerfile multi-stage) เท่านั้น
  // การเปิดไว้ตอนพัฒนาบน Windows ทำให้ next build ล้มเหลว (EPERM: symlink ต้องใช้สิทธิ์ admin/Developer Mode)
};

export default nextConfig;
