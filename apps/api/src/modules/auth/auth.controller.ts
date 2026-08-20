import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { loginSchema, pinLoginSchema, type LoginInput, type PinLoginInput } from "@lotus-desk/contracts";
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

  @Post("pin-login")
  @HttpCode(200)
  async pinLogin(
    @Body(new ZodValidationPipe(pinLoginSchema)) body: PinLoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken } = await this.authService.pinLogin(body.deviceId, body.userId, body.pin);
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: PIN_SESSION_MAX_AGE_MS,
      path: "/",
    });
    return { ok: true };
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

  private setTokenCookies(res: Response, tokens: TokenPair): void {
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
      path: "/",
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
      path: "/",
    });
  }

  private clearTokenCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
  }
}
