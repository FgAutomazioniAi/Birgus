import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AuthTrustedDeviceRepository } from "../repositories/AuthTrustedDeviceRepository.js";

export class PrismaAuthTrustedDeviceRepository implements AuthTrustedDeviceRepository {
  public async create(params: { userId: string; tokenHash: string; userAgent: string | null; expiresAt: Date }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.authTrustedDevice.create({
      data: { user_id: params.userId, token_hash: params.tokenHash, user_agent: params.userAgent, expires_at: params.expiresAt },
    });
  }

  public async findUsableByTokenHash(tokenHash: string, now: Date): Promise<{ id: string; userId: string } | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.authTrustedDevice.findFirst({
      where: { token_hash: tokenHash, revoked_at: null, expires_at: { gt: now } },
      select: { id: true, user_id: true },
    });
    return row ? { id: row.id, userId: row.user_id } : null;
  }

  public async touch(id: string, now: Date): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.authTrustedDevice.update({ where: { id }, data: { last_used_at: now } });
  }

  public async revokeAllForUser(userId: string, now: Date): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.authTrustedDevice.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: now } });
  }
}
