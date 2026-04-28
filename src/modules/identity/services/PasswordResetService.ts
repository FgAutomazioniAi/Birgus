import { createHash, randomInt } from "node:crypto";

import { AppError } from "../../../core/errors/AppError.js";
import { PasswordResetCodeRepository } from "../repositories/PasswordResetCodeRepository.js";
import { UserAccountRepository } from "../repositories/UserAccountRepository.js";
import { AuthSessionRepository } from "../repositories/AuthSessionRepository.js";
import { PasswordHasher } from "./PasswordHasher.js";

export class PasswordResetService {
  private readonly userRepository: UserAccountRepository;
  private readonly codeRepository: PasswordResetCodeRepository;
  private readonly sessionRepository: AuthSessionRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly ttlMinutes: number;

  public constructor(
    userRepository: UserAccountRepository,
    codeRepository: PasswordResetCodeRepository,
    sessionRepository: AuthSessionRepository,
    passwordHasher: PasswordHasher,
    ttlMinutes: number,
  ) {
    this.userRepository = userRepository;
    this.codeRepository = codeRepository;
    this.sessionRepository = sessionRepository;
    this.passwordHasher = passwordHasher;
    this.ttlMinutes = ttlMinutes;
  }

  public async requestReset(email: string): Promise<{ expiresAt: Date; debugCode: string | null } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || !user.isActive) {
      return null;
    }

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + (this.ttlMinutes * 60 * 1000));

    await this.codeRepository.invalidateActiveCodesForUser(user.id);
    await this.codeRepository.createCode(user.id, codeHash, expiresAt);

    const debugCode = process.env.NODE_ENV === "production" ? null : code;
    return { expiresAt, debugCode };
  }

  public async resetPassword(params: { email: string; code: string; newPassword: string }): Promise<void> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user || !user.isActive) {
      throw new AppError("Invalid reset credentials.", "AUTH_PASSWORD_RESET_INVALID", 400);
    }

    const codeHash = this.hashCode(params.code.trim());
    const record = await this.codeRepository.findValidCode(user.id, codeHash, new Date());
    if (!record) {
      throw new AppError("Reset code invalid or expired.", "AUTH_PASSWORD_RESET_CODE_INVALID", 400);
    }

    const normalizedPassword = params.newPassword.trim();
    if (normalizedPassword.length < 5) {
      throw new AppError("Password must be at least 5 characters.", "AUTH_PASSWORD_RESET_WEAK", 400);
    }

    const passwordHash = await this.passwordHasher.hashPassword(normalizedPassword);
    await this.userRepository.updatePassword(user.id, passwordHash);
    await this.sessionRepository.revokeAllForUser(user.id);
    await this.codeRepository.markCodeUsed(record.id);
    await this.codeRepository.invalidateActiveCodesForUser(user.id);
  }

  private hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }
}
