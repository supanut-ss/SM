import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import {
  loginSchema,
  pinLoginSchema,
  verifyManagerPinSchema,
  type LoginInput,
  type PinLoginInput,
  type VerifyManagerPinInput,
} from "@lotus-desk/contracts";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { Env } from "../../config/env.schema";
import { AuthService, type TokenPair } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { JwtAuthGuard, type AuthenticatedUser } from "./jwt-auth.guard";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  PIN_SESSION_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "./token.util";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateCredentials(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    const tokens = await this.authService.login(user.id, this.requestMeta(req));
    this.setTokenCookies(res, tokens);

    return { id: user.id, email: user.email, name: user.name };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.sub);
  }

  @Post("pin-login")
  @HttpCode(200)
  async pinLogin(
    @Body(new ZodValidationPipe(pinLoginSchema)) body: PinLoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.authService.pinLogin(body.deviceId, body.userId, body.pin);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...this.cookieOptions(),
      maxAge: PIN_SESSION_MAX_AGE_MS,
    });
    return { ok: true };
  }

  /**
   * ยืนยัน PIN ผู้จัดการแบบ one-off (T5.6) — ใช้จากเว็บปกติ (แคชเชียร์ login ค้างอยู่แล้ว ผู้จัดการแค่
   * มากรอก PIN ยืนยัน) ต้อง login อยู่แล้วถึงเรียกได้ (JwtAuthGuard) แต่ผู้ยืนยัน PIN ไม่ต้องเป็นคนเดียวกับ
   * ที่ login อยู่ — คืน approvalToken อายุสั้นมากไปแนบกับ endpoint อื่นที่ต้องมี PIN ผู้จัดการ
   */
  @Post("verify-manager-pin")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async verifyManagerPin(
    @Body(new ZodValidationPipe(verifyManagerPinSchema)) body: VerifyManagerPinInput,
  ) {
    return this.authService.verifyManagerPin(body.branchId, body.userId, body.pin);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = this.readRefreshCookie(req);
    const tokens = await this.authService.refresh(rawRefreshToken, this.requestMeta(req));
    this.setTokenCookies(res, tokens);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }
    this.clearTokenCookies(res);
    return { ok: true };
  }

  @Post("logout-all")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.sub);
    this.clearTokenCookies(res);
    return { ok: true };
  }

  private readRefreshCookie(req: Request): string {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedException("ไม่พบ refresh token");
    }
    return token;
  }

  private requestMeta(req: Request) {
    return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
  }

  /**
   * ตัวเลือก cookie ร่วม — ใส่ `domain` เฉพาะตอนตั้ง `COOKIE_DOMAIN` ไว้ (เช่น ".drivetodev.online")
   * เพื่อให้ apps/web กับ apps/api ที่อยู่คนละ subdomain ใช้ cookie เดียวกันได้ (ดู ADR-055) ไม่ตั้งไว้
   * = host-only cookie ปกติ (ใช้ตอน local dev ที่ apps/web เรียกผ่าน rewrite แบบ same-origin)
   */
  private cookieOptions() {
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    const domain = this.config.get("COOKIE_DOMAIN", { infer: true });
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      path: "/",
      ...(domain ? { domain } : {}),
    };
  }

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...this.cookieOptions(),
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }

  private clearTokenCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
  }
}
