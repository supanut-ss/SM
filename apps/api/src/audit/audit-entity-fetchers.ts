import type { PrismaService } from "../prisma/prisma.service";

export type EntityFetcher = (id: string, prisma: PrismaService) => Promise<unknown>;

/**
 * เพิ่ม entity ใหม่ที่นี่คู่กับทุกครั้งที่ใช้ @AuditEntity("XxxYyy") ใน controller — ถ้าไม่เพิ่ม
 * AuditInterceptor จะบันทึก log ได้แต่ before จะเป็น null เสมอ (ไม่ผิด แค่ diff จะโชว์ไม่ครบ)
 */
export const AUDIT_ENTITY_FETCHERS: Record<string, EntityFetcher> = {
  Branch: (id, prisma) => prisma.client.branch.findUnique({ where: { id } }),
};
