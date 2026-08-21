import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { validateEnv } from "./config/validate-env";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { BranchModule } from "./modules/branch/branch.module";
import { StaffModule } from "./modules/staff/staff.module";
import { RoomModule } from "./modules/room/room.module";
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // "../../.env" = root .env ตอนรันจาก apps/api (cwd ปกติของ nest start/dist/main.js)
      // ".env" = เผื่อกรณีรันจากราก repo โดยตรง
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    RbacModule,
    AuditModule,
    BranchModule,
    StaffModule,
    RoomModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
