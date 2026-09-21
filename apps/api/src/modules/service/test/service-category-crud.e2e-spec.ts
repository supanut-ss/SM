import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("ServiceCategory CRUD (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let managerCookies: string[];
  let viewerCookies: string[];
  let createdId: string;

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
    const argon2 = await import("argon2");
    const branchA = await db.prisma.branch.create({ data: { name: "สาขา A", code: "CAT-A" } });
    const branchB = await db.prisma.branch.create({ data: { name: "สาขา B", code: "CAT-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const viewPermission = await db.prisma.permission.create({
      data: { key: "service:view", description: "ดูข้อมูลบริการ" },
    });
    const managePermission = await db.prisma.permission.create({
      data: { key: "service:manage", description: "จัดการบริการ" },
    });
    const managerRole = await db.prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    const viewerRole = await db.prisma.role.create({ data: { key: "viewer", name: "ผู้ดู" } });
    await db.prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
        { roleId: viewerRole.id, permissionId: viewPermission.id },
      ],
    });

    const password = "ChangeMe123!";
    const manager = await db.prisma.user.create({
      data: { email: "manager-category@lotusdesk.local", name: "Manager", passwordHash: await argon2.hash(password) },
    });
    const viewer = await db.prisma.user.create({
      data: { email: "viewer-category@lotusdesk.local", name: "Viewer", passwordHash: await argon2.hash(password) },
    });
    await db.prisma.userBranch.createMany({
      data: [
        { userId: manager.id, branchId: branchAId, roleId: managerRole.id },
        { userId: manager.id, branchId: branchBId, roleId: managerRole.id },
        { userId: viewer.id, branchId: branchAId, roleId: viewerRole.id },
      ],
    });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();
    const managerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: manager.email, password });
    managerCookies = managerLogin.headers["set-cookie"] as unknown as string[];
    const viewerLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: viewer.email, password });
    viewerCookies = viewerLogin.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("creates a trimmed category at the end of the branch order", async () => {
    const db = await import("@lotus-desk/db");
    await db.prisma.serviceCategory.create({
      data: { branchId: branchAId, name: "Existing category", sortOrder: 4 },
    });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/service-categories`)
      .set("Cookie", managerCookies)
      .send({ name: "  สปา  " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "สปา", sortOrder: 5 });
    createdId = res.body.id;
  });

  it("rejects blank and duplicate names but permits the same name in another branch", async () => {
    const blank = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/service-categories`)
      .set("Cookie", managerCookies)
      .send({ name: "   " });
    expect(blank.status).toBe(400);

    const duplicate = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/service-categories`)
      .set("Cookie", managerCookies)
      .send({ name: "สปา" });
    expect(duplicate.status).toBe(409);

    const otherBranch = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/service-categories`)
      .set("Cookie", managerCookies)
      .send({ name: "สปา" });
    expect(otherBranch.status).toBe(201);
  });

  it("updates a category and records its audit before/after", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/service-categories/${createdId}`)
      .set("Cookie", managerCookies)
      .send({ name: "สปาและผิวหน้า" });
    expect(res.status).toBe(200);

    const db = await import("@lotus-desk/db");
    const audit = await db.prisma.auditLog.findFirst({
      where: { entity: "ServiceCategory", entityId: createdId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.before as { name?: string } | null)?.name).toBe("สปา");
    expect((audit?.after as { name?: string } | null)?.name).toBe("สปาและผิวหน้า");
  });

  it("returns 404 for cross-branch update and delete", async () => {
    const update = await request(app.getHttpServer())
      .patch(`/branches/${branchBId}/service-categories/${createdId}`)
      .set("Cookie", managerCookies)
      .send({ name: "ห้ามแก้" });
    expect(update.status).toBe(404);
    const remove = await request(app.getHttpServer())
      .delete(`/branches/${branchBId}/service-categories/${createdId}`)
      .set("Cookie", managerCookies);
    expect(remove.status).toBe(404);
  });

  it("returns 403 when a view-only user mutates categories", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/service-categories`)
      .set("Cookie", viewerCookies)
      .send({ name: "ไม่มีสิทธิ์" });
    expect(res.status).toBe(403);
  });

  it("returns 409 when a service references the category", async () => {
    const db = await import("@lotus-desk/db");
    await db.prisma.service.create({
      data: { branchId: branchAId, categoryId: createdId, name: "บริการที่อ้างอิง" },
    });
    const res = await request(app.getHttpServer())
      .delete(`/branches/${branchAId}/service-categories/${createdId}`)
      .set("Cookie", managerCookies);
    expect(res.status).toBe(409);
  });

  it("deletes an unreferenced category and records its audit before", async () => {
    const create = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/service-categories`)
      .set("Cookie", managerCookies)
      .send({ name: "หมวดทดลองลบ" });
    const categoryId = create.body.id as string;
    const remove = await request(app.getHttpServer())
      .delete(`/branches/${branchAId}/service-categories/${categoryId}`)
      .set("Cookie", managerCookies);
    expect(remove.status).toBe(200);

    const db = await import("@lotus-desk/db");
    const audit = await db.prisma.auditLog.findFirst({
      where: { entity: "ServiceCategory", entityId: categoryId, action: "DELETE" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.before as { name?: string } | null)?.name).toBe("หมวดทดลองลบ");
  });
});
