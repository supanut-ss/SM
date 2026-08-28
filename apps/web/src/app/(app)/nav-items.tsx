import type { ComponentType, SVGProps } from "react";
import type { PermissionAction, PermissionResource } from "@lotus-desk/contracts";
import { BillingIcon, BoardIcon, DashboardIcon, MemberIcon, PackageIcon, ServiceIcon, StaffIcon } from "./nav-icons";

/** ลำดับ 3 หมวดที่ต้องแสดงบนกระดานเมนูซ้าย (ดู docs/decisions.md ADR-047) — ใช้ลำดับนี้เสมอไม่ว่า
 * NAV_ITEMS จะถูกประกาศเรียงยังไง */
export const NAV_GROUPS = ["ปฏิบัติการ", "ข้อมูลร้าน", "จัดการร้าน"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export interface NavItem {
  href: string;
  label: string;
  group: NavGroup;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** ไม่ระบุ = แสดงเสมอ (เช่นแดชบอร์ด) ไม่ต้องเช็คสิทธิ์ */
  require?: { action: PermissionAction; resource: PermissionResource };
}

// จับคู่เมนูกับสิทธิ์ที่ต้องมี — คนละบทบาทเห็นเมนูไม่เท่ากันเพราะรายการนี้ (ดู T1.6 เกณฑ์ผ่าน
// "เห็นเมนูตามบทบาท") ปรับ path ให้ตรงกับหน้าจริงเมื่อ Task ที่สร้างหน้านั้นเสร็จ (T2.x–T8.x)
//
// ตอนนี้เปิดแค่ 6 เมนูแรกสำหรับ "Basic Package" ร้านพนักงานน้อย (ดู docs/decisions.md ADR-050) —
// กระดานคิว/บิล/บริการ/พนักงาน (แกนหลักที่ขาดไม่ได้) + สมาชิก/คอร์ส-แพ็กเกจ (ถ้าร้านขายคอร์ส)
// ลงเวลาเข้า-ออกงาน, ค่ามือ, โปรโมชั่น, ห้อง/เตียง, รายงาน ยังใช้งานได้ปกติทุกอย่างถ้าเรียก URL ตรง ๆ
// (ไม่ได้ปิดสิทธิ์ระดับ backend) แค่ซ่อนจากเมนูไปก่อนกันร้านเล็กงงกับฟังก์ชันที่ยังไม่พร้อมใช้ (เช่น
// ค่ามือที่เรตคอมมิชชั่นยังเป็นค่าสมมติ T6.2) — เพิ่มกลับเมื่อร้านต้องการจริง หรือรอหน้าตั้งค่า (T12.7)
// มาทำเป็นสวิตช์เปิด/ปิดต่อสาขาแทนการแก้โค้ดตรงนี้ทุกครั้ง
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "แดชบอร์ด", group: "ปฏิบัติการ", icon: DashboardIcon },
  { href: "/board", label: "กระดานคิว", group: "ปฏิบัติการ", icon: BoardIcon, require: { action: "view", resource: "booking" } },
  { href: "/billing", label: "บิล/แคชเชียร์", group: "ปฏิบัติการ", icon: BillingIcon, require: { action: "view", resource: "billing" } },
  { href: "/members", label: "สมาชิก", group: "ข้อมูลร้าน", icon: MemberIcon, require: { action: "view", resource: "member" } },
  { href: "/services", label: "บริการ", group: "ข้อมูลร้าน", icon: ServiceIcon, require: { action: "view", resource: "service" } },
  { href: "/packages", label: "คอร์ส/แพ็กเกจ", group: "ข้อมูลร้าน", icon: PackageIcon, require: { action: "view", resource: "package" } },
  { href: "/staff", label: "พนักงาน", group: "จัดการร้าน", icon: StaffIcon, require: { action: "view", resource: "staff" } },
];
