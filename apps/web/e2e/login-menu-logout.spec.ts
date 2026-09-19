import { test, expect, type Page } from "@playwright/test";

const DEV_PASSWORD = "ChangeMe123!";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL("/");
}

test("owner sees the current Basic Package navigation", async ({ page }) => {
  await login(page, "owner@lotusdesk.local");

  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  // Basic Package exposes these operational items; settings is not part of this navigation.
  for (const label of ["แดชบอร์ด", "กระดานคิว", "บิล/แคชเชียร์", "สมาชิก", "บริการ", "คอร์ส/แพ็กเกจ", "พนักงาน"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "ตั้งค่า" })).toHaveCount(0);
});

test("staff sees only their permitted Basic Package navigation", async ({ page }) => {
  await login(page, "staff@lotusdesk.local");

  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  for (const label of ["แดชบอร์ด", "กระดานคิว", "บริการ"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link")).toHaveCount(3);
});

test("mobile header and more-navigation sheet remain contained and keyboard accessible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, "owner@lotusdesk.local");

  await expect(page.locator("header")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  await page.getByRole("button", { name: "เพิ่มเติม" }).click();
  const moreSheet = page.getByRole("dialog", { name: "เมนูเพิ่มเติม" });
  await expect(moreSheet).toBeVisible();
  await expect(moreSheet).toHaveAttribute("aria-modal", "true");

  // Tab and Shift+Tab must stay inside the active sheet.
  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() => moreSheet.evaluate((sheet) => sheet.contains(document.activeElement)))
    .toBe(true);
  await page.keyboard.press("Tab");
  await expect
    .poll(() => moreSheet.evaluate((sheet) => sheet.contains(document.activeElement)))
    .toBe(true);

  const dialogLabels = await page.locator('[role="dialog"]').evaluateAll((dialogs) =>
    dialogs.map((dialog) => {
      const id = dialog.getAttribute("aria-labelledby");
      return { id, label: id ? document.getElementById(id)?.textContent?.trim() : null };
    }),
  );
  expect(dialogLabels.every(({ id, label }) => Boolean(id && label))).toBe(true);
  expect(new Set(dialogLabels.map(({ id }) => id)).size).toBe(dialogLabels.length);
});

test("logout clears the session and bounces protected routes back to /login", async ({ page }) => {
  await login(page, "owner@lotusdesk.local");

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
