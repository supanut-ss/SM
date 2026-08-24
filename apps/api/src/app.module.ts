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
import { ServiceModule } from "./modules/service/service.module";
import { ShiftModule } from "./modules/shift/shift.module";
import { MemberModule } from "./modules/member/member.module";
import { BookingModule } from "./modules/booking/booking.module";
import { PackageModule } from "./modules/package/package.module";
import { MemberPackageModule } from "./modules/member-package/member-package.module";
import { PromotionModule } from "./modules/promotion/promotion.module";
import { BillModule } from "./modules/bill/bill.module";
import { CashierShiftModule } from "./modules/cashier-shift/cashier-shift.module";
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
    ServiceModule,
    ShiftModule,
    MemberModule,
    BookingModule,
    PackageModule,
    MemberPackageModule,
    PromotionModule,
    BillModule,
    CashierShiftModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
