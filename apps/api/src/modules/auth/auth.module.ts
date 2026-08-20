import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

// @Global เพราะ JwtAuthGuard เป็น infrastructure ข้าม module — ทุก feature module ในอนาคต
// (T1.5, T1.6, T2.x เป็นต้นไป) ต้องใช้ @UseGuards(JwtAuthGuard, ...) ได้โดยไม่ต้อง import AuthModule ทุกที่
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // ต้อง re-export JwtModule ด้วย ไม่ใช่แค่ JwtAuthGuard — เวลา module อื่นใช้ @UseGuards(JwtAuthGuard)
  // Nest resolve constructor deps ของ guard นั้นใหม่ในบริบทของ module ที่เรียกใช้ ถ้าไม่ export
  // JwtModule (= JwtService) มาด้วย จะหา JwtService ไม่เจอแม้ AuthModule จะเป็น @Global() แล้วก็ตาม
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
