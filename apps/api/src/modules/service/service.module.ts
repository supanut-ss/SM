import { Module } from "@nestjs/common";
import { ServiceController } from "./service.controller";
import { ServiceCategoryController } from "./service-category.controller";

// ไม่ต้อง import AuthModule/RbacModule — ทั้งคู่เป็น @Global() (ดู ADR-006)
@Module({
  controllers: [ServiceController, ServiceCategoryController],
})
export class ServiceModule {}
