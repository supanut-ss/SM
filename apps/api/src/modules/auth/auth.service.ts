import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type { User } from "@lotus-desk/db";
import { PrismaService } from "../../prisma/prisma.service";
import type { Env } from "../../config/env.schema";
import {
  hashToken,
  PIN_LOCKOUT_MS,
  PIN_MAX_ATTEMPTS,
  PIN_SESSION_MAX_AGE_MS,
  REFRESH_TOKEN_MAX_AGE_MS,
} from "./token.util";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface AccessTokenPayload {
  sub: string;
}

interface PinAccessTokenPayload {
  sub: string;
  branchId: string;
  deviceId: string;
  via: "pin";
}

interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string;
}

/** โยนตอนพบว่า refresh token ที่ถูกเพิกถอนไปแล้วถูกใช้ซ้ำ — สัญญาณว่า token รั่วไหล */
export class RefreshTokenReuseException extends UnauthorizedException {
  constructor() {
    super("ตรวจพบการใช้ refresh token ซ้ำ — เพิกถอนสิทธิ์ทั้งหมดในสายนี้แล้ว กรุณาเข้าสู่ระบบใหม่");
  }
}

/** โยนตอน PIN ถูกล็อกอยู่ (ผิดครบ 5 ครั้งติดกัน) — 429 ไม่ใช่ 401 เพราะเป็นเรื่อง rate/lockout ไม่ใช่ credential ผิด */
export class PinLockedException extends HttpException {
  constructor(public readonly lockedUntil: Date) {
    super(
      {
        message: `PIN ถูกล็อกชั่วคราวเพราะกรอกผิดครบ ${PIN_MAX_ATTEMPTS} ครั้ง — ลองใหม่ได้หลัง ${lockedUntil.toLocaleTimeString("th-TH")}`,
        lockedUntil: lockedUntil.toISOString(),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !user.passwordHash) {
      return null;
    }
    const valid = await argon2.verify(user.passwordHash, password);
    return valid ? user : null;
  }

  /** เริ่มสาย (family) ใหม่ทั้งหมด — เรียกตอน login สำเร็จเท่านั้น */
  async login(userId: string, meta: RequestMeta = {}): Promise<TokenPair> {
    const { tokens } = await this.issueTokenPair(userId, randomUUID(), meta);
    return tokens;
  }

  /**
   * PIN login เครื่องหน้าร้าน (T1.3) — ผูกกับ device ที่ผูกกับสาขาตายตัว
   * ไม่มี refresh token: session สั้น (8 ชม.) หมดแล้วต้องกด PIN ใหม่ ไม่หมุนต่อเนื่องแบบ web login
   * ผิดครบ PIN_MAX_ATTEMPTS ครั้งติดกัน -> ล็อก PIN_LOCKOUT_MS แล้วปลดล็อกอัตโนมัติเมื่อเวลาผ่านไป
   */
  async pinLogin(deviceId: string, userId: string, pin: string): Promise<{ accessToken: string }> {
    const device = await this.prisma.client.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.isActive) {
      throw new UnauthorizedException("ไม่พบอุปกรณ์นี้ในระบบ หรืออุปกรณ์ถูกปิดใช้งาน");
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.pinHash) {
      throw new UnauthorizedException("ผู้ใช้นี้ไม่พร้อมใช้งาน PIN login");
    }

    const userBranch = await this.prisma.client.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId: device.branchId } },
    });
    if (!userBranch) {
      throw new UnauthorizedException("ผู้ใช้นี้ไม่ได้สังกัดสาขาของอุปกรณ์นี้");
    }

    if (user.pinLockedUntil && user.pinLockedUntil.getTime() > Date.now()) {
      throw new PinLockedException(user.pinLockedUntil);
    }

    const valid = await argon2.verify(user.pinHash, pin);
    if (!valid) {
      const attempts = user.pinFailedAttempts + 1;
      if (attempts >= PIN_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS);
        await this.prisma.client.user.update({
          where: { id: userId },
          data: { pinFailedAttempts: 0, pinLockedUntil: lockedUntil },
        });
        throw new PinLockedException(lockedUntil);
      }
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { pinFailedAttempts: attempts },
      });
      throw new UnauthorizedException(
        `PIN ไม่ถูกต้อง (เหลืออีก ${PIN_MAX_ATTEMPTS - attempts} ครั้งก่อนถูกล็อกชั่วคราว)`,
      );
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });

    const accessToken = this.jwt.sign(
      { sub: userId, branchId: device.branchId, deviceId, via: "pin" } satisfies PinAccessTokenPayload,
      {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
        expiresIn: PIN_SESSION_MAX_AGE_MS / 1000,
      },
    );

    return { accessToken };
  }

  /**
   * หมุน refresh token: verify -> ตรวจ reuse -> เพิกถอนตัวเก่า -> ออกคู่ใหม่ในสายเดิม
   * ถ้า token ที่ส่งมาถูกเพิกถอนไปแล้ว (revokedAt ไม่ null) แปลว่ามีคนใช้ token ที่ใช้ไปแล้วซ้ำ
   * ต้องเพิกถอนทั้งสาย (family) ทันทีเพราะแปลว่า token หลุดไปอยู่ในมือคนอื่น
   */
  async refresh(rawRefreshToken: string, meta: RequestMeta = {}): Promise<TokenPair> {
    const payload = this.verifyRefreshToken(rawRefreshToken);
    const tokenHash = hashToken(rawRefreshToken);
    const record = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.userId !== payload.sub || record.familyId !== payload.familyId) {
      throw new UnauthorizedException("refresh token ไม่ถูกต้อง");
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("refresh token หมดอายุ");
    }

    if (record.revokedAt) {
      await this.revokeFamily(record.familyId);
      throw new RefreshTokenReuseException();
    }

    const { tokens, record: newRecord } = await this.issueTokenPair(
      payload.sub,
      payload.familyId,
      meta,
    );
    await this.prisma.client.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: newRecord.id },
    });

    return tokens;
  }

  /** ออกจากระบบเครื่องนี้ — เพิกถอนทั้งสายที่ refresh token นี้อยู่ (กัน token เก่าที่ยังไม่หมดอายุใช้ต่อได้) */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    const record = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } });
    if (!record) return;
    await this.revokeFamily(record.familyId);
  }

  /** ออกจากระบบทุกอุปกรณ์ — เพิกถอนทุกสายของผู้ใช้คนนี้ */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.client.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private verifyRefreshToken(rawRefreshToken: string): RefreshTokenPayload {
    try {
      return this.jwt.verify<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException("refresh token ไม่ถูกต้องหรือหมดอายุ");
    }
  }

  private async issueTokenPair(
    userId: string,
    familyId: string,
    meta: RequestMeta,
  ): Promise<{ tokens: TokenPair; record: { id: string } }> {
    const accessPayload: AccessTokenPayload = { sub: userId };
    const refreshPayload: RefreshTokenPayload = { sub: userId, familyId, jti: randomUUID() };

    const accessToken = this.jwt.sign(accessPayload, {
      secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      expiresIn: this.config.get("JWT_ACCESS_EXPIRES_IN", { infer: true }),
    });
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
      expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", { infer: true }),
    });

    const record = await this.prisma.client.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return { tokens: { accessToken, refreshToken }, record };
  }
}
