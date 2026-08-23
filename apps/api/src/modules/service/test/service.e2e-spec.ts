import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/room/test/room.e2e-spec.ts (T2.2)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T2.3 (สร้างบริการที่มี 3 ตัวเลือกเวลาได้) รวม branch scoping ของ Service/ServiceCategory
 * และของ ServiceVariant ที่ไม่มี branchId ตรง ๆ (ต้องเช็คผ่าน Service เจ้าของ), validation เงินที่ติดลบ/ไม่ใช่จำนวนเต็ม
 */
describe("Services (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let categoryAId: string;
  let categoryBId: string;
  let roomTypeAId: string;
  let roomTypeBId: string;
  let managerACookies: string[];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    process.env.DATABASE_URL = databaseUrl;
    // ดู docs/decisions.md ADR-009 — ต้องตั้ง APP_DATABASE_URL ด้วยเสมอ ไม่งั้นถ้าเครื่อง dev มี .env
    // จริงที่ตั้งค่านี้ไว้แล้ว มันจะ "ชนะ" DATABASE_URL ของ container ทดสอบนี้เงียบ ๆ
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "SVC-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "SVC-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const categoryA = await prisma.serviceCategory.create({
      data: { branchId: branchAId, name: "นวด" },
    });
    const categoryB = await prisma.serviceCategory.create({
      data: { branchId: branchBId, name: "นวด" },
    });
    categoryAId = categoryA.id;
    categoryBId = categoryB.id;

    const roomTypeA = await prisma.roomType.create({
      data: { branchId: branchAId, name: "ห้องนวดเดี่ยว" },
    });
    const roomTypeB = await prisma.roomType.create({
      data: { branchId: branchBId, name: "ห้องนวดเดี่ยว" },
    });
    roomTypeAId = roomTypeA.id;
    roomTypeBId = roomTypeB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "service:view", description: "ดูข้อมูลบริการ" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "service:manage", description: "จัดการบริการ" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-service-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    // manager สังกัดแค่สาขา A เท่านั้น — ไม่มี UserBranch ที่สาขา B เลย (ทดสอบ branch scoping)
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

  const variant = (durationMin: number) => ({
    durationMin,
    priceSatang: 30000 + durationMin * 100,
    commissionJuniorSatang: 15000,
    commissionSeniorSatang: 18000,
    commissionMasterSatang: 21000,
    requiredSkill: "THAI_MASSAGE",
    requiredRoomTypeId: roomTypeAId,
  });

  it("lists service categories scoped to the manager's own branch", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/service-categories`)
      .set("Cookie", managerACookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: categoryAId, name: "นวด" })]);
  });

  it("creates a service with 3 duration variants (T2.3 pass criteria)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({
        categoryId: categoryAId,
        name: "นวดไทย",
        variants: [variant(60), variant(90), variant(120)],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("นวดไทย");
    expect(res.body.branchId).toBe(branchAId);
    expect(res.body.variants).toHaveLength(3);
    expect((res.body.variants as Array<{ durationMin: number }>).map((v) => v.durationMin).sort()).toEqual([
      60, 90, 120,
    ]);
  });

  it("rejects a negative price (validation — money must never go negative or float)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({
        categoryId: categoryAId,
        name: "บริการราคาพัง",
        variants: [{ ...variant(60), priceSatang: -1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "variants.0.priceSatang" })]),
    );
  });

  it("rejects creation with zero variants (validation)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryAId, name: "บริการไม่มีตัวเลือกเวลา", variants: [] });

    expect(res.status).toBe(400);
  });

  it("rejects creation using a category that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryBId, name: "บริการข้ามสาขา", variants: [variant(60)] });

    expect(res.status).toBe(404);
  });

  it("rejects creation using a room type that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({
        categoryId: categoryAId,
        name: "บริการห้องข้ามสาขา",
        variants: [{ ...variant(60), requiredRoomTypeId: roomTypeBId }],
      });

    expect(res.status).toBe(404);
  });

  it("edits a service's own fields without touching its variants (edit)", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryAId, name: "บริการแก้ไข", variants: [variant(60)] });
    const serviceId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/services/${serviceId}`)
      .set("Cookie", managerACookies)
      .send({ description: "อัปเดตคำอธิบายแล้ว" });

    expect(updated.status).toBe(200);
    expect(updated.body.description).toBe("อัปเดตคำอธิบายแล้ว");
    expect(updated.body.variants).toHaveLength(1);
  });

  it("adds a new duration variant to an existing service", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryAId, name: "บริการเพิ่มตัวเลือกเวลา", variants: [variant(60)] });
    const serviceId = created.body.id as string;

    const added = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services/${serviceId}/variants`)
      .set("Cookie", managerACookies)
      .send(variant(90));

    expect(added.status).toBe(201);
    expect(added.body.durationMin).toBe(90);
    expect(added.body.serviceId).toBe(serviceId);
  });

  it("edits a variant's price and commission without changing an old price retroactively elsewhere", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryAId, name: "บริการแก้ราคา", variants: [variant(60)] });
    const serviceId = created.body.id as string;
    const variantId = created.body.variants[0].id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/services/${serviceId}/variants/${variantId}`)
      .set("Cookie", managerACookies)
      .send({ priceSatang: 99900 });

    expect(updated.status).toBe(200);
    expect(updated.body.priceSatang).toBe(99900);
  });

  it("deactivates a single variant while leaving the service and other variants active", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({
        categoryId: categoryAId,
        name: "บริการปิดตัวเลือกเวลาเดียว",
        variants: [variant(60), variant(90)],
      });
    const serviceId = created.body.id as string;
    const variants = created.body.variants as Array<{ id: string; durationMin: number }>;
    const variant60Id = variants.find((v) => v.durationMin === 60)!.id;

    const deactivated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/services/${serviceId}/variants/${variant60Id}`)
      .set("Cookie", managerACookies)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    const service = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/services/${serviceId}`)
      .set("Cookie", managerACookies);
    expect(service.body.isActive).toBe(true);
    const variant90 = (service.body.variants as Array<{ durationMin: number; isActive: boolean }>).find(
      (v) => v.durationMin === 90,
    )!;
    expect(variant90.isActive).toBe(true);
  });

  it("lists only active services by default and supports search by name", async () => {
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryAId, name: "นวดน้ำมันหอมระเหย", variants: [variant(60)] });

    const search = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/services?q=${encodeURIComponent("น้ำมันหอม")}`)
      .set("Cookie", managerACookies);
    expect(search.status).toBe(200);
    expect(search.body).toHaveLength(1);
    expect(search.body[0].name).toBe("นวดน้ำมันหอมระเหย");
  });

  it("rejects the manager of branch A from reading/creating services and service-categories of branch B with 403", async () => {
    const listServices = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/services`)
      .set("Cookie", managerACookies);
    expect(listServices.status).toBe(403);

    const listCategories = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/service-categories`)
      .set("Cookie", managerACookies);
    expect(listCategories.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/services`)
      .set("Cookie", managerACookies)
      .send({ categoryId: categoryBId, name: "ไม่ควรสร้างได้", variants: [variant(60)] });
    expect(create.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/services`);
    expect(res.status).toBe(401);
  });
});
