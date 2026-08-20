import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { Env } from "./config/env.schema";

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get("PORT", { infer: true }));
}

void bootstrap();
