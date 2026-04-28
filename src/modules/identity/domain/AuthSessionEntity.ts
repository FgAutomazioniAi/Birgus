export class AuthSessionEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly tokenHash: string;
  public readonly expiresAt: Date;
  public readonly revokedAt: Date | null;

  public constructor(params: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.tokenHash = params.tokenHash;
    this.expiresAt = params.expiresAt;
    this.revokedAt = params.revokedAt;
  }

  public isValid(now: Date): boolean {
    return this.revokedAt === null && this.expiresAt.getTime() > now.getTime();
  }
}
