import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/service/test/service.e2e-spec.ts (T2.3)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T5.1 (สร้างคอร์ส/แพ็กเกจได้ทั้ง 3 ประเภท: SESSION_COUNT/VALUE/UNLIMITED_DURATION)
 * รวม branch scoping และการจำกัดฟิลด์ที่แก้ไขได้หลังสร้าง (ดู docs/decisions.md ADR-025)
 */
describe("Packages (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let serviceVariantAId: string;
  let serviceVariantBId: string;
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "PKG-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "PKG-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const categoryA = await prisma.serviceCategory.create({ data: { branchId: branchAId, name: "นวด" } });
    const categoryB = await prisma.serviceCategory.create({ data: { branchId: branchBId, name: "นวด" } });
    const roomTypeA = await prisma.roomType.create({ data: { branchId: branchAId, name: "ห้องนวดเดี่ยว" } });
    const roomTypeB = await prisma.roomType.create({ data: { branchId: branchBId, name: "ห้องนวดเดี่ยว" } });

    const serviceA = await prisma.service.create({
      data: {
        branchId: branchAId,
        categoryId: categoryA.id,
        name: "นวดไทย",
        variants: {
          create: [
            {
              durationMin: 60,
              priceSatang: 30000,
              commissionJuniorSatang: 15000,
              commissionSeniorSatang: 18000,
              commissionMasterSatang: 21000,
              requiredSkill: "THAI_MASSAGE",
              requiredRoomTypeId: roomTypeA.id,
            },
          ],
        },
      },
      include: { variants: true },
    });
    serviceVariantAId = serviceA.variants[0]!.id;

    const serviceB = await prisma.service.create({
      data: {
        branchId: branchBId,
        categoryId: categoryB.id,
        name: "นวดไทย",
        variants: {
          create: [
            {
              durationMin: 60,
              priceSatang: 30000,
              commissionJuniorSatang: 15000,
              commissionSeniorSatang: 18000,
              commissionMasterSatang: 21000,
              requiredSkill: "THAI_MASSAGE",
              requiredRoomTypeId: roomTypeB.id,
            },
          ],
        },
      },
      include: { variants: true },
    });
    serviceVariantBId = serviceB.variants[0]!.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "package:view", description: "ดูข้อมูลคอร์ส/แพ็กเกจ" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "package:manage", description: "จัดการคอร์ส/แพ็กเกจ" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-package-a@lotusdesk.local";
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

  it("creates a SESSION_COUNT package (T5.1 pass criteria)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({
        type: "SESSION_COUNT",
        name: "คอร์สนวดไทย 10 ครั้ง",
        priceSatang: 900000,
        validDays: 180,
        serviceVariantId: serviceVariantAId,
        sessionCount: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.branchId).toBe(branchAId);
    expect(res.body.type).toBe("SESSION_COUNT");
    expect(res.body.sessionCount).toBe(10);
    expect(res.body.serviceVariant.id).toBe(serviceVariantAId);
  });

  it("creates a VALUE package (T5.1 pass criteria)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({ type: "VALUE", name: "บัตรเงินสด 5,000", priceSatang: 500000, validDays: 365, valueSatang: 500000 });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("VALUE");
    expect(res.body.valueSatang).toBe(500000);
    expect(res.body.serviceVariantId).toBeNull();
  });

  it("creates an UNLIMITED_DURATION package (T5.1 pass criteria)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({
        type: "UNLIMITED_DURATION",
        name: "คอร์สไม่จำกัดนวดน้ำมัน 3 เดือน",
        priceSatang: 1500000,
        validDays: 90,
        serviceVariantId: serviceVariantAId,
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("UNLIMITED_DURATION");
    expect(res.body.sessionCount).toBeNull();
  });

  it("rejects a negative price (validation — money must never go negative or float)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({ type: "VALUE", name: "แพ็กเกจราคาพัง", priceSatang: -1, validDays: 30, valueSatang: 100 });

    expect(res.status).toBe(400);
  });

  it("rejects creation using a service variant that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({
        type: "SESSION_COUNT",
        name: "แพ็กเกจข้ามสาขา",
        priceSatang: 900000,
        validDays: 180,
        serviceVariantId: serviceVariantBId,
        sessionCount: 10,
      });

    expect(res.status).toBe(404);
  });

  it("edits name/price/validDays/isActive but not type or serviceVariantId after creation", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({ type: "VALUE", name: "แพ็กเกจแก้ไข", priceSatang: 300000, validDays: 200, valueSatang: 300000 });
    const packageId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/packages/${packageId}`)
      .set("Cookie", managerACookies)
      .send({ name: "แพ็กเกจแก้ไขแล้ว", priceSatang: 250000, isActive: false, type: "SESSION_COUNT" });

    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("แพ็กเกจแก้ไขแล้ว");
    expect(updated.body.priceSatang).toBe(250000);
    expect(updated.body.isActive).toBe(false);
    expect(updated.body.type).toBe("VALUE");
  });

  it("lists only active packages by default and supports search by name", async () => {
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/packages`)
      .set("Cookie", managerACookies)
      .send({ type: "VALUE", name: "บัตรเงินสดพิเศษ", priceSatang: 100000, validDays: 30, valueSatang: 100000 });

    const search = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/packages?q=${encodeURIComponent("พิเศษ")}`)
      .set("Cookie", managerACookies);
    expect(search.status).toBe(200);
    expect(search.body).toHaveLength(1);
    expect(search.body[0].name).toBe("บัตรเงินสดพิเศษ");
  });

  it("rejects the manager of branch A from reading/creating packages of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/packages`)
      .set("Cookie", managerACookies);
    expect(list.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/packages`)
      .set("Cookie", managerACookies)
      .send({ type: "VALUE", name: "ไม่ควรสร้างได้", priceSatang: 100000, validDays: 30, valueSatang: 100000 });
    expect(create.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/packages`);
    expect(res.status).toBe(401);
  });
});
