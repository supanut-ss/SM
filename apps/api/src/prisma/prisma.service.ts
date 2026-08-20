import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { prisma, type PrismaClient } from "@lotus-desk/db";

/**
 * ห่อ singleton PrismaClient จาก @lotus-desk/db ให้เป็น Nest provider ที่ inject ได้
 * และแทนที่ด้วย mock ได้ตอน unit test (ดู modules/auth/test/*.spec.ts)
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient = prisma;

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
