import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { UserAccount } from "../domain/UserAccount.js";
import { UserAccountRepository } from "../repositories/UserAccountRepository.js";

export class PrismaUserAccountRepository implements UserAccountRepository {
  public async findByEmail(email: string): Promise<UserAccount | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.user.findFirst({
      where: {
        email,
        deleted_at: null,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        password_hash: true,
        is_active: true,
      },
    });

    if (!row) {
      return null;
    }

    return new UserAccount({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      passwordHash: row.password_hash,
      isActive: row.is_active,
    });
  }

  public async findById(userId: string): Promise<UserAccount | null> {
    const prisma = PrismaClientManager.getClient();

    const row = await prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        password_hash: true,
        is_active: true,
      },
    });

    if (!row) {
      return null;
    }

    return new UserAccount({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      passwordHash: row.password_hash,
      isActive: row.is_active,
    });
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password_hash: passwordHash,
        password_updated_at: new Date(),
      },
    });
  }
}
