import { expect, test, type Locator, type Page } from "@playwright/test";

const DEV_PASSWORD = "ChangeMe123!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("owner@lotusdesk.local");
  await page.getByLabel("รหัสผ่าน").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoViewportOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

async function expectMinimumTargetSize(locator: Locator, minimum = 44) {
  const dimensions = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    }),
  );

  expect(dimensions).not.toHaveLength(0);
  for (const { width, height } of dimensions) {
    expect(width).toBeGreaterThanOrEqual(minimum);
    expect(height).toBeGreaterThanOrEqual(minimum);
  }
}

async function expectThemePreservesPageVisibility(page: Page, heading: string) {
  if ((await page.locator("html").getAttribute("data-theme")) !== "dark") {
    const visibleThemeToggle = page.getByRole("button", { name: /สลับเป็นโหมด/ }).filter({ visible: true });
    if ((await visibleThemeToggle.count()) === 0) {
      await page.getByRole("button", { name: "เปิดเมนูบัญชี" }).click();
    }
    await page.getByRole("button", { name: /สลับเป็นโหมด/ }).filter({ visible: true }).click();
    if ((await page.getByRole("dialog", { name: "บัญชีและการแสดงผล" }).count()) > 0) {
      await page.keyboard.press("Escape");
    }
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

async function expectUniqueIds(page: Page) {
  const ids = await page.locator("[id]").evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(ids).size).toBe(ids.length);
}

test("Billing keeps checkout controls labelled, touch-friendly, and visible in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/billing");

  await expect(page.getByRole("heading", { name: "บิล/แคชเชียร์" })).toBeVisible();
  const productDisclosure = page.locator("summary").filter({ hasText: "เพิ่มรายการสินค้า", visible: true });
  await expect(productDisclosure).toBeVisible();
  await expectMinimumTargetSize(productDisclosure);
  await productDisclosure.click();
  await expect(page.getByLabel("ชื่อสินค้า").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("ราคา (บาท)").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("จำนวน").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("แหล่งชำระสินค้า").filter({ visible: true })).toBeVisible();

  await expectMinimumTargetSize(
    page.getByLabel(/^(ชื่อสินค้า|ราคา \(บาท\)|จำนวน|แหล่งชำระสินค้า)$/).filter({ visible: true }),
  );
  await expectMinimumTargetSize(page.getByRole("button", { name: "+ เพิ่มรายการสินค้า" }).filter({ visible: true }));
  await expectUniqueIds(page);
  await expectNoViewportOverflow(page);
  await expectThemePreservesPageVisibility(page, "บิล/แคชเชียร์");
  await expect(page.getByTestId("billing-page-header")).toHaveScreenshot("billing-mobile-dark.png", {
    animations: "disabled",
    mask: [page.getByTestId("billing-cart-summary")],
    maskColor: "#263234",
  });
});

test("Board exposes a clear mobile primary action without overflow and keeps its sheet keyboard-contained", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  await page.goto("/board");

  await expect(page.getByRole("heading", { name: "กระดานคิว" })).toBeVisible();
  const quickBooking = page.getByRole("button", { name: "+ จองด่วน" });
  await expect(quickBooking).toBeVisible();
  await expect(page.getByRole("button", { name: "วันนี้" })).toBeVisible();
  const boardOptions = page.locator("details").filter({ hasText: "ตัวเลือกมุมมอง" });
  await boardOptions.locator("summary").click();
  await expect(boardOptions.getByLabel("มุมมอง")).toBeVisible();
  await expect(boardOptions.getByLabel("ความละเอียดเวลา")).toBeVisible();
  await expectMinimumTargetSize(quickBooking);
  await expectMinimumTargetSize(page.getByRole("button", { name: "วันนี้" }));
  await expectMinimumTargetSize(boardOptions.getByLabel("มุมมอง"));
  await expectNoViewportOverflow(page);

  await quickBooking.click();
  const sheet = page.getByRole("dialog", { name: "จองด่วนจากคิวหมุน" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expectUniqueIds(page);

  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(quickBooking).toBeFocused();

  await expectThemePreservesPageVisibility(page, "กระดานคิว");
  await expect(page.getByTestId("board-page-header")).toHaveScreenshot("board-mobile-dark.png", {
    animations: "disabled",
    mask: [page.getByTestId("board-summary"), page.getByTestId("board-date-navigation")],
    maskColor: "#263234",
  });
});

test("desktop Board exposes named controls and its internal timeline does not widen the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await page.goto("/board");

  await expect(page.getByRole("heading", { name: "กระดานคิว" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ จองด่วน" })).toBeVisible();
  await expect(page.getByLabel("มุมมอง").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("ความละเอียดเวลา").filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel(/กระดานคิว — ใช้ลูกศรเลือกนัด/)).toBeVisible();
  await expectNoViewportOverflow(page);
  await expect(page.getByTestId("board-page-header")).toHaveScreenshot("board-desktop-light.png", {
    animations: "disabled",
    mask: [page.getByTestId("board-summary"), page.getByTestId("board-date-navigation")],
    maskColor: "#eef1f0",
  });
});

test("Billing exposes loading, recoverable error, and useful empty states", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  let requestCount = 0;
  await page.route("**/api/branches/*/appointment-items**", async (route) => {
    requestCount += 1;
    if (requestCount <= 4) {
      if (requestCount === 1) await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "ทดสอบโหลดไม่สำเร็จ" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/billing");
  await expect(page.getByRole("status", { name: "กำลังโหลดรายการ" }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "โหลดรายการพร้อมออกบิลไม่สำเร็จ", visible: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "ลองใหม่" }).filter({ visible: true }).click();
  await expect(page.getByText("ยังไม่มีใบงานที่จบแล้วรอออกบิล").filter({ visible: true })).toBeVisible();
});

test("Board keeps the schedule usable when the queue request fails and recovers", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  let requestCount = 0;
  await page.route("**/api/branches/*/staff-queue**", async (route) => {
    requestCount += 1;
    if (requestCount <= 4) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "ทดสอบคิวไม่สำเร็จ" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "กระดานคิว" })).toBeVisible();
  const queueError = page.getByRole("alert").filter({ hasText: "โหลดคิวหมุนไม่สำเร็จ", visible: true });
  await expect(queueError).toBeVisible({ timeout: 15_000 });
  await queueError.getByRole("button", { name: "ลองใหม่" }).click();
  await expect(queueError).toBeHidden();
  await expect(page.getByRole("heading", { name: "กระดานคิว" })).toBeVisible();
});
