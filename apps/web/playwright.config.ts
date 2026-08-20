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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
