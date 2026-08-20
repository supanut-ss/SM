// Catalog ของสิทธิ์ที่ใช้ร่วมกันระหว่าง packages/db (seed) และ apps/api (CASL ability ใน T1.4)
// ห้ามแก้ "key" ของ permission/role ที่มีอยู่แล้วหลัง seed ขึ้น production — จะทำให้ role เดิมเสียสิทธิ์เงียบ ๆ
// เพิ่ม resource/permission ใหม่ได้เสมอเมื่อ Task ที่เกี่ยวข้องต้องการ

export const PERMISSION_RESOURCES = [
  "branch",
  "staff",
  "service",
  "room",
  "member",
  "booking",
  "package",
  "promotion",
  "billing",
  "attendance",
  "payroll",
  "report",
  "inventory",
  "settings",
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];
export type PermissionAction = "view" | "manage";
export type PermissionKey = `${PermissionResource}:${PermissionAction}` | "audit:view";

export interface PermissionDefinition {
  key: PermissionKey;
  description: string;
}

const RESOURCE_LABEL: Record<PermissionResource, string> = {
  branch: "สาขา",
  staff: "พนักงาน",
  service: "บริการ",
  room: "ห้อง/เตียง",
  member: "สมาชิก",
  booking: "การจอง/คิว",
  package: "คอร์ส/แพ็กเกจ",
  promotion: "โปรโมชั่น",
  billing: "บิล/การชำระเงิน",
  attendance: "ลงเวลาทำงาน",
  payroll: "ค่ามือ/งวดจ่าย",
  report: "รายงาน",
  inventory: "คลังสินค้า",
  settings: "ตั้งค่าระบบ",
};

export const PERMISSIONS: PermissionDefinition[] = [
  ...PERMISSION_RESOURCES.flatMap((resource): PermissionDefinition[] => [
    { key: `${resource}:view`, description: `ดูข้อมูล${RESOURCE_LABEL[resource]}` },
    { key: `${resource}:manage`, description: `จัดการ${RESOURCE_LABEL[resource]} (สร้าง/แก้ไข/ลบ)` },
  ]),
  { key: "audit:view", description: "ดูประวัติการแก้ไข (audit log)" },
];

export const ROLE_DEFINITIONS = [
  { key: "owner", name: "เจ้าของร้าน" },
  { key: "manager", name: "ผู้จัดการ" },
  { key: "cashier", name: "แคชเชียร์" },
  { key: "staff", name: "พนักงานบริการ" },
] as const;

export type RoleKey = (typeof ROLE_DEFINITIONS)[number]["key"];

const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// ทุกสิทธิ์ ยกเว้น settings:manage (ตั้งค่าระบบทั้งร้านให้เจ้าของเท่านั้น)
// settings:view ยังอยู่ในนี้อยู่แล้วเพราะ filter คัดออกแค่ "settings:manage" ตัวเดียว — ห้าม concat ซ้ำ
const MANAGE_ALL_EXCEPT_SETTINGS: PermissionKey[] = ALL_PERMISSION_KEYS.filter(
  (key) => key !== "settings:manage",
);

const CASHIER_PERMISSIONS: PermissionKey[] = [
  "branch:view",
  "staff:view",
  "service:view",
  "room:view",
  "inventory:view",
  "member:manage",
  "booking:manage",
  "package:manage",
  "promotion:manage",
  "billing:manage",
  "report:view",
];

const STAFF_PERMISSIONS: PermissionKey[] = [
  "booking:view",
  "service:view",
  "room:view",
  "attendance:manage",
  "payroll:view",
];

/** สิทธิ์เริ่มต้นของแต่ละบทบาท — ใช้ตอน seed (packages/db/prisma/seed.ts) */
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  owner: ALL_PERMISSION_KEYS,
  manager: MANAGE_ALL_EXCEPT_SETTINGS,
  cashier: CASHIER_PERMISSIONS,
  staff: STAFF_PERMISSIONS,
};
