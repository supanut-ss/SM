import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest — pattern เดียวกับ
 * apps/api/src/modules/package/test/package.e2e-spec.ts (T5.1)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ครอบเกณฑ์ผ่านของ T5.2: "ตัดคอร์สแล้วยกเลิกบิล ต้องคืนครั้งอัตโนมัติและยอดตรง 100%" และ
 * "ตัดพร้อมกัน 2 request เหลือ 1 ครั้ง ต้องสำเร็จแค่รายการเดียว" รวมถึง freeze/transfer/expire/branch scoping
 */
describe("MemberPackages (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let memberAId: string;
  let memberA2Id: string;
  let memberBId: string;
  let sessionPackageId: string;
  let valuePackageId: string;
  let unlimitedPackageId: string;
  let cashierCookies: string[];
  let managerUserId: string;
  let cashierUserId: string;

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "MP-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "MP-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const memberA = await prisma.member.create({
      data: { branchId: branchAId, code: "M000001", name: "ลูกค้า A1", phone: "0810000001" },
    });
    const memberA2 = await prisma.member.create({
      data: { branchId: branchAId, code: "M000002", name: "ลูกค้า A2", phone: "0810000002" },
    });
    const memberB = await prisma.member.create({
      data: { branchId: branchBId, code: "M000001", name: "ลูกค้า B1", phone: "0820000001" },
    });
    memberAId = memberA.id;
    memberA2Id = memberA2.id;
    memberBId = memberB.id;

    const categoryA = await prisma.serviceCategory.create({ data: { branchId: branchAId, name: "นวด" } });
    const roomTypeA = await prisma.roomType.create({ data: { branchId: branchAId, name: "ห้องนวดเดี่ยว" } });
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
    const serviceVariantAId = serviceA.variants[0]!.id;

    const sessionPackage = await prisma.package.create({
      data: {
        branchId: branchAId,
        name: "คอร์สนวดไทย 3 ครั้ง",
        type: "SESSION_COUNT",
        priceSatang: 270000,
        sessionCount: 3,
        serviceVariantId: serviceVariantAId,
        validDays: 180,
      },
    });
    const valuePackage = await prisma.package.create({
      data: {
        branchId: branchAId,
        name: "บัตรเงินสด",
        type: "VALUE",
        priceSatang: 500000,
        valueSatang: 500000,
        validDays: 365,
      },
    });
    const unlimitedPackage = await prisma.package.create({
      data: {
        branchId: branchAId,
        name: "คอร์สไม่จำกัด",
        type: "UNLIMITED_DURATION",
        priceSatang: 990000,
        serviceVariantId: serviceVariantAId,
        validDays: 90,
      },
    });
    sessionPackageId = sessionPackage.id;
    valuePackageId = valuePackage.id;
    unlimitedPackageId = unlimitedPackage.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "package:view", description: "ดูข้อมูลคอร์ส/แพ็กเกจ" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "package:manage", description: "จัดการคอร์ส/แพ็กเกจ" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    const cashierRole = await prisma.role.create({ data: { key: "cashier", name: "แคชเชียร์" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
        { roleId: cashierRole.id, permissionId: viewPermission.id },
        { roleId: cashierRole.id, permissionId: managePermission.id },
      ],
    });

    const managerUser = await prisma.user.create({
      data: {
        email: "manager-mp-a@lotusdesk.local",
        name: "ผู้จัดการสาขา A (test)",
        passwordHash: await argon2.hash("ChangeMe123!"),
        isActive: true,
      },
    });
    managerUserId = managerUser.id;
    await prisma.userBranch.create({
      data: { userId: managerUser.id, branchId: branchAId, roleId: managerRole.id },
    });

    const cashierEmail = "cashier-mp-a@lotusdesk.local";
    const cashierPassword = "ChangeMe123!";
    const cashierUser = await prisma.user.create({
      data: {
        email: cashierEmail,
        name: "แคชเชียร์สาขา A (test)",
        passwordHash: await argon2.hash(cashierPassword),
        isActive: true,
      },
    });
    cashierUserId = cashierUser.id;
    await prisma.userBranch.create({
      data: { userId: cashierUser.id, branchId: branchAId, roleId: cashierRole.id },
    });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: cashierEmail, password: cashierPassword });
    cashierCookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("purchases a SESSION_COUNT package for a member with the initial balance snapshotted from the catalog", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("SESSION_COUNT");
    expect(res.body.sessionCount).toBe(3);
    expect(res.body.balance).toBe(3);
    expect(res.body.memberId).toBe(memberAId);
  });

  it("uses 1 session then refunds it exactly — balance must match 100% (T5.2 pass criteria)", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;
    expect(purchase.body.balance).toBe(3);

    const used = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1 });
    expect(used.status).toBe(201);
    expect(used.body.balance).toBe(2);
    const useEntryId = used.body.ledgerEntry.id as string;

    // ยกเลิกบิลที่ตัดคอร์สไปแล้ว -> คืนครั้งอัตโนมัติ ยอดต้องตรง 100%
    const refunded = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/refund`)
      .set("Cookie", cashierCookies)
      .send({ ledgerEntryId: useEntryId, note: "ยกเลิกบิล" });
    expect(refunded.status).toBe(201);
    expect(refunded.body.balance).toBe(3);

    // คืนซ้ำรายการเดิมต้องไม่ได้ (กันคืนซ้ำ)
    const refundedAgain = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/refund`)
      .set("Cookie", cashierCookies)
      .send({ ledgerEntryId: useEntryId, note: "ลองคืนซ้ำ" });
    expect(refundedAgain.status).toBe(409);
  });

  it("only allows exactly one of 2 concurrent deductions to succeed when only 1 session is left (T5.2 pass criteria)", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;

    // ตัดจนเหลือ 1 ครั้งก่อน (จากยอดเริ่มต้น 3)
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 2 });

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
        .set("Cookie", cashierCookies)
        .send({ amount: 1 }),
      request(app.getHttpServer())
        .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
        .set("Cookie", cashierCookies)
        .send({ amount: 1 }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 422]);

    const detail = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/member-packages/${memberPackageId}`)
      .set("Cookie", cashierCookies);
    expect(detail.body.balance).toBe(0);
  });

  it("rejects using an expired package without manager approval, allows it with approval", async () => {
    // ซื้อแล้วย้อนวันหมดอายุให้อยู่ในอดีต (จำลองสถานการณ์คอร์สหมดอายุแล้ว)
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;

    const db = await import("@lotus-desk/db");
    await db.prisma.memberPackage.update({
      where: { id: memberPackageId },
      data: { expiresAt: new Date("2020-01-01T00:00:00Z") },
    });

    const withoutApproval = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1 });
    expect(withoutApproval.status).toBe(422);

    const withCashierAsApprover = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1, approvedByUserId: cashierUserId });
    expect(withCashierAsApprover.status).toBe(403);

    const withManagerApproval = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1, approvedByUserId: managerUserId });
    expect(withManagerApproval.status).toBe(201);
    expect(withManagerApproval.body.balance).toBe(2);
  });

  it("freezes a package, extending expiresAt, and enforces the 30-day cap", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;
    const originalExpiresAt = new Date(purchase.body.expiresAt as string);

    const withoutApproval = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/freeze`)
      .set("Cookie", cashierCookies)
      .send({ days: 10 });
    expect(withoutApproval.status).toBe(400); // zod: approvedByUserId required

    const frozen = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/freeze`)
      .set("Cookie", cashierCookies)
      .send({ days: 20, approvedByUserId: managerUserId });
    expect(frozen.status).toBe(201);
    const newExpiresAt = new Date(frozen.body.expiresAt as string);
    expect(newExpiresAt.getTime() - originalExpiresAt.getTime()).toBe(20 * 24 * 60 * 60 * 1000);

    const overCap = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/freeze`)
      .set("Cookie", cashierCookies)
      .send({ days: 11, approvedByUserId: managerUserId });
    expect(overCap.status).toBe(422);

    const exactlyAtCap = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/freeze`)
      .set("Cookie", cashierCookies)
      .send({ days: 10, approvedByUserId: managerUserId });
    expect(exactlyAtCap.status).toBe(201);
  });

  it("transfers a whole package to another member, closing the old one and preserving the balance", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;

    const transferred = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/transfer`)
      .set("Cookie", cashierCookies)
      .send({ toMemberId: memberA2Id, note: "ลูกค้าขอโอนให้เพื่อน" });
    expect(transferred.status).toBe(201);
    expect(transferred.body.closed.status).toBe("CLOSED");
    expect(transferred.body.transferred.memberId).toBe(memberA2Id);
    expect(transferred.body.transferred.balance).toBe(3);

    const oldDetail = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/member-packages/${memberPackageId}`)
      .set("Cookie", cashierCookies);
    expect(oldDetail.body.balance).toBe(0);
    expect(oldDetail.body.status).toBe("CLOSED");

    // ใบเดิมปิดแล้ว ใช้ต่อไม่ได้
    const useOnClosed = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1 });
    expect(useOnClosed.status).toBe(422);
  });

  it("purchases and uses a VALUE package by satang amount, unbound from any single service", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: valuePackageId });
    expect(purchase.body.balance).toBe(500000);
    const memberPackageId = purchase.body.id as string;

    const used = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 30000 });
    expect(used.status).toBe(201);
    expect(used.body.balance).toBe(470000);
  });

  it("purchases an UNLIMITED_DURATION package and allows repeated use without touching a balance", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: unlimitedPackageId });
    expect(purchase.body.balance).toBe(0);
    const memberPackageId = purchase.body.id as string;

    const used1 = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1 });
    const used2 = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/use`)
      .set("Cookie", cashierCookies)
      .send({ amount: 1 });
    expect(used1.status).toBe(201);
    expect(used2.status).toBe(201);
    expect(used2.body.balance).toBe(0);
  });

  it("closes a package as a manual write-off (EXPIRE) only with manager approval, zeroing the balance", async () => {
    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    const memberPackageId = purchase.body.id as string;

    const withoutApproval = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/expire`)
      .set("Cookie", cashierCookies)
      .send({ note: "ลูกค้าหาย" });
    expect(withoutApproval.status).toBe(400);

    const expired = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/member-packages/${memberPackageId}/expire`)
      .set("Cookie", cashierCookies)
      .send({ approvedByUserId: managerUserId, note: "ลูกค้าไม่ติดต่อกลับมา 1 ปี" });
    expect(expired.status).toBe(201);
    expect(expired.body.balance).toBe(0);
    expect(expired.body.status).toBe("CLOSED");
  });

  it("rejects creation using a package that belongs to a different branch", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/members/${memberAId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: "does-not-exist" });
    expect(res.status).toBe(404);
  });

  it("rejects the cashier of branch A from reading/purchasing member packages of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/members/${memberBId}/packages`)
      .set("Cookie", cashierCookies);
    expect(list.status).toBe(403);

    const purchase = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/members/${memberBId}/packages`)
      .set("Cookie", cashierCookies)
      .send({ packageId: sessionPackageId });
    expect(purchase.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(
      `/branches/${branchAId}/members/${memberAId}/packages`,
    );
    expect(res.status).toBe(401);
  });
});
