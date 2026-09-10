export interface AuthTrustedDeviceRepository {
  create(params: { userId: string; tokenHash: string; userAgent: string | null; expiresAt: Date }): Promise<void>;
  findUsableByTokenHash(tokenHash: string, now: Date): Promise<{ id: string; userId: string } | null>;
  touch(id: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}
