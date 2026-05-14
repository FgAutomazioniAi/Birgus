export class AuthLoginChallengeEntity {
  public readonly id: string;
  public readonly userId: string;
  public readonly challengeHash: string;
  public readonly rememberMe: boolean;
  public readonly requiresTotpSetup: boolean;
  public readonly setupSecretCiphertext: string | null;
  public readonly ipAddress: string | null;
  public readonly userAgent: string | null;
  public readonly expiresAt: Date;
  public readonly consumedAt: Date | null;

  public constructor(params: {
    id: string;
    userId: string;
    challengeHash: string;
    rememberMe: boolean;
    requiresTotpSetup: boolean;
    setupSecretCiphertext: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
    consumedAt: Date | null;
  }) {
    this.id = params.id;
    this.userId = params.userId;
    this.challengeHash = params.challengeHash;
    this.rememberMe = params.rememberMe;
    this.requiresTotpSetup = params.requiresTotpSetup;
    this.setupSecretCiphertext = params.setupSecretCiphertext;
    this.ipAddress = params.ipAddress;
    this.userAgent = params.userAgent;
    this.expiresAt = params.expiresAt;
    this.consumedAt = params.consumedAt;
  }

  public isUsable(now: Date): boolean {
    return this.consumedAt === null && this.expiresAt.getTime() > now.getTime();
  }
}
