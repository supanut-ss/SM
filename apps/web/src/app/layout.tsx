import type { ReactNode } from "react";

export const metadata = {
  title: "Lotus Desk",
  description: "ระบบหลังบ้านร้านสปา / นวด / เสริมความงาม",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
