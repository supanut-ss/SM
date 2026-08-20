import { describe, expect, it, vi } from "vitest";
import { BadRequestException, ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { PermissionGuard } from "./permission.guard";
import { REQUIRE_PERMISSION_KEY, type RequiredPermission } from "./require-permission.decorator";
import type { PrismaService } from "../../prisma/prisma.service";

interface FakeUserBranchRow {
  userId: string;
  branchId: string;
  role: { key: string; permissions: Array<{ permission: { key: string } }> };
}

function buildGuard(rows: FakeUserBranchRow[], required: RequiredPermission | undefined) {
  const reflector = {
    get: vi.fn((key: string) => (key === REQUIRE_PERMISSION_KEY ? required : undefined)),
  } as unknown as Reflector;

  const prisma = {
    client: {
      userBranch: {
        findUnique: ({
          where,
        }: {
          where: { userId_branchId: { userId: string; branchId: string } };
        }) =>
          Promise.resolve(
            rows.find(
              (r) =>
                r.userId === where.userId_branchId.userId &&
                r.branchId === where.userId_branchId.branchId,
            ) ?? null,
          ),
      },
    },
  } as unknown as PrismaService;

  return new PermissionGuard(reflector, prisma);
}

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const MANAGER_AT_BRANCH_A: FakeUserBranchRow = {
  userId: "user-manager",
  branchId: "branch-a",
  role: { key: "manager", permissions: [{ permission: { key: "branch:view" } }] },
};

describe("PermissionGuard", () => {
  it("allows the request through when no @RequirePermission is declared on the handler", async () => {
    const guard = buildGuard([], undefined);
    const context = buildContext({ user: { sub: "user-manager" }, params: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects when there's no authenticated user on the request", async () => {
    const guard = buildGuard([MANAGER_AT_BRANCH_A], { action: "view", resource: "branch" });
    const context = buildContext({ params: { branchId: "branch-a" } });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("rejects with 400 when the request doesn't identify a branch at all", async () => {
    const guard = buildGuard([MANAGER_AT_BRANCH_A], { action: "view", resource: "branch" });
    const context = buildContext({ user: { sub: "user-manager" }, params: {}, headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it("THE core scenario: a branch-A manager requesting branch-B data gets 403", async () => {
    const guard = buildGuard([MANAGER_AT_BRANCH_A], { action: "view", resource: "branch" });
    const context = buildContext({
      user: { sub: "user-manager" },
      params: { branchId: "branch-b" }, // สาขา B — manager คนนี้ไม่มี UserBranch ที่นี่เลย
      headers: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("resolves the branch from the x-branch-id header when there's no route param", async () => {
    const guard = buildGuard([MANAGER_AT_BRANCH_A], { action: "view", resource: "branch" });
    const context = buildContext({
      user: { sub: "user-manager" },
      params: {},
      headers: { "x-branch-id": "branch-a" },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects when the user's role at that branch lacks the required permission", async () => {
    const cashierAtBranchA: FakeUserBranchRow = {
      userId: "user-cashier",
      branchId: "branch-a",
      role: { key: "cashier", permissions: [{ permission: { key: "booking:manage" } }] },
    };
    const guard = buildGuard([cashierAtBranchA], { action: "manage", resource: "settings" });
    const context = buildContext({
      user: { sub: "user-cashier" },
      params: { branchId: "branch-a" },
      headers: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it("allows the request and attaches branchContext when the role has the permission", async () => {
    const guard = buildGuard([MANAGER_AT_BRANCH_A], { action: "view", resource: "branch" });
    const request: Record<string, unknown> = {
      user: { sub: "user-manager" },
      params: { branchId: "branch-a" },
      headers: {},
    };
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.branchContext).toEqual({ branchId: "branch-a", roleKey: "manager" });
  });
});
