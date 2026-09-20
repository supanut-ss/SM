import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ — Sabaizy" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-8 shadow-pop">
        <h1 className="text-balance font-display text-2xl font-semibold text-ink">Sabaizy</h1>
        <p className="text-pretty mt-1 mb-6 text-sm text-ink-muted">เข้าสู่ระบบหลังบ้านร้านสปา</p>
        <LoginForm />
      </div>
    </main>
  );
}
