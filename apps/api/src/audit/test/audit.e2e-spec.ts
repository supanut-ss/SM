import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/auth/test/auth.e2e-spec.ts ยังไม่เคยรันจริงบนเครื่องนี้ (ไม่มี Docker backend)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * เกณฑ์ผ่านจริงของ T1.5: "แก้ราคาแล้วมี log พร้อม diff" (ทดสอบด้วยการแก้ชื่อสาขาแทนเพราะยังไม่มี
 * entity ที่มีราคาให้แก้จริง — ดู BranchController.updateBranch) และ "ลอง UPDATE ตาราง log ตรงๆ
 * ต้องถูกปฏิเสธ" — สอง it() หลักด้านล่างตรงกับสองข้อนี้ตรงตัว
 */
describe("Audit log (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let db: typeof import("@lotus-desk/db");
  let branchId: string;
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
    // migration 20260820213921_audit_log_protection สร้าง role นี้เอง — ชี้แอปให้ต่อด้วย role
    // นี้แทน role เจ้าของตาราง (databaseUrl) ถึงจะพิสูจน์ได้ว่าการ REVOKE มีผลกับแอปจริง ไม่ใช่แค่ทฤษฎี
    process.env.APP_DATABASE_URL = `postgresql://lotus_app:lotus_app_dev_only@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

    execSync("npx prisma migrate deploy", {
      cwd: "../../packages/db",
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });

    db = await import("@lotus-desk/db");
    const argon2 = await import("argon2");
    const prisma = db.prisma; // ใช้ role เจ้าของ (DATABASE_URL) สำหรับงาน setup/assert ทั่วไป

    const branch = await prisma.branch.create({ data: { name: "สาขาเดิม", code: "AUDIT-E2E" } });
    branchId = branch.id;

    const managePermission = await prisma.permission.create({
      data: { key: "branch:manage", description: "จัดการสาขา" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.create({
      data: { roleId: managerRole.id, permissionId: managePermission.id },
    });

    const email = "manager@lotusdesk.local";
    const password = "ChangeMe123!";
    const manager = await prisma.user.create({
      data: { email, name: "ผู้จัดการ (test)", passwordHash: await argon2.hash(password), isActive: true },
    });
    await prisma.userBranch.create({
      data: { userId: manager.id, branchId, roleId: managerRole.id },
    });

    const { createApp } = await import("../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer()).post("/auth/login").send({ email, password });
    managerCookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("logs actor/action/entity/before/after/ip/requestId when a branch is edited (the 'edit a price' scenario)", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchId}`)
      .set("Cookie", managerCookies)
      .set("x-request-id", "e2e-fixed-request-id")
      .send({ name: "สาขาใหม่" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("สาขาใหม่");

    const log = await db.prisma.auditLog.findFirst({
      where: { entity: "Branch", entityId: branchId },
      orderBy: { createdAt: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log?.action).toBe("UPDATE");
    expect((log?.before as { name?: string } | null)?.name).toBe("สาขาเดิม");
    expect((log?.after as { name?: string } | null)?.name).toBe("สาขาใหม่");
    expect(log?.requestId).toBe("e2e-fixed-request-id");
    expect(log?.ipAddress).toBeTruthy();
  });

  it("rejects a direct UPDATE against audit_logs even from the app's own DB role", async () => {
    const { PrismaClient } = db;
    const appOnlyClient = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL });

    await expect(
      appOnlyClient.$executeRawUnsafe(`UPDATE "audit_logs" SET entity = 'tampered'`),
    ).rejects.toThrow(/permission denied/i);

    await appOnlyClient.$disconnect();
  });

  it("still allows the app role to INSERT and SELECT on audit_logs (only UPDATE/DELETE are blocked)", async () => {
    const { PrismaClient } = db;
    const appOnlyClient = new PrismaClient({ datasourceUrl: process.env.APP_DATABASE_URL });

    const count = await appOnlyClient.auditLog.count();
    expect(count).toBeGreaterThan(0);

    await expect(
      appOnlyClient.$executeRawUnsafe(`DELETE FROM "audit_logs" WHERE 1=1`),
    ).rejects.toThrow(/permission denied/i);

    await appOnlyClient.$disconnect();
  });
});
