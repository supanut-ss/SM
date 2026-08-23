import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_PERMISSIONS } from "@lotus-desk/contracts";

const prisma = new PrismaClient();

// รหัสผ่าน/PIN สำหรับ dev เท่านั้น ห้ามใช้ค่านี้ใน production (ดู docs/PLAN.md T1.2)
const DEV_PASSWORD = "ChangeMe123!";
const DEV_PIN = "123456";

// seed ต้อง idempotent — รันซ้ำได้จากศูนย์เสมอ (ดู docs/PLAN.md เกณฑ์ผ่าน T0.3/T1.1)
async function main() {
  const branch = await prisma.branch.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { name: "สาขาหลัก", code: "MAIN" },
  });

  const device = await prisma.device.upsert({
    where: { branchId_label: { branchId: branch.id, label: "เครื่องหน้าร้าน 1" } },
    update: {},
    create: { branchId: branch.id, label: "เครื่องหน้าร้าน 1" },
  });

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const roleByKey = new Map<string, { id: string }>();
  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { key: roleDef.key },
      update: { name: roleDef.name },
      create: roleDef,
    });
    roleByKey.set(roleDef.key, role);
  }

  for (const roleDef of ROLE_DEFINITIONS) {
    const role = roleByKey.get(roleDef.key)!;
    const permissionKeys = ROLE_PERMISSIONS[roleDef.key];
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const passwordHash = await argon2.hash(DEV_PASSWORD);
  const pinHash = await argon2.hash(DEV_PIN);

  for (const roleDef of ROLE_DEFINITIONS) {
    const role = roleByKey.get(roleDef.key)!;
    const email = `${roleDef.key}@lotusdesk.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: roleDef.name, passwordHash, pinHash },
    });
    await prisma.userBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      update: { roleId: role.id },
      create: { userId: user.id, branchId: branch.id, roleId: role.id },
    });
  }

  const staffSeeds = [
    { name: "นก", level: "MASTER" as const, skills: ["THAI_MASSAGE", "OIL"] as const },
    { name: "แอน", level: "SENIOR" as const, skills: ["OIL", "FACIAL"] as const },
    { name: "ปุ๊ก", level: "JUNIOR" as const, skills: ["NAIL"] as const },
  ];
  const staffByName = new Map<string, { id: string }>();
  for (const staffSeed of staffSeeds) {
    const existing = await prisma.staffProfile.findFirst({
      where: { branchId: branch.id, name: staffSeed.name },
    });
    const staff =
      existing ??
      (await prisma.staffProfile.create({
        data: {
          branchId: branch.id,
          name: staffSeed.name,
          level: staffSeed.level,
          skills: [...staffSeed.skills],
        },
      }));
    staffByName.set(staffSeed.name, staff);
  }

  const roomTypeNames = ["ห้องนวดเดี่ยว", "ห้องนวดคู่", "ห้องสปา", "ห้องทำหน้า"];
  const roomTypeByName = new Map<string, { id: string }>();
  for (const name of roomTypeNames) {
    const roomType = await prisma.roomType.upsert({
      where: { branchId_name: { branchId: branch.id, name } },
      update: {},
      create: { branchId: branch.id, name },
    });
    roomTypeByName.set(name, roomType);
  }

  const roomSeeds = [
    { name: "ห้อง 1", roomType: "ห้องนวดเดี่ยว", capacity: 1 },
    { name: "ห้อง 2", roomType: "ห้องนวดเดี่ยว", capacity: 1 },
    { name: "ห้อง 3 (คู่)", roomType: "ห้องนวดคู่", capacity: 2 },
    { name: "ห้องสปา", roomType: "ห้องสปา", capacity: 1 },
  ];
  for (const roomSeed of roomSeeds) {
    const roomType = roomTypeByName.get(roomSeed.roomType)!;
    await prisma.room.upsert({
      where: { branchId_name: { branchId: branch.id, name: roomSeed.name } },
      update: {},
      create: {
        branchId: branch.id,
        name: roomSeed.name,
        roomTypeId: roomType.id,
        capacity: roomSeed.capacity,
      },
    });
  }

  const categorySeeds = ["นวด", "เสริมความงาม"];
  const categoryByName = new Map<string, { id: string }>();
  for (const [index, name] of categorySeeds.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { branchId_name: { branchId: branch.id, name } },
      update: {},
      create: { branchId: branch.id, name, sortOrder: index },
    });
    categoryByName.set(name, category);
  }

  // ค่ามือ/ราคาในนี้เป็นตัวเลขตัวอย่างสำหรับ dev เท่านั้น — ยังไม่ใช่เรตจริงของร้าน
  // (ดู docs/DOMAIN.md ข้อ 9: ต้องขอตัวเลขค่ามือจริงจากเจ้าของร้านก่อนเริ่ม T6.2)
  const serviceSeeds = [
    {
      category: "นวด",
      name: "นวดไทย",
      requiredSkill: "THAI_MASSAGE" as const,
      roomType: "ห้องนวดเดี่ยว",
      variants: [
        { durationMin: 60, priceSatang: 30000, commissionJunior: 15000, commissionSenior: 18000, commissionMaster: 21000 },
        { durationMin: 90, priceSatang: 45000, commissionJunior: 22000, commissionSenior: 26000, commissionMaster: 30000 },
        { durationMin: 120, priceSatang: 60000, commissionJunior: 29000, commissionSenior: 34000, commissionMaster: 39000 },
      ],
    },
    {
      category: "นวด",
      name: "นวดน้ำมัน",
      requiredSkill: "OIL" as const,
      roomType: "ห้องนวดเดี่ยว",
      variants: [
        { durationMin: 60, priceSatang: 35000, commissionJunior: 17000, commissionSenior: 20000, commissionMaster: 23000 },
        { durationMin: 90, priceSatang: 50000, commissionJunior: 24000, commissionSenior: 28000, commissionMaster: 32000 },
      ],
    },
    {
      category: "เสริมความงาม",
      name: "ทำหน้า",
      requiredSkill: "FACIAL" as const,
      roomType: "ห้องทำหน้า",
      variants: [
        { durationMin: 60, priceSatang: 40000, commissionJunior: 19000, commissionSenior: 22000, commissionMaster: 25000 },
      ],
    },
  ];
  let variantCount = 0;
  for (const serviceSeed of serviceSeeds) {
    const category = categoryByName.get(serviceSeed.category)!;
    const roomType = roomTypeByName.get(serviceSeed.roomType)!;
    const service = await prisma.service.upsert({
      where: { branchId_name: { branchId: branch.id, name: serviceSeed.name } },
      update: {},
      create: {
        branchId: branch.id,
        categoryId: category.id,
        name: serviceSeed.name,
      },
    });
    for (const variant of serviceSeed.variants) {
      await prisma.serviceVariant.upsert({
        where: {
          serviceId_durationMin: { serviceId: service.id, durationMin: variant.durationMin },
        },
        update: {},
        create: {
          serviceId: service.id,
          durationMin: variant.durationMin,
          priceSatang: variant.priceSatang,
          commissionJuniorSatang: variant.commissionJunior,
          commissionSeniorSatang: variant.commissionSenior,
          commissionMasterSatang: variant.commissionMaster,
          requiredSkill: serviceSeed.requiredSkill,
          requiredRoomTypeId: roomType.id,
        },
      });
      variantCount += 1;
    }
  }

  const shiftTemplateSeeds = [
    { name: "เช้า", startMin: 8 * 60, endMin: 16 * 60 },
    { name: "บ่าย", startMin: 14 * 60, endMin: 22 * 60 },
    { name: "เต็มวัน", startMin: 9 * 60, endMin: 18 * 60 },
  ];
  const shiftTemplateByName = new Map<string, { id: string; startMin: number; endMin: number }>();
  for (const shiftTemplateSeed of shiftTemplateSeeds) {
    const shiftTemplate = await prisma.shiftTemplate.upsert({
      where: { branchId_name: { branchId: branch.id, name: shiftTemplateSeed.name } },
      update: {},
      create: { branchId: branch.id, ...shiftTemplateSeed },
    });
    shiftTemplateByName.set(shiftTemplateSeed.name, shiftTemplate);
  }

  // จันทร์ของสัปดาห์ปัจจุบัน — แค่ตัวอย่างข้อมูลให้เปิดปฏิทินกะแล้วเห็นอะไรทันที ไม่ใช่ business logic
  // (ห้าม Date.now() เฉพาะใน packages/core ตาม CLAUDE.md ข้อ 1 — seed script ไม่ติดกฎนี้)
  const today = new Date();
  const monday = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = จันทร์
  monday.setDate(today.getDate() - dayOfWeek);
  monday.setHours(0, 0, 0, 0);
  function dateOffset(days: number): Date {
    const d = new Date(monday);
    d.setDate(monday.getDate() + days);
    return d;
  }

  const staffShiftSeeds: Array<{ staffName: string; templateName: string; dayOffset: number }> = [
    { staffName: "นก", templateName: "เช้า", dayOffset: 0 },
    { staffName: "นก", templateName: "เช้า", dayOffset: 1 },
    { staffName: "นก", templateName: "เช้า", dayOffset: 2 },
    { staffName: "แอน", templateName: "บ่าย", dayOffset: 1 },
    { staffName: "แอน", templateName: "บ่าย", dayOffset: 2 },
    { staffName: "แอน", templateName: "บ่าย", dayOffset: 3 },
    { staffName: "ปุ๊ก", templateName: "เต็มวัน", dayOffset: 0 },
    { staffName: "ปุ๊ก", templateName: "เต็มวัน", dayOffset: 2 },
    { staffName: "ปุ๊ก", templateName: "เต็มวัน", dayOffset: 4 },
  ];
  let staffShiftCount = 0;
  for (const seed of staffShiftSeeds) {
    const staff = staffByName.get(seed.staffName)!;
    const template = shiftTemplateByName.get(seed.templateName)!;
    const date = dateOffset(seed.dayOffset);
    const existing = await prisma.staffShift.findFirst({
      where: { staffId: staff.id, date, shiftTemplateId: template.id },
    });
    if (!existing) {
      await prisma.staffShift.create({
        data: {
          branchId: branch.id,
          staffId: staff.id,
          shiftTemplateId: template.id,
          date,
          startMin: template.startMin,
          endMin: template.endMin,
        },
      });
    }
    staffShiftCount += 1;
  }

  const staffLeaveSeeds: Array<{ staffName: string; dayOffset: number; type: "SICK" }> = [
    { staffName: "แอน", dayOffset: 4, type: "SICK" },
  ];
  for (const seed of staffLeaveSeeds) {
    const staff = staffByName.get(seed.staffName)!;
    const date = dateOffset(seed.dayOffset);
    await prisma.staffLeave.upsert({
      where: { staffId_date: { staffId: staff.id, date } },
      update: {},
      create: { branchId: branch.id, staffId: staff.id, date, type: seed.type, note: "ลาป่วย (ตัวอย่าง)" },
    });
  }

  console.log(`seed: ready — branch ${branch.name} (${branch.code})`);
  console.log(`seed: device "${device.label}" (${device.id})`);
  console.log(`seed: 4 roles × ${PERMISSIONS.length} permissions`);
  console.log(`seed: ${staffSeeds.length} staff profiles`);
  console.log(`seed: ${roomTypeNames.length} room types, ${roomSeeds.length} rooms`);
  console.log(
    `seed: ${categorySeeds.length} service categories, ${serviceSeeds.length} services, ${variantCount} service variants`,
  );
  console.log(
    `seed: ${shiftTemplateSeeds.length} shift templates, ${staffShiftCount} staff shifts, ${staffLeaveSeeds.length} staff leaves`,
  );
  console.log(
    `seed: dev users — {role}@lotusdesk.local / password "${DEV_PASSWORD}" / PIN "${DEV_PIN}" (dev เท่านั้น)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
