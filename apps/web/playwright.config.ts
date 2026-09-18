import { defineConfig, devices } from "@playwright/test";

// ต้องมี apps/web + apps/api + Postgres (seed แล้ว) รันอยู่จริงก่อนรัน — ดู e2e/README.md
// pnpm --filter @lotus-desk/web test:e2e
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // T10.9 — เส้นทางวิกฤตที่ viewport มือถือ/แท็บเล็ต (ดู docs/DESIGN.md §9.1) จำกัดด้วย testMatch
    // ให้รันเฉพาะ mobile-critical-paths.spec.ts เพราะสเปกเดิม (login-menu-logout.spec.ts) อ้างอิง
    // โครงสร้างเมนู desktop ล้วน ๆ (เช่น sidebar aria-label เดียวกับ bottom tab bar แต่รายการเมนูไม่
    // เท่ากันระหว่างสองมุมมอง) ไม่ได้ออกแบบมาให้ทนต่อ breakpoint เปลี่ยน
    {
      name: "mobile-375",
      testMatch: /mobile-critical-paths\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "tablet-768",
      testMatch: /mobile-critical-paths\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
  ],
});
