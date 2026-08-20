import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { from, type Observable } from "rxjs";
import { mergeMap, map } from "rxjs/operators";
import { AuditAction } from "@lotus-desk/db";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../modules/auth/jwt-auth.guard";
import type { BranchContext } from "../modules/rbac/permission.guard";
import { AUDIT_ENTITY_KEY } from "./audit-entity.decorator";
import { AUDIT_ENTITY_FETCHERS } from "./audit-entity-fetchers";

type AuditRequest = Request & {
  user?: AuthenticatedUser;
  branchContext?: BranchContext;
  requestId?: string;
};

/** Prisma model results มี Date/Decimal ฯลฯ ที่ไม่ใช่ JSON ดิบ — แปลงให้ปลอดภัยก่อนเก็บลง Json column */
function toJsonSafe(value: unknown): object | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
}

const METHOD_TO_ACTION: Partial<Record<string, AuditAction>> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

/**
 * global interceptor (ดู audit.module.ts) — ทุก request ผ่านตัวนี้เสมอตาม CLAUDE.md ข้อ 6
 * ("ทุก mutation ต้องผ่าน AuditInterceptor — ห้ามเขียน service ที่เลี่ยง") แต่จะ "ไม่ทำอะไร" เลย
 * ถ้า handler ไม่มี @AuditEntity ประกาศไว้ — handler ใหม่แค่แปะ decorator ก็ได้ audit log ฟรี
 * ไม่ต้องจำไปเขียน service เขียน log เอง (ซึ่งเป็นจุดที่คนมักลืม/เลี่ยงถ้าไม่บังคับแบบนี้)
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const entity = this.reflector.get<string | undefined>(AUDIT_ENTITY_KEY, context.getHandler());
    if (!entity) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const action = METHOD_TO_ACTION[request.method];
    if (!action) {
      return next.handle();
    }

    const paramName = `${entity.charAt(0).toLowerCase()}${entity.slice(1)}Id`;
    const rawParam = request.params?.[paramName];
    const entityIdFromParams = typeof rawParam === "string" ? rawParam : undefined;
    const fetcher = AUDIT_ENTITY_FETCHERS[entity];
    const before =
      entityIdFromParams && fetcher ? await fetcher(entityIdFromParams, this.prisma) : null;

    return next.handle().pipe(
      mergeMap((after: unknown) => {
        const entityId =
          entityIdFromParams ?? (after as { id?: string } | undefined)?.id ?? "unknown";

        return from(
          this.prisma.client.auditLog.create({
            data: {
              branchId: request.branchContext?.branchId,
              actorId: request.user?.sub,
              action,
              entity,
              entityId,
              before: toJsonSafe(before),
              after: toJsonSafe(after),
              ipAddress: request.ip,
              requestId: request.requestId,
            },
          }),
        ).pipe(map(() => after));
      }),
    );
  }
}
