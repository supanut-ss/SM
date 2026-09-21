"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label } from "@lotus-desk/ui";
import { authApi, ApiError } from "../../lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.login({ email, password });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">อีเมลหรือชื่อผู้ใช้</Label>
        {/* type="text" ไม่ใช่ "email" — เข้าด้วยชื่อผู้ใช้ก็ได้แล้ว (ดู docs/decisions.md ADR-065) ฟิลด์
            "email" ในคำขอ API คงชื่อเดิมไว้แม้ค่าจะเป็นชื่อผู้ใช้ก็ได้ (ดูเหตุผลใน packages/contracts/src/auth.ts) */}
        <Input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-pretty rounded-DEFAULT bg-rose-tint px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
