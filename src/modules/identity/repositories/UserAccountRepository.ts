import { UserAccount } from "../domain/UserAccount.js";

export interface UserAccountRepository {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(userId: string): Promise<UserAccount | null>;
  updatePassword(userId: string, passwordHash: string, mustChangePassword?: boolean): Promise<void>;
  isSuperadmin(userId: string): Promise<boolean>;
  setTwoFactorSecret(userId: string, secretCiphertext: string): Promise<void>;
  clearTwoFactorSecret(userId: string): Promise<void>;
  markTwoFactorVerified(userId: string): Promise<void>;
}
