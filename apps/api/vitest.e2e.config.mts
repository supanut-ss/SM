import { defineConfig } from "vitest/config";

// integration test ตัวเต็ม — ต้องมี Docker (Testcontainers) ใช้เวลานานกว่า unit test มาก
// pnpm --filter @lotus-desk/api test:e2e
export default defineConfig({
  test: {
    include: ["**/*.e2e-spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
