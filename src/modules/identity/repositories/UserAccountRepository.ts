import { UserAccount } from "../domain/UserAccount.js";

export interface UserAccountRepository {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(userId: string): Promise<UserAccount | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}
