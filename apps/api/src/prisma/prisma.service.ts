import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { prisma, type PrismaClient } from "@lotus-desk/db";
import { withBranchScope } from "./branch-scope.extension";

/**
 * ห่อ singleton PrismaClient จาก @lotus-desk/db ให้เป็น Nest provider ที่ inject ได้
 * และแทนที่ด้วย mock ได้ตอน unit test (ดู modules/auth/test/*.spec.ts)
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient = prisma;

  onModuleInit(): void {
    if (!process.env.APP_DATABASE_URL) {
      this.logger.warn(
        "ไม่ได้ตั้ง APP_DATABASE_URL — แอปกำลังต่อ DB ด้วย role เจ้าของตาราง การป้องกัน " +
          "UPDATE/DELETE บน audit_logs ที่ระดับ DB (T1.5) จะไม่มีผลจริง ดู .env.example",
      );
    }
  }

  /**
   * ใช้หลัง PermissionGuard ยืนยัน branchId แล้วเท่านั้น (ดึงจาก request.branchContext ผ่าน
   * @CurrentBranch()) — คืน client ที่กรอง branchId อัตโนมัติให้โมเดลใน BRANCH_SCOPED_MODELS
   * เจตนาให้เรียกต่อ request ไม่ cache ไว้ข้าม request เพราะ branchId เปลี่ยนทุกครั้ง
   */
  forBranch(branchId: string): PrismaClient {
    return withBranchScope(this.client, branchId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
