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
 * ครอบเกณฑ์ผ่านของ T5.4: CRUD โปรโมชั่น+คูปอง และหน้าทดลองคำนวณเลือกโปรฯ เดียวพร้อมเหตุผล
 */
describe("Promotions & Coupons (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let branchAId: string;
  let branchBId: string;
  let managerCookies: string[];

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

    const branchA = await prisma.branch.create({ data: { name: "สาขา A", code: "PROMO-A" } });
    const branchB = await prisma.branch.create({ data: { name: "สาขา B", code: "PROMO-B" } });
    branchAId = branchA.id;
    branchBId = branchB.id;

    const viewPermission = await prisma.permission.create({
      data: { key: "promotion:view", description: "ดูข้อมูลโปรโมชั่น" },
    });
    const managePermission = await prisma.permission.create({
      data: { key: "promotion:manage", description: "จัดการโปรโมชั่น" },
    });
    const managerRole = await prisma.role.create({ data: { key: "manager", name: "ผู้จัดการ" } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: managerRole.id, permissionId: viewPermission.id },
        { roleId: managerRole.id, permissionId: managePermission.id },
      ],
    });

    const managerEmail = "manager-promo-a@lotusdesk.local";
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
    managerCookies = login.headers["set-cookie"] as unknown as string[];
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  /** เทสก่อนหน้าอาจสร้างโปรฯ ทิ้งไว้ในสาขานี้ — ปิดให้หมดก่อนเทสคำนวณแต่ละครั้ง กันโปรฯ เก่าปนกับที่ตั้งใจเทส */
  async function deactivateAllPromotions(): Promise<void> {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchAId}/promotions?isActive=true`)
      .set("Cookie", managerCookies);
    for (const promotion of list.body as Array<{ id: string }>) {
      await request(app.getHttpServer())
        .patch(`/branches/${branchAId}/promotions/${promotion.id}`)
        .set("Cookie", managerCookies)
        .send({ isActive: false });
    }
  }

  it("creates a PERCENT_OFF promotion (T5.4 pass criteria)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "ลด 20% วันธรรมดา", percentOff: 20 });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("PERCENT_OFF");
    expect(res.body.percentOff).toBe(20);
    expect(res.body.branchId).toBe(branchAId);
  });

  it("creates promotions of the other 4 types", async () => {
    const amountOff = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "AMOUNT_OFF", name: "ลด 100 บาท", amountOffSatang: 10000 });
    const fixedPrice = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "FIXED_PRICE", name: "ราคาพิเศษ 199", fixedPriceSatang: 19900 });
    const buyXGetY = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "BUY_X_GET_Y", name: "ซื้อ 2 แถม 1", buyQuantity: 2, getQuantity: 1 });
    const bonusMinutes = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "BONUS_MINUTES", name: "แถม 15 นาที", bonusMinutes: 15 });

    expect(amountOff.status).toBe(201);
    expect(fixedPrice.status).toBe(201);
    expect(buyXGetY.status).toBe(201);
    expect(bonusMinutes.status).toBe(201);
  });

  it("edits name/priority/isActive but not type or percentOff after creation", async () => {
    const created = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "โปรฯ แก้ไข", percentOff: 5 });
    const promotionId = created.body.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/promotions/${promotionId}`)
      .set("Cookie", managerCookies)
      .send({ name: "โปรฯ แก้ไขแล้ว", priority: 10, isActive: false });

    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe("โปรฯ แก้ไขแล้ว");
    expect(updated.body.priority).toBe(10);
    expect(updated.body.isActive).toBe(false);
    expect(updated.body.percentOff).toBe(5);
  });

  it("creates a coupon under a promotion and rejects duplicate codes in the same branch", async () => {
    const promo = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "โปรฯ คูปอง", percentOff: 15 });
    const promotionId = promo.body.id as string;

    const coupon = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/${promotionId}/coupons`)
      .set("Cookie", managerCookies)
      .send({ code: "summer10" });
    expect(coupon.status).toBe(201);
    expect(coupon.body.code).toBe("SUMMER10");

    const duplicate = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/${promotionId}/coupons`)
      .set("Cookie", managerCookies)
      .send({ code: "SUMMER10" });
    expect(duplicate.status).toBe(409);
  });

  it("deactivates a coupon via PATCH", async () => {
    const promo = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "โปรฯ คูปอง 2", percentOff: 15 });
    const promotionId = promo.body.id as string;
    const coupon = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/${promotionId}/coupons`)
      .set("Cookie", managerCookies)
      .send({ code: "WINTER5" });

    const deactivated = await request(app.getHttpServer())
      .patch(`/branches/${branchAId}/promotions/${promotionId}/coupons/${coupon.body.id}`)
      .set("Cookie", managerCookies)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);
  });

  it("calculator picks the automatic promotion with the largest discount, no coupon needed", async () => {
    await deactivateAllPromotions();
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "ลด 10% (auto)", percentOff: 10 });
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "ลด 30% (auto)", percentOff: 30 });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/calculate`)
      .set("Cookie", managerCookies)
      .send({
        cart: [{ serviceVariantId: "sv_1", priceSatang: 100000, paymentMethod: "CASH" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.applied.promotionName).toBe("ลด 30% (auto)");
    expect(res.body.applied.discountSatang).toBe(30000);
    expect(res.body.rejected.length).toBeGreaterThan(0);
  });

  it("calculator requires a matching coupon code before a coupon-gated promotion is considered", async () => {
    await deactivateAllPromotions();
    const promo = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "ลด 50% เฉพาะคูปอง", percentOff: 50 });
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/${promo.body.id}/coupons`)
      .set("Cookie", managerCookies)
      .send({ code: "VIP50" });

    const cart = [{ serviceVariantId: "sv_1", priceSatang: 100000, paymentMethod: "CASH" }];

    const withoutCoupon = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/calculate`)
      .set("Cookie", managerCookies)
      .send({ cart });
    expect(withoutCoupon.body.applied?.promotionName).not.toBe("ลด 50% เฉพาะคูปอง");

    const withCoupon = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/calculate`)
      .set("Cookie", managerCookies)
      .send({ cart, couponCode: "vip50" });
    expect(withCoupon.body.applied?.promotionName).toBe("ลด 50% เฉพาะคูปอง");
    expect(withCoupon.body.applied?.discountSatang).toBe(50000);
  });

  it("calculator reports a couponError for an unknown coupon code", async () => {
    await deactivateAllPromotions();
    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/calculate`)
      .set("Cookie", managerCookies)
      .send({
        cart: [{ serviceVariantId: "sv_1", priceSatang: 100000, paymentMethod: "CASH" }],
        couponCode: "DOESNOTEXIST",
      });
    expect(res.status).toBe(201);
    expect(res.body.couponError).toBeTruthy();
  });

  it("calculator never discounts a PACKAGE-paid line and explains every rejected promotion", async () => {
    await deactivateAllPromotions();
    await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "ลด 25% (auto2)", percentOff: 25 });

    const res = await request(app.getHttpServer())
      .post(`/branches/${branchAId}/promotions/calculate`)
      .set("Cookie", managerCookies)
      .send({
        cart: [{ serviceVariantId: "sv_1", priceSatang: 100000, paymentMethod: "PACKAGE" }],
      });
    expect(res.status).toBe(201);
    expect(res.body.applied).toBeNull();
    for (const r of res.body.rejected) {
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects the manager of branch A from reading/creating promotions of branch B with 403", async () => {
    const list = await request(app.getHttpServer())
      .get(`/branches/${branchBId}/promotions`)
      .set("Cookie", managerCookies);
    expect(list.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post(`/branches/${branchBId}/promotions`)
      .set("Cookie", managerCookies)
      .send({ type: "PERCENT_OFF", name: "ไม่ควรสร้างได้", percentOff: 10 });
    expect(create.status).toBe(403);
  });

  it("rejects an unauthenticated request before it even checks branch scope", async () => {
    const res = await request(app.getHttpServer()).get(`/branches/${branchAId}/promotions`);
    expect(res.status).toBe(401);
  });
});
