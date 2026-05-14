import { AuthLoginChallengeEntity } from "../domain/AuthLoginChallengeEntity.js";

export interface AuthLoginChallengeRepository {
  create(params: {
    userId: string;
    challengeHash: string;
    rememberMe: boolean;
    requiresTotpSetup: boolean;
    setupSecretCiphertext: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<AuthLoginChallengeEntity>;
  findByChallengeHash(challengeHash: string): Promise<AuthLoginChallengeEntity | null>;
  consumeById(id: string): Promise<void>;
  deleteExpired(now: Date): Promise<void>;
}
