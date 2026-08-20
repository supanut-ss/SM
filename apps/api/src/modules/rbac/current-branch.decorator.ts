import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { BranchContext } from "./permission.guard";

/** อ่าน branchContext ที่ PermissionGuard ตั้งไว้ — ใช้ได้เฉพาะ route ที่มี @RequirePermission เท่านั้น */
export const CurrentBranch = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BranchContext => {
    const request = ctx.switchToHttp().getRequest<Request & { branchContext: BranchContext }>();
    return request.branchContext;
  },
);
