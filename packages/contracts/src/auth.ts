import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
});

export type LoginInput = z.infer<typeof loginSchema>;
