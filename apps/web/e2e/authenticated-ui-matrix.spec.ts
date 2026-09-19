import { test, expect, type Browser, type Page } from "@playwright/test";

const DEV_PASSWORD = "ChangeMe123!";
const ROUTES = [
  "/",
  "/board",
  "/billing",
  "/members",
  "/services",
  "/packages",
  "/staff",
  "/staff/shifts",
  "/attendance",
  "/promotions",
  "/promotions/calculator",
  "/rooms",
  "/payroll",
  "/reports",
] as const;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("owner@lotusdesk.local");
  await page.getByLabel("รหัสผ่าน").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL("/");
}

async function auditAuthenticatedRoutes(
  browser: Browser,
  viewport: { width: number; height: number },
  colorScheme: "light" | "dark",
) {
  const context = await browser.newContext({ viewport, colorScheme, locale: "th-TH" });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await login(page);
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", colorScheme);
  }

  expect(consoleErrors).toEqual([]);
  await context.close();
}

for (const viewport of [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${viewport.name} ${colorScheme}: authenticated routes remain readable`, async ({ browser }) => {
      test.setTimeout(180_000);
      await auditAuthenticatedRoutes(browser, viewport, colorScheme);
    });
  }
}
