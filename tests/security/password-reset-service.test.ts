import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { UserAccount } from "../../src/modules/identity/domain/UserAccount.js";
import type { AuthSessionRepository } from "../../src/modules/identity/repositories/AuthSessionRepository.js";
import type { PasswordResetCodeRepository } from "../../src/modules/identity/repositories/PasswordResetCodeRepository.js";
import type { UserAccountRepository } from "../../src/modules/identity/repositories/UserAccountRepository.js";
import { PasswordHasher } from "../../src/modules/identity/services/PasswordHasher.js";
import type { PasswordResetNotifier } from "../../src/modules/identity/services/PasswordResetNotifier.js";
import { PasswordResetService } from "../../src/modules/identity/services/PasswordResetService.js";
import { PasswordPolicy } from "../../src/modules/identity/services/PasswordPolicy.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  process.env.NODE_ENV = originalNodeEnv;
});

test("PasswordResetService does not expose reset codes in production", async () => {
  process.env.NODE_ENV = "production";
  const user = new UserAccount({
    id: "user-1",
    email: "operator@example.test",
    firstName: "Operator",
    lastName: null,
    passwordHash: "hash",
    mustChangePassword: false,
    twoFactorEnabled: false,
    twoFactorSecretCiphertext: null,
    isActive: true,
  });
  const codeRepository = new InMemoryPasswordResetCodeRepository();
  const notifier = new CapturingPasswordResetNotifier();
  const service = new PasswordResetService(
    new StaticUserAccountRepository(user),
    codeRepository,
    new NoopAuthSessionRepository(),
    new PasswordHasher("test-pepper"),
    notifier,
    new PasswordPolicy(),
    15,
  );

  const outcome = await service.requestReset("operator@example.test");

  assert.equal(outcome?.debugCode, null);
  assert.equal(notifier.sentCodes.length, 1);
  assert.equal(codeRepository.createdCodes.length, 1);
});

test("PasswordResetService returns null for unknown users", async () => {
  const service = new PasswordResetService(
    new StaticUserAccountRepository(null),
    new InMemoryPasswordResetCodeRepository(),
    new NoopAuthSessionRepository(),
    new PasswordHasher("test-pepper"),
    new CapturingPasswordResetNotifier(),
    new PasswordPolicy(),
    15,
  );

  assert.equal(await service.requestReset("missing@example.test"), null);
});

test("PasswordResetService counts failed one-time-code attempts", async () => {
  const user = new UserAccount({
    id: "user-1",
    email: "operator@example.test",
    firstName: "Operator",
    lastName: null,
    passwordHash: "hash",
    mustChangePassword: false,
    twoFactorEnabled: false,
    twoFactorSecretCiphertext: null,
    isActive: true,
  });
  const codeRepository = new InMemoryPasswordResetCodeRepository();
  const service = new PasswordResetService(
    new StaticUserAccountRepository(user),
    codeRepository,
    new NoopAuthSessionRepository(),
    new PasswordHasher("test-pepper"),
    new CapturingPasswordResetNotifier(),
    new PasswordPolicy(),
    15,
  );

  await assert.rejects(
    service.resetPassword({ email: user.email, code: "000000", newPassword: "ValidPass1" }),
    { code: "AUTH_PASSWORD_RESET_CODE_INVALID" },
  );
  assert.deepEqual(codeRepository.failedAttempts, [{ userId: user.id, maxAttempts: 4 }]);
});

class StaticUserAccountRepository implements UserAccountRepository {
  public constructor(private readonly user: UserAccount | null) {}

  public async findByEmail(): Promise<UserAccount | null> {
    return this.user;
  }

  public async findById(): Promise<UserAccount | null> {
    return this.user;
  }

  public async updatePassword(): Promise<void> {}

  public async isSuperadmin(): Promise<boolean> {
    return false;
  }

  public async setTwoFactorSecret(): Promise<void> {}

  public async clearTwoFactorSecret(): Promise<void> {}

  public async markTwoFactorVerified(): Promise<void> {}
}

class InMemoryPasswordResetCodeRepository implements PasswordResetCodeRepository {
  public readonly createdCodes: Array<{ userId: string; codeHash: string; expiresAt: Date }> = [];
  public readonly failedAttempts: Array<{ userId: string; maxAttempts: number }> = [];

  public async invalidateActiveCodesForUser(): Promise<void> {}

  public async createCode(userId: string, codeHash: string, expiresAt: Date): Promise<void> {
    this.createdCodes.push({ userId, codeHash, expiresAt });
  }

  public async findValidCode(): Promise<null> {
    return null;
  }

  public async markCodeUsed(): Promise<void> {}

  public async recordFailedAttempt(userId: string, maxAttempts: number): Promise<void> {
    this.failedAttempts.push({ userId, maxAttempts });
  }
}

class NoopAuthSessionRepository implements AuthSessionRepository {
  public async create(): Promise<never> {
    throw new Error("Not implemented in this test.");
  }

  public async findByTokenHash(): Promise<null> {
    return null;
  }

  public async revokeByTokenHash(): Promise<void> {}

  public async revokeAllForUser(): Promise<void> {}

  public async revokeAllForUserExceptSession(): Promise<void> {}
}

class CapturingPasswordResetNotifier implements PasswordResetNotifier {
  public readonly sentCodes: string[] = [];

  public async sendResetCode(params: { code: string }): Promise<void> {
    this.sentCodes.push(params.code);
  }
}
