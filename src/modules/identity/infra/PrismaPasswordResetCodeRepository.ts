import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { PasswordResetCodeRecord, PasswordResetCodeRepository } from "../repositories/PasswordResetCodeRepository.js";

export class PrismaPasswordResetCodeRepository implements PasswordResetCodeRepository {
  public async invalidateActiveCodesForUser(userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.passwordResetCode.updateMany({
      where: {
        user_id: userId,
        used_at: null,
      },
      data: {
        used_at: new Date(),
      },
    });
  }

  public async createCode(userId: string, codeHash: string, expiresAt: Date): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.passwordResetCode.create({
      data: {
        user_id: userId,
        code_hash: codeHash,
        expires_at: expiresAt,
      },
    });
  }

  public async findValidCode(userId: string, codeHash: string, now: Date): Promise<PasswordResetCodeRecord | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.passwordResetCode.findFirst({
      where: {
        user_id: userId,
        code_hash: codeHash,
        used_at: null,
        expires_at: {
          gt: now,
        },
        attempt_count: {
          lt: 4,
        },
      },
      select: {
        id: true,
        user_id: true,
        expires_at: true,
        attempt_count: true,
      },
      orderBy: {
        id: "desc",
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: row.expires_at,
      attemptCount: row.attempt_count,
    };
  }

  public async recordFailedAttempt(userId: string, maxAttempts: number): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetCode.updateMany({
        where: {
          user_id: userId,
          used_at: null,
          expires_at: { gt: now },
          attempt_count: { lt: maxAttempts },
        },
        data: {
          attempt_count: { increment: 1 },
        },
      });

      await tx.passwordResetCode.updateMany({
        where: {
          user_id: userId,
          used_at: null,
          expires_at: { gt: now },
          attempt_count: { gte: maxAttempts },
        },
        data: {
          used_at: now,
        },
      });
    });
  }

  public async markCodeUsed(codeId: number): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.passwordResetCode.updateMany({
      where: {
        id: codeId,
        used_at: null,
      },
      data: {
        used_at: new Date(),
      },
    });
  }
}
