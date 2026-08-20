import { SetMetadata } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@lotus-desk/contracts";

export const REQUIRE_PERMISSION_KEY = "require_permission";

export interface RequiredPermission {
  action: PermissionAction;
  resource: PermissionResource;
}

/**
 * ประกาศสิทธิ์ที่ endpoint นี้ต้องมี — ใช้คู่กับ PermissionGuard เสมอ (ต้องมี JwtAuthGuard รันมาก่อน
 * เพื่อให้ request.user มีค่า) route ต้องมี param ชื่อ `branchId` หรือส่ง header `x-branch-id` มา
 * ไม่งั้น PermissionGuard จะปฏิเสธด้วย 400 ทันที (ดู T1.4)
 *
 * ตัวอย่าง: @RequirePermission("view", "branch")
 */
export const RequirePermission = (action: PermissionAction, resource: PermissionResource) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { action, resource } satisfies RequiredPermission);
