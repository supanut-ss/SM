import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // pattern มาตรฐานของ Prisma กัน hot-reload เปิด connection ซ้ำตอน dev
  var __prisma: PrismaClient | undefined;
}

export const prisma = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
