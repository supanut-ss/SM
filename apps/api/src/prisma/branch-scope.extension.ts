import type { PrismaClient } from "@lotus-desk/db";

/**
 * โมเดลที่มีคอลัมน์ branchId และต้องถูกกรองอัตโนมัติเสมอ (ดู CLAUDE.md ข้อ 5: ทุก query ที่แตะ
 * ข้อมูลร้านต้องกรองด้วย branchId เสมอ) — เพิ่มชื่อโมเดลใหม่ที่นี่เมื่อ Task ในอนาคตเพิ่มตารางที่มี
 * branchId (เช่น Appointment ใน T4.2, ServiceJob ใน T5.5)
 *
 * หมายเหตุ: ครอบเฉพาะ read operation (findMany/findFirst/findUnique/count) ที่มีตัวเรียกจริงตอนนี้
 * ยังไม่ครอบ create/update/delete เพราะยังไม่มี endpoint เขียนข้อมูลโมเดลเหล่านี้ (Branch เอง ไม่ใช่
 * "ข้อมูลที่อยู่ในสาขา" จึงไม่อยู่ในลิสต์นี้ — กรองด้วย id ตรง ๆ ในตัว endpoint แทน)
 */
export const BRANCH_SCOPED_MODELS = new Set([
  "AuditLog",
  "Device",
  "UserBranch",
  "StaffProfile",
  "RoomType",
  "Room",
]);

const SCOPED_OPERATIONS = new Set(["findMany", "findFirst", "findUnique", "count"]);

/**
 * ตรรกะจริงของการกรอง — แยกออกมาให้ unit test เรียกตรง ๆ ได้โดยไม่ต้องผ่าน Prisma $extends จริง
 * (ดู branch-scope.extension.spec.ts) คืน args ใหม่เสมอ (ไม่แก้ของเดิม) กันผลข้างเคียงที่ไม่ตั้งใจ
 */
export function applyBranchScope(
  model: string,
  operation: string,
  args: Record<string, unknown>,
  branchId: string,
): Record<string, unknown> {
  if (!BRANCH_SCOPED_MODELS.has(model) || !SCOPED_OPERATIONS.has(operation)) {
    return args;
  }
  const where = args.where as Record<string, unknown> | undefined;
  return { ...args, where: { ...where, branchId } };
}

/**
 * ห่อ PrismaClient ให้ query ของโมเดลใน BRANCH_SCOPED_MODELS ถูกกรองด้วย branchId เสมอ
 * แม้ service ชั้นบนจะลืมใส่ where.branchId เองก็ตาม — เป็นชั้นป้องกันสำรอง (defense in depth)
 * ไม่ใช่การเปลี่ยนสิทธิ์ (สิทธิ์เช็คที่ PermissionGuard) แต่เป็นการกันข้อมูลสาขาอื่นรั่วจาก query พลาด
 */
export function withBranchScope(client: PrismaClient, branchId: string): PrismaClient {
  // การ intercept ด้วย query component ไม่เพิ่ม method ใหม่ให้ client (ต่างจาก model/client component)
  // จึงยังเป็น PrismaClient ที่ใช้งานตรงกันได้ทุกอย่าง — cast เพราะ type ที่ $extends อนุมานเองอ้างถึง
  // path ภายในของ @prisma/client/runtime ที่ export ออกมาไม่ได้ (TS2742)
  return client.$extends({
    name: "branch-scope",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(applyBranchScope(model, operation, args, branchId) as typeof args);
        },
      },
    },
  }) as PrismaClient;
}
