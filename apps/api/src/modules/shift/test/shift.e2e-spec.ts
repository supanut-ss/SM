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
 * ครอบเกณฑ์ผ่านหลักของ T2.4: "กะซ้อนกันต้องถูกปฏิเสธ" รวม branch scoping ของทั้ง 3 resource,
 * validation ของแม่แบบกะ (endMin <= startMin), และวันลาแบบช่วงวันที่ (ขยายเป็นหลายแถว)
 */
describe("Shifts (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let staffAId: string;
  let staffBId: string;
  let morningTemplateId: string;
  let afternoonTemplateId: string;
  let templateBId: string;
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "SHIFT-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "SHIFT-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const staffA = await prisma.staffProfile.create({
      data: { branchId: branchAId, name: "นก", level: "MASTER", skills: [] },
    });
    const staffB = await prisma.staffProfile.create({
      data: { branchId: branchBId, name: "แอน", level: "SENIOR", skills: [] },
    });
    staffAId = staffA.id;
    staffBId = staffB.id;

    const morning = await prisma.shiftTemplate.create({
      data: { branchId: branchAId, name: "เช้า", startMin: 8 * 60, endMin: 16 * 60 },
    });
    const afternoon = await prisma.shiftTemplate.create({
      data: { branchId: branchAId, name: "บ่าย", startMin: 14 * 60, endMin: 22 * 60 },
    });
    const templateB = await prisma.shiftTemplate.create({
      data: { branchId: branchBId, name: "เช้า", startMin: 8 * 60, endMin: 16 * 60 },
    });
    morningTemplateId = morning.id;
    afternoonTemplateId = afternoon.id;
    templateBId = templateB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "staff:view", description: "ดูข้อมูลพนักงาน" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "staff:manage", description: "จัดการพนักงาน" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-shift-a@lotusdesk.local";
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

  it("lists shift templates scoped to the manager's own branch", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/shift-templates`)
      .set("Cookie", managerACookies);

    expect(res.status).toBe(200);
    const names = (res.body as Array<{ name: string }>).map((t) => t.name);
    expect(names.sort()).toEqual(["บ่าย", "เช้า"]);
  });

  it("rejects a shift template where endMin is not after startMin", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/shift-templates`)
      .set("Cookie", managerACookies)
      .send({ name: "ดึก", startMin: 1320, endMin: 120 });

    expect(res.status).toBe(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "endMin" })]),
    );
  });

  it("assigns a shift to a staff member for a given date", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, shiftTemplateId: morningTemplateId, date: "2026-09-07" });

    expect(res.status).toBe(201);
    expect(res.body.startMin).toBe(8 * 60);
    expect(res.body.endMin).toBe(16 * 60);
    expect(res.body.staff.id).toBe(staffAId);
  });

  it("rejects an overlapping shift for the same staff member on the same day (T2.4 pass criteria)", async () => {
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, shiftTemplateId: morningTemplateId, date: "2026-09-08" });

    // บ่าย 14:00-22:00 ทับกับเช้า 08:00-16:00 ช่วง 14:00-16:00
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, shiftTemplateId: afternoonTemplateId, date: "2026-09-08" });

    expect(res.status).toBe(422);
  });

  it("allows a second non-overlapping shift for the same staff member on the same day (split shift)", async () => {
    const earlyMorning = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/shift-templates`)
      .set("Cookie", managerACookies)
      .send({ name: "เช้าตรู่", startMin: 6 * 60, endMin: 8 * 60 });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, shiftTemplateId: earlyMorning.body.id, date: "2026-09-09" });

    expect(res.status).toBe(201);
  });

  it("rejects assigning a shift template that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, shiftTemplateId: templateBId, date: "2026-09-10" });

    expect(res.status).toBe(404);
  });

  it("rejects assigning a staff member that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffBId, shiftTemplateId: morningTemplateId, date: "2026-09-10" });

    expect(res.status).toBe(404);
  });

  it("unassigns a shift", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-shifts`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, shiftTemplateId: morningTemplateId, date: "2026-09-11" });

    const removed = await request(app.getHttpServer())
      .delete(`/branches/${branchAId}/staff-shifts/${created.body.id}`)
      .set("Cookie", managerACookies);
    expect(removed.status).toBe(200);

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/staff-shifts?from=2026-09-11&to=2026-09-11`)
      .set("Cookie", managerACookies);
    expect((list.body as Array<{ id: string }>).map((s) => s.id)).not.toContain(created.body.id);
  });

  it("records a multi-day leave range as one row per day", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-leaves`)
      .set("Cookie", managerACookies)
      .send({
        staffId: staffAId,
        type: "VACATION",
        dateFrom: "2026-10-01",
        dateTo: "2026-10-03",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(3);
  });

  it("rejects a leave range that overlaps a day already on leave", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/staff-leaves`)
      .set("Cookie", managerACookies)
      .send({ staffId: staffAId, type: "SICK", dateFrom: "2026-10-02", dateTo: "2026-10-02" });

    expect(res.status).toBe(409);
  });

  it("rejects the manager of branch A from reading/creating shift resources of branch B with 403", async () => {
    const listTemplates = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/shift-templates`)
      .set("Cookie", managerACookies);
    expect(listTemplates.status).toBe(403);

    const listShifts = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/staff-shifts`)
      .set("Cookie", managerACookies);
    expect(listShifts.status).toBe(403);

    const listLeaves = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/staff-leaves`)
      .set("Cookie", managerACookies);
    expect(listLeaves.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/staff-shifts`);
    expect(res.status).toBe(401);
  });
});
