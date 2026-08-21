import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/staff/test/staff.e2e-spec.ts (T2.1)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T2.2 (CRUD ทำงาน) รวม branch scoping (T1.4) ของทั้ง Room และ RoomType,
 * และ validation ที่พัง (ความจุ 0, ไม่เลือกประเภทห้อง, เลือกประเภทห้องข้ามสาขา)
 */
describe("Rooms (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "ROOM-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "ROOM-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const roomTypeA = await prisma.roomType.create({
      data: { branchId: branchAId, name: "ห้องนวดเดี่ยว" },
    });
    const roomTypeB = await prisma.roomType.create({
      data: { branchId: branchBId, name: "ห้องนวดเดี่ยว" },
    });
    roomTypeAId = roomTypeA.id;
    roomTypeBId = roomTypeB.id;

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

    const managerEmail = "manager-room-a@lotusdesk.local";
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

  it("lists room types scoped to the manager's own branch", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/room-types`)
      .set("Cookie", managerACookies);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: roomTypeAId, name: "ห้องนวดเดี่ยว" })]);
  });

  it("creates a room with a valid room type under the manager's own branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้อง 1", roomTypeId: roomTypeAId, capacity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("ห้อง 1");
    expect(res.body.capacity).toBe(2);
    expect(res.body.isActive).toBe(true);
    expect(res.body.branchId).toBe(branchAId);
    expect(res.body.roomType.id).toBe(roomTypeAId);
  });

  it("rejects creation with capacity 0 (validation)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องพัง", roomTypeId: roomTypeAId, capacity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "capacity" })]),
    );
  });

  it("rejects creation with a missing roomTypeId (validation)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องไม่มีประเภท", capacity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "roomTypeId" })]),
    );
  });

  it("rejects creation using a room type that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องข้ามสาขา", roomTypeId: roomTypeBId, capacity: 1 });

    expect(res.status).toBe(404);
  });

  it("lists only active rooms by default, sorted by name, and supports search by name", async () => {
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องสปา", roomTypeId: roomTypeAId, capacity: 1 });

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies);

    expect(list.status).toBe(200);
    const names = (list.body as Array<{ name: string }>).map((r) => r.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("ห้อง 1");
    expect(names).toContain("ห้องสปา");

    const search = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/rooms?q=${encodeURIComponent("สปา")}`)
      .set("Cookie", managerACookies);
    expect(search.body).toHaveLength(1);
    expect(search.body[0].name).toBe("ห้องสปา");
  });

  it("updates a room's fields (edit)", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องแก้ไข", roomTypeId: roomTypeAId, capacity: 1 });
    const roomId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/rooms/${roomId}`)
      .set("Cookie", managerACookies)
      .send({ capacity: 4 });

    expect(updated.status).toBe(200);
    expect(updated.body.capacity).toBe(4);
  });

  it("deactivates a room and hides it from the default (active-only) list", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ห้องปิดใช้งาน", roomTypeId: roomTypeAId, capacity: 1 });
    const roomId = created.body.id as string;

    const deactivated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/rooms/${roomId}`)
      .set("Cookie", managerACookies)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);

    const defaultList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/rooms`)
      .set("Cookie", managerACookies);
    expect((defaultList.body as Array<{ id: string }>).map((r) => r.id)).not.toContain(roomId);

    const allList = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/rooms?isActive=all`)
      .set("Cookie", managerACookies);
    expect((allList.body as Array<{ id: string }>).map((r) => r.id)).toContain(roomId);
  });

  it("rejects the manager of branch A from listing/creating rooms and room types of branch B with 403", async () => {
    const listRooms = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/rooms`)
      .set("Cookie", managerACookies);
    expect(listRooms.status).toBe(403);

    const listRoomTypes = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/room-types`)
      .set("Cookie", managerACookies);
    expect(listRoomTypes.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/rooms`)
      .set("Cookie", managerACookies)
      .send({ name: "ไม่ควรสร้างได้", roomTypeId: roomTypeBId, capacity: 1 });
    expect(create.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/rooms`);
    expect(res.status).toBe(401);
  });
});
