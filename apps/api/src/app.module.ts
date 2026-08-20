import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { validateEnv } from "./config/validate-env";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // "../../.env" = root .env ตอนรันจาก apps/api (cwd ปกติของ nest start/dist/main.js)
      // ".env" = เผื่อกรณีรันจากราก repo โดยตรง
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
