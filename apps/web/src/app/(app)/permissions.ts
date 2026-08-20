import type { PermissionAction, PermissionResource } from "@lotus-desk/contracts";

/**
 * เช็คแบบง่าย ๆ ฝั่ง frontend เพื่อ "ซ่อน/แสดงเมนู" เท่านั้น (UX affordance) ไม่ใช่ด่านความปลอดภัยจริง —
 * สิทธิ์จริงบังคับที่ apps/api ด้วย CASL (PermissionGuard) เสมอ ไม่จำเป็นต้องพึ่ง CASL ฝั่งนี้ให้หนัก
 * "manage" ครอบคลุม "view" เหมือนฝั่ง backend (ดู apps/api/src/modules/rbac/ability.factory.ts)
 */
export function hasPermission(
  permissions: string[],
  action: PermissionAction,
  resource: PermissionResource,
): boolean {
  if (permissions.includes(`${resource}:${action}`)) return true;
  if (action === "view" && permissions.includes(`${resource}:manage`)) return true;
  return false;
}
