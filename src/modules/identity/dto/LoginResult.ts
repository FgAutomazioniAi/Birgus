export class LoginResult {
  public readonly sessionId: string;
  public readonly token: string;
  public readonly expiresAt: Date;
  public readonly userId: string;
  public readonly email: string;
  public readonly fullName: string;

  public constructor(params: {
    sessionId: string;
    token: string;
    expiresAt: Date;
    userId: string;
    email: string;
    fullName: string;
  }) {
    this.sessionId = params.sessionId;
    this.token = params.token;
    this.expiresAt = params.expiresAt;
    this.userId = params.userId;
    this.email = params.email;
    this.fullName = params.fullName;
  }
}
