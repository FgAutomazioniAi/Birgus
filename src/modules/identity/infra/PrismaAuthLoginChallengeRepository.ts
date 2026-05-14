import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AuthLoginChallengeEntity } from "../domain/AuthLoginChallengeEntity.js";
import { AuthLoginChallengeRepository } from "../repositories/AuthLoginChallengeRepository.js";

export class PrismaAuthLoginChallengeRepository implements AuthLoginChallengeRepository {
  public async create(params: {
    userId: string;
    challengeHash: string;
    rememberMe: boolean;
    requiresTotpSetup: boolean;
    setupSecretCiphertext: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<AuthLoginChallengeEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.authLoginChallenge.create({
      data: {
        user_id: params.userId,
        challenge_hash: params.challengeHash,
        remember_me: params.rememberMe,
        requires_totp_setup: params.requiresTotpSetup,
        setup_secret_ciphertext: params.setupSecretCiphertext,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        expires_at: params.expiresAt,
      },
    });

    return this.toEntity(row);
  }

  public async findByChallengeHash(challengeHash: string): Promise<AuthLoginChallengeEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.authLoginChallenge.findFirst({
      where: {
        challenge_hash: challengeHash,
      },
    });

    return row ? this.toEntity(row) : null;
  }

  public async consumeById(id: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.authLoginChallenge.updateMany({
      where: {
        id,
        consumed_at: null,
      },
      data: {
        consumed_at: new Date(),
      },
    });
  }

  public async deleteExpired(now: Date): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.authLoginChallenge.deleteMany({
      where: {
        OR: [
          {
            expires_at: {
              lt: now,
            },
          },
          {
            consumed_at: {
              not: null,
            },
          },
        ],
      },
    });
  }

  private toEntity(row: {
    id: string;
    user_id: string;
    challenge_hash: string;
    remember_me: boolean;
    requires_totp_setup: boolean;
    setup_secret_ciphertext: string | null;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: Date;
    consumed_at: Date | null;
  }): AuthLoginChallengeEntity {
    return new AuthLoginChallengeEntity({
      id: row.id,
      userId: row.user_id,
      challengeHash: row.challenge_hash,
      rememberMe: row.remember_me,
      requiresTotpSetup: row.requires_totp_setup,
      setupSecretCiphertext: row.setup_secret_ciphertext,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
    });
  }
}
