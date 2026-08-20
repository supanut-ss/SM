import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { Env } from "../../config/env.schema";
import { ACCESS_TOKEN_COOKIE } from "./token.util";

export interface AuthenticatedUser {
  sub: string;
}

/**
 * ตรวจ access_token cookie แบบง่าย ๆ (ไม่ใช้ Passport เพื่อลด dependency)
 * T1.4 จะต่อยอดด้วย CASL + @RequirePermission() บน guard ตัวนี้
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token: unknown = request.cookies?.[ACCESS_TOKEN_COOKIE];

    if (typeof token !== "string" || token.length === 0) {
      throw new UnauthorizedException("ไม่พบ access token — กรุณาเข้าสู่ระบบ");
    }

    try {
      const payload = this.jwt.verify<AuthenticatedUser>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("access token ไม่ถูกต้องหรือหมดอายุ");
    }
  }
}
