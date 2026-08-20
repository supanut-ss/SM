import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../../config/env.schema";

const DEV_ENV: Env = {
  NODE_ENV: "test",
  PORT: 3001,
  DATABASE_URL: "postgresql://fake:fake@localhost:5432/fake",
  REDIS_URL: "redis://localhost:6379",
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters-long",
  JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters-long",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "30d",
};

export function createFakeConfig(overrides: Partial<Env> = {}): ConfigService<Env, true> {
  const values = { ...DEV_ENV, ...overrides };
  return {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env, true>;
}
