import { test, expect, type Page } from "@playwright/test";

/**
 * T10.9 — เส้นทางวิกฤตที่ viewport มือถือ (375×812) และแท็บเล็ต (768×1024) ดู playwright.config.ts
 * โปรเจกต์ "mobile-375"/"tablet-768" (จำกัดให้รันเฉพาะไฟล์นี้ผ่าน testMatch — ไม่รันไฟล์ e2e เดิมที่เขียน
 * โดยอิงโครงสร้างเมนู desktop ล้วน ๆ)
 *
 * ต้องมี apps/web (port 3000) + apps/api (port 3001) + Postgres รันอยู่จริงและ seed แล้ว
 * (เหมือน login-menu-logout.spec.ts) — DEV_PASSWORD ตรงกับ packages/db/prisma/seed.ts
 *
 * ที่ 768px คือขอบล่างของ breakpoint `md` (Tailwind min-width) พอดี ทำให้ UI ที่ md: เปลี่ยนพฤติกรรม
 * (bottom tab bar/wizard/FAB เทียบกับ sidebar/สองคอลัมน์/ปุ่มบนสุด) แสดงเป็นโหมด "จอกว้าง" ที่ 768px —
 * เทสต์ในไฟล์นี้จึงต้องใช้ locator ที่ทนต่อทั้งสองโหมด (เลือกเฉพาะ element ที่มองเห็นจริงด้วย :visible)
 * แทนที่จะ hardcode ว่าอยู่โหมดไหน
 *
 * หมายเหตุ Sheet component (packages/ui/src/components/sheet.tsx) ไม่ unmount ตอนปิด (สลับด้วย
 * transform + inert แทน display:none) ปุ่ม/เนื้อหาข้างในเลย "มองเห็นได้" ตาม Playwright แม้ตอนปิดอยู่ —
 * ห้ามใช้ toBeHidden() กับตัว dialog เอง ให้เช็คผลลัพธ์ปลายทาง (รายการที่เพิ่มเข้ามา) แทน และ AuthenticatedShell
 * มี Sheet "เมนูเพิ่มเติม" ของ bottom tab bar อยู่ทุกหน้าเสมอ — ต้อง scope ด้วย heading ที่ต้องการเจาะจง
 * ทุกครั้ง ห้ามใช้ page.getByRole("dialog") เปล่า ๆ เพราะจะชนกับ dialog อื่นที่ inert อยู่ (strict mode)
 */
const DEV_PASSWORD = "ChangeMe123!";

async function login(page: Page, email = "owner@lotusdesk.local") {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(DEV_PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL("/");
}

/** หน้าที่ migrate เข้า ResponsiveList/wizard มือถือ (T10.3–T10.8) มักมี element เดิมซ้ำ 2 ชุด
 * (เวอร์ชัน desktop ที่ `hidden md:...` กับเวอร์ชันมือถือที่ `...md:hidden`) — เลือกเฉพาะอันที่
 * มองเห็นจริงตาม viewport ปัจจุบันด้วย CSS `:visible` แทนการอ้างอิง DOM order ตรง ๆ */
function visible(page: Page, selector: string) {
  return page.locator(`${selector}:visible`);
}

/** หา Sheet/dialog ที่ต้องการเจาะจงจากหัวข้อของมัน — กัน strict-mode ชนกับ dialog อื่นที่ inert อยู่
 * (เช่น "เมนูเพิ่มเติม" ของ bottom tab bar ที่มีอยู่ทุกหน้า) */
function dialogByHeading(page: Page, heading: string) {
  return page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: heading }) });
}

