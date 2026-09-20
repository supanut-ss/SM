import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ — Sabaizy" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-pop">
        {/* โลโก้เต็ม (มีคำว่า Sabaizy อยู่ในภาพแล้ว) เลยไม่ต้องมี <h1> ข้อความซ้ำแยกอีกจุด — h1 ที่นี่
            เก็บไว้ให้ screen reader/heading hierarchy เท่านั้น ไม่โชว์ผล (sr-only)
            unoptimized: Next image optimizer (ไม่มี sharp ในโปรเจกต์) แปลง PNG ขนาดใหญ่นี้ไม่ผ่าน */}
        <h1 className="sr-only">Sabaizy</h1>
        <Image
          src="/logo-full.png"
          alt="Sabaizy"
          width={1177}
          height={1337}
          className="mx-auto mb-2 h-40 w-auto"
          priority
          unoptimized
        />
        <p className="text-pretty mb-6 text-center text-sm text-ink-muted">เข้าสู่ระบบหลังบ้านร้านสปา</p>
        <LoginForm />
      </div>
    </main>
  );
}
