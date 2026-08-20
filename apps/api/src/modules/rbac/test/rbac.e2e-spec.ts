import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/auth/test/auth.e2e-spec.ts (ดูคอมเมนต์ที่นั่นสำหรับรายละเอียด)
 *   pnpm --filter @lotus-desk/api test:e2e
 * ยังไม่เคยรันจริงบนเครื่องนี้ — ไม่มี Docker backend
 *
 * นี่คือ test ที่ตรงกับเกณฑ์ผ่านของ T1.4 ตัวจริง: "ผู้จัดการสาขา A เรียกข้อมูลสาขา B ต้องได้ 403 ทุก endpoint"
 */
describe("RBAC — branch scoping over real HTTP + Postgres", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let managerCookies: string[];

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    process.env.DATABASE_URL = databaseUrl;
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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "branch:view", description: "ดูข้อมูลสาขา" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.create({
      data: { roleId: managerRole.id, permissionId: viewPermission.id },
    });

    const managerEmail = "manager-a@lotusdesk.local";
    const managerPassword = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash(managerPassword),
        isActive: true,
      },
    });
    // manager สังกัดแค่สาขา A เท่านั้น — ไม่มี UserBranch ที่สาขา B เลย
    await prisma.userBranch.create({
      data: { userId: manager.id, branchId: branchAId, roleId: managerRole.id },
    });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: managerEmail, password: managerPassword });
    managerCookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("lets the manager view their own branch (A)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchAId}`)
      .set("Cookie", managerCookies);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe("A");
  });

  it("rejects the same manager viewing a different branch (B) with 403", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchBId}`)
      .set("Cookie", managerCookies);

    expect(res.status).toBe(403);
  });

  it("also rejects the branch-scoped devices list for branch B", async () => {
    const res = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/devices`)
      .set("Cookie", managerCookies);

    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}`);

    expect(res.status).toBe(401);
  });
});
