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
  for (const staffSeed of staffSeeds) {
    const existing = await prisma.staffProfile.findFirst({
      where: { branchId: branch.id, name: staffSeed.name },
    });
    if (!existing) {
      await prisma.staffProfile.create({
        data: {
          branchId: branch.id,
          name: staffSeed.name,
          level: staffSeed.level,
          skills: [...staffSeed.skills],
        },
      });
    }
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

  console.log(`seed: ready — branch ${branch.name} (${branch.code})`);
  console.log(`seed: device "${device.label}" (${device.id})`);
  console.log(`seed: 4 roles × ${PERMISSIONS.length} permissions`);
  console.log(`seed: ${staffSeeds.length} staff profiles`);
  console.log(`seed: ${roomTypeNames.length} room types, ${roomSeeds.length} rooms`);
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
