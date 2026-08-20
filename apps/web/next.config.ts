import type { NextConfig } from "next";

// URL ภายในของ apps/api — ไม่ใช้ NEXT_PUBLIC_* เพราะ browser ไม่ควรรู้จัก origin นี้ตรง ๆ เลย
// (ผ่าน rewrite ด้านล่างเสมอ ทำให้ทุกอย่างเป็น same-origin จาก browser — httpOnly cookie จาก
// apps/api ถึงจะใช้งานได้ปกติโดยไม่ต้องยุ่งกับ CORS/SameSite=None)
const API_URL = process.env.API_URL || "http://localhost:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // output: "standalone" ถูกเปิดใช้ตอน T9.1 (Dockerfile multi-stage) เท่านั้น
  // การเปิดไว้ตอนพัฒนาบน Windows ทำให้ next build ล้มเหลว (EPERM: symlink ต้องใช้สิทธิ์ admin/Developer Mode)
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
