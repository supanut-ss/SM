import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 *
 * ครอบเกณฑ์ผ่านของ create/update/delete RoomType (ดู docs/decisions.md ADR-062 ที่พลิกกลับ ADR-010
 * บางส่วน — เพิ่มหน้าจัดการที่เดิมตั้งใจไม่ทำ): สร้าง/แก้ไข/ลบได้, ชื่อซ้ำในสาขาเดียวกันได้ 409, แก้/ลบข้าม
 * สาขาได้ 404, ลบประเภทห้องที่มีห้อง/บริการอ้างอิงอยู่ไม่ได้ (409)
 */
describe("RoomType CRUD (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let managerACookies: string[];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    process.env.DATABASE_URL = databaseUrl;
    process.env.APP_DATABASE_URL = databaseUrl;
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.SMTP_HOST ??= "localhost";
    process.env.SMTP_PORT ??= "1025";
    process.env.JWT_ACCESS_SECRET ??= "e2e-test-access-secret-at-least-32-chars";
    process.env.JWT_REFRESH_SECRET ??= "e2e-test-refresh-secret-at-least-32-chars";
    process.env.NODE_ENV = "test";

    execSync("npx prisma migrate deploy", {
      cwd: "../../packages/db",
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });

    const db = await import("@lotus-desk/db");
    const prisma = db.prisma;
    const argon2 = await import("argon2");

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "ROOMTYPE-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "ROOMTYPE-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "room:view", description: "ดูข้อมูลห้อง" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "room:manage", description: "จัดการห้อง" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-roomtype-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    await prisma.userBranch.create({
      data: { userId: manager.id, branchId: branchAId, roleId: managerRole.id },
    });
    await prisma.userBranch.create({
      data: { userId: manager.id, branchId: branchBId, roleId: managerRole.id },
    });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: managerEmail, password: managerPassword });
    managerACookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  let createdId: string;

  it("สร้างประเภทห้องใหม่สำเร็จ", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/room-types`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องนวดน้ำมัน" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("ห้องนวดน้ำมัน");
    createdId = res.body.id;
  });

  it("สร้างชื่อซ้ำในสาขาเดียวกัน ต้องได้ 409", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/room-types`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องนวดน้ำมัน" });
    expect(res.status).toBe(409);
  });

  it("แก้ชื่อประเภทห้องสำเร็จ", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/room-types/${createdId}`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องนวดน้ำมันหอมระเหย" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("ห้องนวดน้ำมันหอมระเหย");

    const db = await import("@lotus-desk/db");
    const audit = await db.prisma.auditLog.findFirst({
      where: { entity: "RoomType", entityId: createdId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.before as { name?: string } | null)?.name).toBe("ห้องนวดน้ำมัน");
    expect((audit?.after as { name?: string } | null)?.name).toBe("ห้องนวดน้ำมันหอมระเหย");
  });

  it("แก้/ลบประเภทห้องข้ามสาขา ต้องได้ 404", async () => {
    const editRes = await request(app.getHttpServer())
      .patch(`/branches/${branchBId}/room-types/${createdId}`)
      .set("Cookie", managerACookies)
      .send({ name: "ไม่ควรแก้ได้" });
    expect(editRes.status).toBe(404);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/branches/${branchBId}/room-types/${createdId}`)
      .set("Cookie", managerACookies);
    expect(deleteRes.status).toBe(404);
  });

  it("ลบประเภทห้องที่มีห้องอ้างอิงอยู่ ต้องได้ 409", async () => {
    const db = await import("@lotus-desk/db");
    await db.prisma.room.create({
      data: { branchId: branchAId, roomTypeId: createdId, name: "ห้อง A1" },
    });

    const res = await request(app.getHttpServer())
      .delete(`/branches/${branchAId}/room-types/${createdId}`)
      .set("Cookie", managerACookies);
    expect(res.status).toBe(409);
  });

  it("ลบประเภทห้องที่มีบริการอ้างอิงอยู่ ต้องได้ 409", async () => {
    const db = await import("@lotus-desk/db");
    const roomType = await db.prisma.roomType.create({
      data: { branchId: branchAId, name: "ห้องสำหรับบริการ" },
    });
    const category = await db.prisma.serviceCategory.create({
      data: { branchId: branchAId, name: "หมวดทดสอบประเภทห้อง" },
    });
    const service = await db.prisma.service.create({
      data: { branchId: branchAId, categoryId: category.id, name: "บริการทดสอบประเภทห้อง" },
    });
    await db.prisma.serviceVariant.create({
      data: {
        serviceId: service.id,
        durationMin: 60,
        priceSatang: 10000,
        commissionJuniorSatang: 1000,
        commissionSeniorSatang: 1000,
        commissionMasterSatang: 1000,
        requiredSkill: "THAI_MASSAGE",
        requiredRoomTypeId: roomType.id,
      },
    });

    const res = await request(app.getHttpServer())
      .delete(`/branches/${branchAId}/room-types/${roomType.id}`)
      .set("Cookie", managerACookies);
    expect(res.status).toBe(409);
  });

  it("ลบประเภทห้องที่ไม่มีอะไรอ้างอิงสำเร็จ", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/room-types`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องทดลองลบ" });
    const freshId = res.body.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/branches/${branchAId}/room-types/${freshId}`)
      .set("Cookie", managerACookies);
    expect(deleteRes.status).toBe(200);

    const db = await import("@lotus-desk/db");
    const audit = await db.prisma.auditLog.findFirst({
      where: { entity: "RoomType", entityId: freshId, action: "DELETE" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.before as { name?: string } | null)?.name).toBe("ห้องทดลองลบ");

    const listRes = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/room-types`)
      .set("Cookie", managerACookies);
    expect(listRes.body.some((rt: { id: string }) => rt.id === freshId)).toBe(false);
  });
});
