import type { ComponentType, SVGProps } from "react";
import type { PermissionAction, PermissionResource } from "@lotus-desk/contracts";
import {
  BillingIcon,
  BoardIcon,
  ClockIcon,
  DashboardIcon,
  InventoryIcon,
  MemberIcon,
  PackageIcon,
  PayrollIcon,
  PromotionIcon,
  ReportIcon,
  RoomIcon,
  ServiceIcon,
  SettingsIcon,
  StaffIcon,
} from "./nav-icons";

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
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "แดชบอร์ด", group: "ปฏิบัติการ", icon: DashboardIcon },
  { href: "/board", label: "กระดานคิว", group: "ปฏิบัติการ", icon: BoardIcon, require: { action: "view", resource: "booking" } },
  { href: "/billing", label: "บิล/แคชเชียร์", group: "ปฏิบัติการ", icon: BillingIcon, require: { action: "view", resource: "billing" } },
  { href: "/attendance", label: "ลงเวลาเข้า-ออกงาน", group: "ปฏิบัติการ", icon: ClockIcon, require: { action: "view", resource: "attendance" } },
  { href: "/members", label: "สมาชิก", group: "ข้อมูลร้าน", icon: MemberIcon, require: { action: "view", resource: "member" } },
  { href: "/services", label: "บริการ", group: "ข้อมูลร้าน", icon: ServiceIcon, require: { action: "view", resource: "service" } },
  { href: "/packages", label: "คอร์ส/แพ็กเกจ", group: "ข้อมูลร้าน", icon: PackageIcon, require: { action: "view", resource: "package" } },
  { href: "/promotions", label: "โปรโมชั่น", group: "ข้อมูลร้าน", icon: PromotionIcon, require: { action: "view", resource: "promotion" } },
  { href: "/rooms", label: "ห้อง/เตียง", group: "ข้อมูลร้าน", icon: RoomIcon, require: { action: "view", resource: "room" } },
  { href: "/inventory", label: "คลัง", group: "ข้อมูลร้าน", icon: InventoryIcon, require: { action: "view", resource: "inventory" } },
  { href: "/staff", label: "พนักงาน", group: "จัดการร้าน", icon: StaffIcon, require: { action: "view", resource: "staff" } },
  { href: "/payroll", label: "ค่ามือ", group: "จัดการร้าน", icon: PayrollIcon, require: { action: "view", resource: "payroll" } },
  { href: "/reports", label: "รายงาน", group: "จัดการร้าน", icon: ReportIcon, require: { action: "view", resource: "report" } },
  { href: "/settings", label: "ตั้งค่า", group: "จัดการร้าน", icon: SettingsIcon, require: { action: "view", resource: "settings" } },
];
