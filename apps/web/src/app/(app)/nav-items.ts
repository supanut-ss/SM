import type { PermissionAction, PermissionResource } from "@lotus-desk/contracts";

export interface NavItem {
  href: string;
  label: string;
  /** ไม่ระบุ = แสดงเสมอ (เช่นแดชบอร์ด) ไม่ต้องเช็คสิทธิ์ */
  require?: { action: PermissionAction; resource: PermissionResource };
}

// จับคู่เมนูกับสิทธิ์ที่ต้องมี — คนละบทบาทเห็นเมนูไม่เท่ากันเพราะรายการนี้ (ดู T1.6 เกณฑ์ผ่าน
// "เห็นเมนูตามบทบาท") ปรับ path ให้ตรงกับหน้าจริงเมื่อ Task ที่สร้างหน้านั้นเสร็จ (T2.x–T8.x)
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "แดชบอร์ด" },
  { href: "/board", label: "กระดานคิว", require: { action: "view", resource: "booking" } },
  { href: "/members", label: "สมาชิก", require: { action: "view", resource: "member" } },
  { href: "/services", label: "บริการ", require: { action: "view", resource: "service" } },
  { href: "/packages", label: "คอร์ส/แพ็กเกจ", require: { action: "view", resource: "package" } },
  { href: "/promotions", label: "โปรโมชั่น", require: { action: "view", resource: "promotion" } },
  { href: "/staff", label: "พนักงาน", require: { action: "view", resource: "staff" } },
  { href: "/payroll", label: "ค่ามือ", require: { action: "view", resource: "payroll" } },
  { href: "/reports", label: "รายงาน", require: { action: "view", resource: "report" } },
  { href: "/inventory", label: "คลัง", require: { action: "view", resource: "inventory" } },
  { href: "/settings", label: "ตั้งค่า", require: { action: "view", resource: "settings" } },
];
