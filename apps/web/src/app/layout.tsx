import type { ReactNode } from "react";
import { THEME_INIT_SCRIPT } from "@lotus-desk/ui";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata = {
  title: "Lotus Desk",
  description: "ระบบหลังบ้านร้านสปา / นวด / เสริมความงาม",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* กันหน้าจอกระพริบธีมผิดตอนโหลด — ต้องรันก่อน paint จึงใช้ script ตรง ๆ ไม่ใช้ useEffect */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
