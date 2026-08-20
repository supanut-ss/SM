import { describe, expect, it, vi } from "vitest";
import { of, firstValueFrom } from "rxjs";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { AuditAction } from "@lotus-desk/db";
import { AuditInterceptor } from "./audit.interceptor";
import type { PrismaService } from "../prisma/prisma.service";

function buildInterceptor(opts: {
  auditEntity: string | undefined;
  branchRecord: { id: string; name: string } | null;
  createSpy: ReturnType<typeof vi.fn>;
}) {
  const reflector = {
    get: vi.fn(() => opts.auditEntity),
  } as unknown as Reflector;

  const prisma = {
    client: {
      branch: {
        findUnique: vi.fn(() => Promise.resolve(opts.branchRecord)),
      },
      auditLog: {
        create: opts.createSpy,
      },
    },
  } as unknown as PrismaService;

  return { interceptor: new AuditInterceptor(reflector, prisma), prisma };
}

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildHandler(result: unknown): CallHandler {
  return { handle: () => of(result) };
}

describe("AuditInterceptor", () => {
  it("does nothing when the handler has no @AuditEntity", async () => {
    const createSpy = vi.fn();
    const { interceptor } = buildInterceptor({ auditEntity: undefined, branchRecord: null, createSpy });
    const context = buildContext({ method: "PATCH", params: {} });

    const result = await firstValueFrom(await interceptor.intercept(context, buildHandler({ ok: true })));

    expect(result).toEqual({ ok: true });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("does nothing for a GET even if @AuditEntity is somehow present (defensive)", async () => {
    const createSpy = vi.fn();
    const { interceptor } = buildInterceptor({ auditEntity: "Branch", branchRecord: null, createSpy });
    const context = buildContext({ method: "GET", params: { branchId: "b1" } });

    await firstValueFrom(await interceptor.intercept(context, buildHandler({ id: "b1" })));

    expect(createSpy).not.toHaveBeenCalled();
  });

  it("captures before (pre-fetched) and after (handler's return value) with a real diff", async () => {
    const createSpy = vi.fn((_data: { data: Record<string, unknown> }) => Promise.resolve({}));
    const { interceptor } = buildInterceptor({
      auditEntity: "Branch",
      branchRecord: { id: "b1", name: "ชื่อเดิม" },
      createSpy,
    });
    const context = buildContext({
      method: "PATCH",
      params: { branchId: "b1" },
      user: { sub: "user-1" },
      branchContext: { branchId: "b1", roleKey: "manager" },
      ip: "127.0.0.1",
      requestId: "req-123",
    });

    const after = { id: "b1", name: "ชื่อใหม่" };
    const result = await firstValueFrom(await interceptor.intercept(context, buildHandler(after)));

    expect(result).toEqual(after);
    expect(createSpy).toHaveBeenCalledTimes(1);
    const call = createSpy.mock.calls[0]![0];
    expect(call.data.action).toBe(AuditAction.UPDATE);
    expect(call.data.entity).toBe("Branch");
    expect(call.data.entityId).toBe("b1");
    expect(call.data.before).toEqual({ id: "b1", name: "ชื่อเดิม" });
    expect(call.data.after).toEqual({ id: "b1", name: "ชื่อใหม่" });
    expect(call.data.actorId).toBe("user-1");
    expect(call.data.branchId).toBe("b1");
    expect(call.data.ipAddress).toBe("127.0.0.1");
    expect(call.data.requestId).toBe("req-123");
  });

  it("maps POST to CREATE and falls back to after.id when there's no route param", async () => {
    const createSpy = vi.fn((_data: { data: Record<string, unknown> }) => Promise.resolve({}));
    const { interceptor } = buildInterceptor({ auditEntity: "Branch", branchRecord: null, createSpy });
    const context = buildContext({ method: "POST", params: {} });

    await firstValueFrom(
      await interceptor.intercept(context, buildHandler({ id: "new-branch-id", name: "ใหม่" })),
    );

    const call = createSpy.mock.calls[0]![0];
    expect(call.data.action).toBe(AuditAction.CREATE);
    expect(call.data.entityId).toBe("new-branch-id");
    expect(call.data.before).toBeUndefined();
  });

  it("maps DELETE to AuditAction.DELETE", async () => {
    const createSpy = vi.fn((_data: { data: Record<string, unknown> }) => Promise.resolve({}));
    const { interceptor } = buildInterceptor({
      auditEntity: "Branch",
      branchRecord: { id: "b1", name: "x" },
      createSpy,
    });
    const context = buildContext({ method: "DELETE", params: { branchId: "b1" } });

    await firstValueFrom(await interceptor.intercept(context, buildHandler({ id: "b1" })));

    expect(createSpy.mock.calls[0]![0].data.action).toBe(AuditAction.DELETE);
  });
});
