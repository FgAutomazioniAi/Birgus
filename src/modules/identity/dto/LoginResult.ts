export class LoginResult {
  public readonly sessionId: string | null;
  public readonly token: string | null;
  public readonly expiresAt: Date | null;
  public readonly userId: string;
  public readonly email: string;
  public readonly fullName: string;
  public readonly mustChangePassword: boolean;
  public readonly requiresTwoFactor: boolean;
  public readonly twoFactorChallengeToken: string | null;
  public readonly twoFactorSetupRequired: boolean;
  public readonly twoFactorSetupSecret: string | null;
  public readonly twoFactorSetupUri: string | null;

  public constructor(params: {
    sessionId?: string | null;
    token?: string | null;
    expiresAt?: Date | null;
    userId: string;
    email: string;
    fullName: string;
    mustChangePassword?: boolean;
    requiresTwoFactor?: boolean;
    twoFactorChallengeToken?: string | null;
    twoFactorSetupRequired?: boolean;
    twoFactorSetupSecret?: string | null;
    twoFactorSetupUri?: string | null;
  }) {
    this.sessionId = params.sessionId ?? null;
    this.token = params.token ?? null;
    this.expiresAt = params.expiresAt ?? null;
    this.userId = params.userId;
    this.email = params.email;
    this.fullName = params.fullName;
    this.mustChangePassword = params.mustChangePassword ?? false;
    this.requiresTwoFactor = params.requiresTwoFactor ?? false;
    this.twoFactorChallengeToken = params.twoFactorChallengeToken ?? null;
    this.twoFactorSetupRequired = params.twoFactorSetupRequired ?? false;
    this.twoFactorSetupSecret = params.twoFactorSetupSecret ?? null;
    this.twoFactorSetupUri = params.twoFactorSetupUri ?? null;
  }
}
