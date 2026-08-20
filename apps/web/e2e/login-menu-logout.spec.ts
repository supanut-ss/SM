import { test, expect } from "@playwright/test";

/**
 * ตรงกับเกณฑ์ผ่านของ T1.6: "login → เห็นเมนูตามบทบาท → logout"
 * ต้องมี apps/web (port 3000) + apps/api (port 3001) + Postgres รันอยู่จริง และรัน
 * `pnpm db:seed` ไปแล้วก่อน (ใช้ dev user 4 บทบาทที่ seed สร้างไว้ — ดู packages/db/prisma/seed.ts)
 * ยังไม่เคยรันจริงบนเครื่องนี้ — ไม่มี Docker/Postgres (ดู docs/decisions.md)
 *
 * DEV_PASSWORD ตรงกับค่าคงที่ใน packages/db/prisma/seed.ts — ถ้าเปลี่ยนที่นั่นต้องแก้ตรงนี้ด้วย
 */
const DEV_PASSWORD = "ChangeMe123!";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL("/");
}

test("owner sees every menu item (full permission set)", async ({ page }) => {
  await login(page, "owner@lotusdesk.local");

  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  await expect(nav.getByRole("link", { name: "แดชบอร์ด" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "สมาชิก" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "พนักงาน" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "ตั้งค่า" })).toBeVisible();
});

test("staff sees only their limited menu — not member/staff/settings management", async ({ page }) => {
  await login(page, "staff@lotusdesk.local");

  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  // staff role: booking:view, service:view, room:view, attendance:manage, payroll:view เท่านั้น
  await expect(nav.getByRole("link", { name: "แดชบอร์ด" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "กระดานคิว" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "บริการ" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "ค่ามือ" })).toBeVisible();

  // ไม่มีสิทธิ์ตัวเหล่านี้ — ต้องไม่โผล่ในเมนูเลย ไม่ใช่แค่กดไม่ได้
  await expect(nav.getByRole("link", { name: "สมาชิก" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "พนักงาน" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "ตั้งค่า" })).toHaveCount(0);
});

test("logout clears the session and bounces protected routes back to /login", async ({ page }) => {
  await login(page, "owner@lotusdesk.local");

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
