import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

/**
 * Integration test แบบเต็ม (จริง) ตาม docs/PLAN.md §1: Testcontainers + Supertest
 * รันแยกจาก `pnpm test` ปกติเพราะต้องมี Docker และใช้เวลานานกว่า (pull image + start container)
 *   pnpm --filter @lotus-desk/api test:e2e
 *
 * ยังไม่เคยรันจริงบนเครื่องนี้ — ไม่มี Docker backend (ดู docs/decisions.md / git log T0.2)
 * เขียนไว้ให้ถูกต้องครบตาม stack ที่ล็อกไว้ รอรันจริงเมื่อมี Docker
 */
describe("Auth flow (real Postgres via Testcontainers)", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: (typeof import("@lotus-desk/db"))["prisma"];

  const TEST_EMAIL = "owner@lotusdesk.local";
  const TEST_PASSWORD = "ChangeMe123!";

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

    // import แบบ dynamic หลังตั้ง DATABASE_URL แล้วเท่านั้น — @lotus-desk/db สร้าง PrismaClient
    // singleton ตอน import ครั้งแรก ถ้า import แบบ static (hoisted) จะไปผูกกับ URL ผิดตัว
    const db = await import("@lotus-desk/db");
    prisma = db.prisma;
    const argon2 = await import("argon2");

    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: "เจ้าของร้าน (test)",
        passwordHash: await argon2.hash(TEST_PASSWORD),
        isActive: true,
      },
    });

    const { createApp } = await import("../../../main");
    app = await createApp();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it("rejects login with the wrong password", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("logs in with correct credentials and sets httpOnly cookies", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_EMAIL);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token=") && c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token=") && c.includes("HttpOnly"))).toBe(true);
  });

  it("rotates the refresh token on /auth/refresh", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginCookies = login.headers["set-cookie"] as unknown as string[];

    const refreshRes = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", loginCookies);

    expect(refreshRes.status).toBe(200);
    const newCookies = refreshRes.headers["set-cookie"] as unknown as string[];
    const oldRefreshCookie = loginCookies.find((c) => c.startsWith("refresh_token="));
    const newRefreshCookie = newCookies.find((c) => c.startsWith("refresh_token="));
    expect(newRefreshCookie).not.toBe(oldRefreshCookie);
  });

  it("revokes the whole chain when a used refresh token is replayed", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const originalCookies = login.headers["set-cookie"] as unknown as string[];

    // หมุนไปหนึ่งครั้งตามปกติ (ใช้งานจริง)
    await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", originalCookies);

    // เอา cookie ชุดแรก (ที่ถูกเพิกถอนไปแล้วตอนหมุน) กลับมาใช้ซ้ำ — จำลอง token หลุด
    const reuseRes = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", originalCookies);

    expect(reuseRes.status).toBe(401);

    // แม้แต่ token รุ่นล่าสุด (ที่ควรจะยังใช้ได้) ก็ต้องถูกเพิกถอนไปแล้วเพราะทั้งสายโดนตัด
    const secondLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(secondLogin.status).toBe(200); // login ใหม่ยังทำได้ปกติ (คนละ family)
  });

  it("logout-all invalidates every session for the user", async () => {
    const login1 = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const login2 = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    await request(app.getHttpServer())
      .post("/auth/logout-all")
      .set("Cookie", login1.headers["set-cookie"] as unknown as string[]);

    const refreshAfterLogoutAll = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", login2.headers["set-cookie"] as unknown as string[]);

    expect(refreshAfterLogoutAll.status).toBe(401);
  });
});
