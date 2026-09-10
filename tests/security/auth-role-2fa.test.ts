import assert from "node:assert/strict";
import test from "node:test";

import type { AuthLoginChallengeEntity } from "../../src/modules/identity/domain/AuthLoginChallengeEntity.js";
import type { AuthSessionEntity } from "../../src/modules/identity/domain/AuthSessionEntity.js";
import { UserAccount } from "../../src/modules/identity/domain/UserAccount.js";
import type { AuthLoginChallengeRepository } from "../../src/modules/identity/repositories/AuthLoginChallengeRepository.js";
import type { AuthSessionRepository } from "../../src/modules/identity/repositories/AuthSessionRepository.js";
import type { AuthTrustedDeviceRepository } from "../../src/modules/identity/repositories/AuthTrustedDeviceRepository.js";
import type { UserAccountRepository } from "../../src/modules/identity/repositories/UserAccountRepository.js";
import { AuthService } from "../../src/modules/identity/services/AuthService.js";
import { PasswordHasher } from "../../src/modules/identity/services/PasswordHasher.js";
import { PasswordPolicy } from "../../src/modules/identity/services/PasswordPolicy.js";
import { SessionTokenService } from "../../src/modules/identity/services/SessionTokenService.js";
import { TotpSecretCipherService } from "../../src/modules/identity/services/TotpSecretCipherService.js";
import { TotpService } from "../../src/modules/identity/services/TotpService.js";

const password = "ValidPass1";

test("Developer is forced to configure 2FA", async () => {
  const { service, challenges } = await createService({ isDeveloper: true, twoFactorEnabled: false });
  const result = await service.login({ email: "developer@example.test", password, rememberMe: false });

  assert.equal(result.requiresTwoFactor, true);
  assert.equal(result.twoFactorSetupRequired, true);
  assert.equal(challenges.created.length, 1);
});

test("Superuser can log in without enabling 2FA", async () => {
  const { service, sessions } = await createService({ isDeveloper: false, twoFactorEnabled: false });
  const result = await service.login({ email: "superuser@example.test", password, rememberMe: false });

  assert.equal(result.requiresTwoFactor, false);
  assert.equal(result.sessionId, "session-1");
  assert.equal(sessions.created, 1);
});

test("Optional 2FA remains enforced when enabled", async () => {
  const { service } = await createService({ isDeveloper: false, twoFactorEnabled: true });
  const result = await service.login({ email: "superuser@example.test", password, rememberMe: false });

  assert.equal(result.requiresTwoFactor, true);
  assert.equal(result.twoFactorSetupRequired, false);
});

test("Developer can skip 2FA only on a valid trusted device", async () => {
  const { service, sessions, trustedDevices } = await createService({
    isDeveloper: true,
    twoFactorEnabled: true,
    trustedDeviceToken: "trusted-device-token",
  });
  const result = await service.login({
    email: "developer@example.test",
    password,
    rememberMe: false,
    trustedDeviceToken: "trusted-device-token",
  });

  assert.equal(result.requiresTwoFactor, false);
  assert.equal(sessions.created, 1);
  assert.equal(trustedDevices.touched, 1);
});

async function createService(params: { isDeveloper: boolean; twoFactorEnabled: boolean; trustedDeviceToken?: string }) {
  const hasher = new PasswordHasher("test-pepper");
  const passwordHash = await hasher.hashPassword(password);
  const user = new UserAccount({
    id: "user-1",
    email: params.isDeveloper ? "developer@example.test" : "superuser@example.test",
    firstName: "Test",
    lastName: "User",
    passwordHash,
    mustChangePassword: false,
    twoFactorEnabled: params.twoFactorEnabled,
    twoFactorSecretCiphertext: params.twoFactorEnabled ? "encrypted-secret" : null,
    isActive: true,
  });
  const users = new StaticUserRepository(user, params.isDeveloper);
  const sessions = new CapturingSessionRepository();
  const challenges = new CapturingChallengeRepository();
  const tokenService = new SessionTokenService();
  const trustedDevices = new CapturingTrustedDeviceRepository(
    params.trustedDeviceToken ? tokenService.hashToken(params.trustedDeviceToken) : null,
  );
  const service = new AuthService(
    users,
    sessions,
    challenges,
    hasher,
    tokenService,
    new TotpService(),
    new TotpSecretCipherService("test-cipher-key"),
    new PasswordPolicy(),
    "Birgus",
    12,
    30,
    5,
    trustedDevices,
  );
  return { service, sessions, challenges, trustedDevices };
}

class StaticUserRepository implements UserAccountRepository {
  public constructor(private readonly user: UserAccount, private readonly developer: boolean) {}
  public async findByEmail() { return this.user; }
  public async findById() { return this.user; }
  public async updatePassword() {}
  public async isDeveloper() { return this.developer; }
  public async setTwoFactorSecret() {}
  public async clearTwoFactorSecret() {}
  public async markTwoFactorVerified() {}
}

class CapturingSessionRepository implements AuthSessionRepository {
  public created = 0;
  public async create(): Promise<AuthSessionEntity> {
    this.created += 1;
    return { id: "session-1" } as AuthSessionEntity;
  }
  public async findByTokenHash() { return null; }
  public async revokeByTokenHash() {}
  public async revokeAllForUser() {}
  public async revokeAllForUserExceptSession() {}
}

class CapturingChallengeRepository implements AuthLoginChallengeRepository {
  public readonly created: unknown[] = [];
  public async create(params: unknown): Promise<AuthLoginChallengeEntity> {
    this.created.push(params);
    return { id: "challenge-1" } as AuthLoginChallengeEntity;
  }
  public async findByChallengeHash() { return null; }
  public async consumeById() {}
  public async deleteExpired() {}
}

class CapturingTrustedDeviceRepository implements AuthTrustedDeviceRepository {
  public touched = 0;

  public constructor(private readonly tokenHash: string | null) {}

  public async create(): Promise<void> {}

  public async findUsableByTokenHash(tokenHash: string): Promise<{ id: string; userId: string } | null> {
    return this.tokenHash === tokenHash ? { id: "trusted-device-1", userId: "user-1" } : null;
  }

  public async touch(): Promise<void> {
    this.touched += 1;
  }

  public async revokeAllForUser(): Promise<void> {}
}
