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
        must_change_password: true,
        two_factor_enabled: true,
        two_factor_secret_ciphertext: true,
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
      mustChangePassword: row.must_change_password,
      twoFactorEnabled: row.two_factor_enabled,
      twoFactorSecretCiphertext: row.two_factor_secret_ciphertext,
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
        must_change_password: true,
        two_factor_enabled: true,
        two_factor_secret_ciphertext: true,
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
      mustChangePassword: row.must_change_password,
      twoFactorEnabled: row.two_factor_enabled,
      twoFactorSecretCiphertext: row.two_factor_secret_ciphertext,
      isActive: row.is_active,
    });
  }

  public async updatePassword(userId: string, passwordHash: string, mustChangePassword = false): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password_hash: passwordHash,
        password_updated_at: new Date(),
        must_change_password: mustChangePassword,
      },
    });
  }

  public async isSuperadmin(userId: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const assignment = await prisma.userWorkspaceRole.findFirst({
      where: {
        user_id: userId,
        role: {
          key: "superadmin",
        },
      },
      select: {
        id: true,
      },
    });

    return assignment !== null;
  }

  public async setTwoFactorSecret(userId: string, secretCiphertext: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        two_factor_enabled: true,
        two_factor_secret_ciphertext: secretCiphertext,
        two_factor_enabled_at: new Date(),
        two_factor_last_verified_at: new Date(),
      },
    });
  }

  public async clearTwoFactorSecret(userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        two_factor_enabled: false,
        two_factor_secret_ciphertext: null,
        two_factor_enabled_at: null,
        two_factor_last_verified_at: null,
      },
    });
  }

  public async markTwoFactorVerified(userId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        two_factor_last_verified_at: new Date(),
      },
    });
  }
}
