import { describe, expect, it } from "vitest";
import { JwtService } from "@nestjs/jwt";
import { UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import { AuthService, RefreshTokenReuseException } from "./auth.service";
import { createFakePrisma, type FakeUser } from "./test/fake-prisma";
import { createFakeConfig } from "./test/fake-config";

async function buildService(users: FakeUser[] = []) {
  const { prismaService, refreshTokenStore } = createFakePrisma(users);
  const service = new AuthService(prismaService, new JwtService(), createFakeConfig());
  return { service, refreshTokenStore };
}

async function makeUser(email: string, password: string, overrides: Partial<FakeUser> = {}): Promise<FakeUser> {
  return {
    id: `user-${email}`,
    email,
    passwordHash: await argon2.hash(password),
    isActive: true,
    ...overrides,
  };
}

describe("AuthService.validateCredentials", () => {
  it("returns the user when email and password are correct", async () => {
    const user = await makeUser("owner@lotusdesk.local", "correct-password");
    const { service } = await buildService([user]);

    const result = await service.validateCredentials("owner@lotusdesk.local", "correct-password");

    expect(result?.email).toBe("owner@lotusdesk.local");
  });

  it("returns null when the password is wrong", async () => {
    const user = await makeUser("owner@lotusdesk.local", "correct-password");
    const { service } = await buildService([user]);

    const result = await service.validateCredentials("owner@lotusdesk.local", "wrong-password");

    expect(result).toBeNull();
  });

  it("returns null when the email doesn't exist", async () => {
    const { service } = await buildService([]);

    const result = await service.validateCredentials("nobody@lotusdesk.local", "anything");

    expect(result).toBeNull();
  });

  it("returns null when the user is deactivated", async () => {
    const user = await makeUser("owner@lotusdesk.local", "correct-password", { isActive: false });
    const { service } = await buildService([user]);

    const result = await service.validateCredentials("owner@lotusdesk.local", "correct-password");

    expect(result).toBeNull();
  });
});

describe("AuthService.login", () => {
  it("issues an access + refresh token pair and stores the refresh token hashed", async () => {
    const { service, refreshTokenStore } = await buildService();

    const tokens = await service.login("user-1");

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(refreshTokenStore).toHaveLength(1);
    expect(refreshTokenStore[0]!.tokenHash).not.toBe(tokens.refreshToken);
  });
});

describe("AuthService.refresh — rotation", () => {
  it("rotates the token: issues a new pair and revokes the old one", async () => {
    const { service, refreshTokenStore } = await buildService();
    const { refreshToken: oldToken } = await service.login("user-1");

    const newTokens = await service.refresh(oldToken);

    expect(newTokens.refreshToken).not.toBe(oldToken);
    expect(refreshTokenStore).toHaveLength(2);
    const oldRecord = refreshTokenStore.find((t) => t.id !== refreshTokenStore[1]!.id)!;
    expect(oldRecord.revokedAt).not.toBeNull();
    expect(oldRecord.replacedById).toBe(refreshTokenStore[1]!.id);
  });

  it("keeps the new token in the same family as the original login", async () => {
    const { service, refreshTokenStore } = await buildService();
    const { refreshToken: oldToken } = await service.login("user-1");
    const originalFamily = refreshTokenStore[0]!.familyId;

    await service.refresh(oldToken);

    expect(refreshTokenStore[1]!.familyId).toBe(originalFamily);
  });

  it("rejects a garbage/invalid token", async () => {
    const { service } = await buildService();

    await expect(service.refresh("not-a-real-token")).rejects.toThrow(UnauthorizedException);
  });
});

describe("AuthService.refresh — reuse detection", () => {
  it("revokes the ENTIRE family when a used (already-rotated) token is replayed", async () => {
    const { service, refreshTokenStore } = await buildService();
    const { refreshToken: token1 } = await service.login("user-1");
    const token2Pair = await service.refresh(token1); // rotates: token1 revoked, token2 issued
    await service.refresh(token2Pair.refreshToken); // rotates again: token2 revoked, token3 issued

    // แนบเนียนแบบ attacker: เอา token1 (ถูกเพิกถอนไปแล้ว) กลับมาใช้ซ้ำ
    await expect(service.refresh(token1)).rejects.toThrow(RefreshTokenReuseException);

    // ทั้งสาย (family) ต้องถูกเพิกถอนหมด รวมถึง token3 ที่เพิ่งออกและยังไม่หมดอายุด้วย
    expect(refreshTokenStore).toHaveLength(3);
    for (const record of refreshTokenStore) {
      expect(record.revokedAt).not.toBeNull();
    }
  });

  it("a revoked family's newest token can no longer be refreshed either", async () => {
    const { service } = await buildService();
    const { refreshToken: token1 } = await service.login("user-1");
    const { refreshToken: token2 } = await service.refresh(token1);

    await expect(service.refresh(token1)).rejects.toThrow(RefreshTokenReuseException);

    // token2 (ยังไม่หมดอายุ) ก็ต้องใช้ไม่ได้แล้วเพราะทั้งสายถูกเพิกถอนไปพร้อมกัน
    await expect(service.refresh(token2)).rejects.toThrow(RefreshTokenReuseException);
  });
});

describe("AuthService.logout / logoutAll", () => {
  it("logout revokes only the family of the given refresh token", async () => {
    const { service, refreshTokenStore } = await buildService();
    const { refreshToken: userAToken } = await service.login("user-a");
    await service.login("user-b");

    await service.logout(userAToken);

    const userARecord = refreshTokenStore.find((t) => t.userId === "user-a")!;
    const userBRecord = refreshTokenStore.find((t) => t.userId === "user-b")!;
    expect(userARecord.revokedAt).not.toBeNull();
    expect(userBRecord.revokedAt).toBeNull();
  });

  it("logoutAll revokes every family for that user but not other users'", async () => {
    const { service, refreshTokenStore } = await buildService();
    const { refreshToken: session1 } = await service.login("user-a");
    await service.login("user-a"); // เข้าอีกอุปกรณ์หนึ่ง = อีก family
    await service.login("user-b");
    await service.refresh(session1); // หมุน session แรกไปด้วย ต้องโดนเพิกถอนทั้งสองรุ่น

    await service.logoutAll("user-a");

    for (const record of refreshTokenStore.filter((t) => t.userId === "user-a")) {
      expect(record.revokedAt).not.toBeNull();
    }
    const userBRecord = refreshTokenStore.find((t) => t.userId === "user-b")!;
    expect(userBRecord.revokedAt).toBeNull();
  });
});
