import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ — Lotus Desk" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-pop">
        <h1 className="font-display text-2xl font-semibold text-ink">Lotus Desk</h1>
        <p className="mt-1 mb-6 text-sm text-ink-muted">เข้าสู่ระบบหลังบ้านร้านสปา</p>
        <LoginForm />
      </div>
    </main>
  );
}
