import { AuthSessionEntity } from "../domain/AuthSessionEntity.js";

export interface AuthSessionRepository {
  create(params: {
    userId: string;
    tokenHash: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionEntity>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
