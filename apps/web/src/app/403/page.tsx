import Link from "next/link";
import { Button } from "@lotus-desk/ui";

export const metadata = { title: "ไม่มีสิทธิ์เข้าถึง — Lotus Desk" };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 text-center shadow-pop">
        <h1 className="font-display text-2xl font-semibold text-ink">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="mt-3 text-sm text-ink-muted">
          บัญชีของคุณไม่มีสิทธิ์ดูข้อมูลส่วนนี้ — ถ้าจำเป็นต้องใช้งาน ให้ติดต่อผู้จัดการหรือเจ้าของร้าน
          เพื่อขอเพิ่มสิทธิ์ให้กับบทบาทของคุณ
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="secondary">กลับหน้าแดชบอร์ด</Button>
        </Link>
      </div>
    </main>
  );
}
