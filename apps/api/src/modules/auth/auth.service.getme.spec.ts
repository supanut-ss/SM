import { describe, expect, it } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { createFakeConfig } from "./test/fake-config";
import type { PrismaService } from "../../prisma/prisma.service";

function buildServiceWithUser(userWithBranches: unknown) {
  const prisma = {
    client: {
      user: {
        findUnique: () => Promise.resolve(userWithBranches),
      },
    },
  } as unknown as PrismaService;

  return new AuthService(prisma, new JwtService(), createFakeConfig());
}

describe("AuthService.getMe", () => {
  it("flattens branch/role/permissions into the shape the frontend needs for menu visibility", async () => {
    const service = buildServiceWithUser({
      id: "user-1",
      email: "staff@lotusdesk.local",
      name: "พนักงาน",
      branches: [
        {
          branchId: "branch-a",
          branch: { name: "สาขาหลัก", code: "MAIN" },
          role: {
            key: "staff",
            name: "พนักงานบริการ",
            permissions: [
              { permission: { key: "booking:view" } },
              { permission: { key: "attendance:manage" } },
            ],
          },
        },
      ],
    });

    const result = await service.getMe("user-1");

    expect(result).toEqual({
      id: "user-1",
      email: "staff@lotusdesk.local",
      name: "พนักงาน",
      branches: [
        {
          branchId: "branch-a",
          branchName: "สาขาหลัก",
          branchCode: "MAIN",
          roleKey: "staff",
          roleName: "พนักงานบริการ",
          permissions: ["booking:view", "attendance:manage"],
        },
      ],
    });
  });

  it("rejects when the user no longer exists", async () => {
    const service = buildServiceWithUser(null);

    await expect(service.getMe("gone")).rejects.toThrow(UnauthorizedException);
  });

  it("returns an empty branches array for a user with no UserBranch rows", async () => {
    const service = buildServiceWithUser({
      id: "user-1",
      email: "nobody@lotusdesk.local",
      name: "ไม่มีสาขา",
      branches: [],
    });

    const result = await service.getMe("user-1");

    expect(result.branches).toEqual([]);
  });
});
