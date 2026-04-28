import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AuthSessionEntity } from "../domain/AuthSessionEntity.js";
import { AuthSessionRepository } from "../repositories/AuthSessionRepository.js";

export class PrismaAuthSessionRepository implements AuthSessionRepository {
  public async create(params: {
    userId: string;
    tokenHash: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionEntity> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.authSession.create({
      data: {
        user_id: params.userId,
        token_hash: params.tokenHash,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        expires_at: params.expiresAt,
      },
      select: {
        id: true,
        user_id: true,
        token_hash: true,
        expires_at: true,
        revoked_at: true,
      },
    });

    return new AuthSessionEntity({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    });
  }

  public async findByTokenHash(tokenHash: string): Promise<AuthSessionEntity | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.authSession.findFirst({
      where: {
        token_hash: tokenHash,
      },
      select: {
        id: true,
        user_id: true,
        token_hash: true,
        expires_at: true,
        revoked_at: true,
      },
    });

    if (!row) {
      return null;
    }

    return new AuthSessionEntity({
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    });
  }

  public async revokeByTokenHash(tokenHash: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.authSession.updateMany({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.authSession.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });
  }
}
