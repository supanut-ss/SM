import { SetMetadata } from "@nestjs/common";

export const AUDIT_ENTITY_KEY = "audit_entity";

/**
 * ทำเครื่องหมาย endpoint ที่แก้ไขข้อมูลจริงให้ AuditInterceptor (global — ดู audit.module.ts) จับคู่กับ
 * entity fetcher ใน audit-entity-fetchers.ts (ต้องเพิ่ม fetcher คู่กันเมื่อประกาศ entity ใหม่)
 *
 * ต้องมี route param ชื่อ `${entity ตัวแรกเป็นตัวเล็ก}Id` เสมอ เช่น @AuditEntity("Branch") คู่กับ
 * :branchId — เป็น convention เดียวกับ PermissionGuard's branchId resolution
 */
export const AuditEntity = (entity: string) => SetMetadata(AUDIT_ENTITY_KEY, entity);
