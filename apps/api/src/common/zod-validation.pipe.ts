import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Validation pipe ใช้ Zod schema จาก packages/contracts ตรง ๆ (ดู CLAUDE.md: schema เดียวใช้ทั้ง
 * API DTO และ React Hook Form) — ใช้แทน class-validator ทั้งระบบ
 *
 * ตัวอย่าง: @Body(new ZodValidationPipe(loginSchema)) body: LoginInput
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new BadRequestException({ message: "ข้อมูลไม่ถูกต้อง", issues });
    }
    return result.data;
  }
}
