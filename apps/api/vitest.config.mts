import { defineConfig } from "vitest/config";

// unit test เท่านั้น (mock/fake ไม่แตะ DB จริง) — รันเร็ว ไม่ต้องมี Docker
// integration test แบบเต็มอยู่ที่ vitest.e2e.config.ts (pnpm test:e2e)
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.e2e-spec.ts"],
  },
});
