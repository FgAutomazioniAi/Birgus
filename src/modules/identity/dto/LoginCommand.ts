export class LoginCommand {
  public readonly email: string;
  public readonly password: string;
  public readonly rememberMe: boolean;
  public readonly trustedDeviceToken: string | null;
  public readonly ipAddress: string | null;
  public readonly userAgent: string | null;

  public constructor(params: {
    email: string;
    password: string;
    rememberMe?: boolean;
    trustedDeviceToken?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    this.email = params.email.trim().toLowerCase();
    this.password = params.password;
    this.rememberMe = params.rememberMe ?? false;
    this.trustedDeviceToken = params.trustedDeviceToken?.trim() || null;
    this.ipAddress = params.ipAddress ?? null;
    this.userAgent = params.userAgent ?? null;
  }
}