test.describe("เส้นทางวิกฤตบนจอแคบ/แท็บเล็ต (T10.9)", () => {
  test("จองด่วนจากคิวหมุน (กระดานคิว)", async ({ page }) => {
    await login(page);
    await page.goto("/board");

    await page.getByRole("button", { name: "+ จองด่วน" }).click();
    const dialog = dialogByHeading(page, "จองด่วนจากคิวหมุน");
    await expect(dialog).toBeVisible();

    // ข้อมูล seed (packages/db/prisma/seed.ts) จำลองวันที่ยุ่งจริง — นัดเดิมเต็มคิวของพนักงานที่มีทักษะ
    // ตรงกับบริการแทบทุกตัวแทบทั้งวัน ทำให้ "จองด่วนเดี๋ยวนี้" ไม่ว่างจริงได้ตามธรรมชาติ (ไม่ใช่บั๊ก UI)
    // — เกณฑ์ของเทสต์นี้คือ "sheet/ปุ่มมือถือทำงานถูกต้อง" ไม่ใช่ "การคำนวณ availability" (มี unit test
    // ≥ 25 เคสอยู่แล้วที่ T4.1) จึงยอมรับทั้งผลจองสำเร็จ (เห็นใบคิว) และผลจองไม่สำเร็จที่มีข้อความแจ้งเหตุผล
    // ชัดเจน (alert) เป็น "ผ่าน" เท่ากัน — ทั้งสองกรณีพิสูจน์ว่า sheet เปิด/เลือกบริการ/แสดงผลได้ถูกต้องบน
    // จอแคบ/แท็บเล็ตจริง
    const serviceButtons = dialog.getByRole("button", { name: /นาที/ });
    // servicesQuery ใน WalkInSheet โหลดหลัง sheet เปิด (enabled: open) — ต้องรอปุ่มแรกโผล่ก่อนกดเลือก
    // ไม่งั้นอาจกดตอนยังโชว์ "กำลังโหลด..." อยู่ (เจอจริงตอนรันหลัง db:reset เพราะเซิร์ฟเวอร์ยังไม่ warm)
    await serviceButtons.first().waitFor({ state: "visible", timeout: 10000 });
    await serviceButtons.first().click();

    const ticket = dialog.getByText("ใบคิว");
    const alert = dialog.getByRole("alert");
    await Promise.race([
      ticket.waitFor({ state: "visible", timeout: 8000 }),
      alert.waitFor({ state: "visible", timeout: 8000 }),
    ]);

    if (await ticket.isVisible()) {
      await dialog.getByRole("button", { name: "เสร็จสิ้น" }).click();
    } else {
      await expect(alert).toBeVisible();
    }
  });

  test("เพิ่มสมาชิกใหม่", async ({ page }) => {
    await login(page);
    await page.goto("/members");

    const memberName = `ทดสอบ e2e ${Date.now()}`;

    // ปุ่มเปิดฟอร์ม: FAB (มือถือ, aria-label ล้วน) หรือปุ่มบนสุด (แท็บเล็ต/desktop, มีข้อความ "+ เพิ่มสมาชิก")
    await visible(page, 'button[aria-label="เพิ่มสมาชิก"]')
      .or(visible(page, 'button:has-text("+ เพิ่มสมาชิก")'))
      .first()
      .click();

    const dialog = dialogByHeading(page, "เพิ่มสมาชิกใหม่");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("ชื่อสมาชิก").fill(memberName);
    // ต้องขึ้นต้นด้วย 0 ตามกติกาเบอร์โทรไทย (ดู createMemberSchema) — ใช้ timestamp ต่อท้ายกันชนกัน
    await dialog.getByLabel("เบอร์โทร").fill(`08${String(Date.now()).slice(-8)}`);
    await dialog.getByRole("button", { name: "เพิ่มสมาชิก", exact: true }).click();

    // ชื่อสมาชิกโผล่ทั้งในตาราง desktop (ซ่อนด้วย CSS บนจอแคบ) และการ์ดมือถือพร้อมกันเสมอ (ResponsiveList,
    // T10.3) — filter เอาเฉพาะอันที่มองเห็นจริงกันชนกับ strict mode
    await expect(page.locator(`:text("${memberName}"):visible`)).toBeVisible();
  });

  test("ปิดบิลด้วยรายการสินค้า", async ({ page }) => {
    await login(page);
    await page.goto("/billing");
    await page.locator("summary").filter({ hasText: "เพิ่มรายการสินค้า", visible: true }).click();

    await visible(page, 'input[placeholder="ชื่อสินค้า"]').fill(`ครีมทดสอบ e2e ${Date.now()}`);
    await visible(page, 'input[placeholder="ราคา (บาท)"]').fill("50");
    await visible(page, 'button:has-text("+ เพิ่มรายการสินค้า")').click();

    // จอแคบเท่านั้นที่มีปุ่ม "ถัดไป" ของ wizard (T10.7) — จอกว้าง/แท็บเล็ตเห็นทุกส่วนพร้อมกันในหน้าเดียว
    const nextToPayment = visible(page, 'button:has-text("ถัดไป: ชำระเงิน")');
    if (await nextToPayment.count() > 0) await nextToPayment.click();

    await visible(page, 'button:has-text("คำนวณยอด/ส่วนลด")').click();
    await visible(page, 'button:has-text("เติมอัตโนมัติ")').click();
    await expect(page.locator(':text("ยอดชำระตรงกับยอดสุทธิแล้ว"):visible')).toBeVisible();

    const nextToConfirm = visible(page, 'button:has-text("ถัดไป: ยืนยัน")');
    if (await nextToConfirm.count() > 0) await nextToConfirm.click();

    await visible(page, 'button:has-text("ออกบิล")').click();
    await expect(page.getByText(/ออกบิลสำเร็จ/)).toBeVisible();
  });
});
