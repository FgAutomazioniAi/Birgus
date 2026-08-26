export interface PasswordResetCodeRecord {
  id: number;
  userId: string;
  expiresAt: Date;
  attemptCount: number;
}

export interface PasswordResetCodeRepository {
  invalidateActiveCodesForUser(userId: string): Promise<void>;
  createCode(userId: string, codeHash: string, expiresAt: Date): Promise<void>;
  findValidCode(userId: string, codeHash: string, now: Date): Promise<PasswordResetCodeRecord | null>;
  recordFailedAttempt(userId: string, maxAttempts: number): Promise<void>;
  markCodeUsed(codeId: number): Promise<void>;
}
