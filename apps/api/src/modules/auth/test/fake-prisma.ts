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
  pinHash: string | null;
  pinFailedAttempts: number;
  pinLockedUntil: Date | null;
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

export interface FakeDevice {
  id: string;
  branchId: string;
  isActive: boolean;
}

export interface FakeUserBranch {
  userId: string;
  branchId: string;
  roleId: string;
}

export function createFakePrisma(
  users: FakeUser[] = [],
  devices: FakeDevice[] = [],
  userBranches: FakeUserBranch[] = [],
) {
  const userStore = users.map((u) => ({ ...u }));
  const refreshTokenStore: FakeRefreshToken[] = [];
  const deviceStore = [...devices];
  const userBranchStore = [...userBranches];

  const client = {
    user: {
      findUnique: ({ where }: { where: { email?: string; id?: string } }) =>
        Promise.resolve(
          userStore.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ??
            null,
        ),
      update: ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const user = userStore.find((u) => u.id === where.id);
        if (!user) throw new Error("user not found");
        Object.assign(user, data);
        return Promise.resolve(user);
      },
    },
    device: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(deviceStore.find((d) => d.id === where.id) ?? null),
    },
    userBranch: {
      findUnique: ({ where }: { where: { userId_branchId: { userId: string; branchId: string } } }) =>
        Promise.resolve(
          userBranchStore.find(
            (ub) =>
              ub.userId === where.userId_branchId.userId &&
              ub.branchId === where.userId_branchId.branchId,
          ) ?? null,
        ),
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
    deviceStore,
    userBranchStore,
  };
}
