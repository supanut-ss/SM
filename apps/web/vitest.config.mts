import { defineConfig } from "vitest/config";

// unit test เท่านั้น — Playwright e2e อยู่แยกที่ apps/web/e2e/ (pnpm test:e2e) ใช้ @playwright/test
// ไม่ใช่ Vitest ต้อง exclude ไว้ไม่งั้น `vitest run` จะพยายามรันไฟล์เหล่านั้นด้วย test runner ผิดตัว
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
  },
});
