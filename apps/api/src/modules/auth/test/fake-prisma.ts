import { randomUUID } from "node:crypto";
import type { PrismaService } from "../../../prisma/prisma.service";

/**
 * Prisma แบบจำลองในหน่วยความจำ — ครอบเฉพาะ method ที่ AuthService เรียกจริง
 * ไม่ใช่ mock ของ Prisma ทั้งหมด เจตนาให้ unit test รันได้จริงโดยไม่ต้องมี Postgres
 * (การทดสอบกับ DB จริงอยู่ใน auth.e2e-spec.ts ผ่าน Testcontainers)
 */
export interface FakeUser {
  id: string;
  email: string;
  passwordHash: string | null;
  isActive: boolean;
}

export interface FakeRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export function createFakePrisma(users: FakeUser[] = []) {
  const userStore = [...users];
  const refreshTokenStore: FakeRefreshToken[] = [];

  const client = {
    user: {
      findUnique: ({ where }: { where: { email: string } }) =>
        Promise.resolve(userStore.find((u) => u.email === where.email) ?? null),
    },
    refreshToken: {
      create: ({ data }: { data: Omit<FakeRefreshToken, "id" | "revokedAt" | "replacedById"> }) => {
        const record: FakeRefreshToken = {
          id: randomUUID(),
          revokedAt: null,
          replacedById: null,
          ...data,
        };
        refreshTokenStore.push(record);
        return Promise.resolve(record);
      },
      findUnique: ({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(refreshTokenStore.find((t) => t.tokenHash === where.tokenHash) ?? null),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRefreshToken>;
      }) => {
        const record = refreshTokenStore.find((t) => t.id === where.id);
        if (!record) throw new Error("record not found");
        Object.assign(record, data);
        return Promise.resolve(record);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { familyId?: string; userId?: string; revokedAt: null };
        data: Partial<FakeRefreshToken>;
      }) => {
        const matches = refreshTokenStore.filter(
          (t) =>
            (where.familyId === undefined || t.familyId === where.familyId) &&
            (where.userId === undefined || t.userId === where.userId) &&
            t.revokedAt === where.revokedAt,
        );
        for (const record of matches) Object.assign(record, data);
        return Promise.resolve({ count: matches.length });
      },
    },
  };

  return {
    prismaService: { client } as unknown as PrismaService,
    userStore,
    refreshTokenStore,
  };
}
