export class UserAccount {
  public readonly id: string;
  public readonly email: string;
  public readonly firstName: string;
  public readonly lastName: string | null;
  public readonly passwordHash: string | null;
  public readonly mustChangePassword: boolean;
  public readonly twoFactorEnabled: boolean;
  public readonly twoFactorSecretCiphertext: string | null;
  public readonly isActive: boolean;

  public constructor(params: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    passwordHash: string | null;
    mustChangePassword: boolean;
    twoFactorEnabled: boolean;
    twoFactorSecretCiphertext: string | null;
    isActive: boolean;
  }) {
    this.id = params.id;
    this.email = params.email;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.passwordHash = params.passwordHash;
    this.mustChangePassword = params.mustChangePassword;
    this.twoFactorEnabled = params.twoFactorEnabled;
    this.twoFactorSecretCiphertext = params.twoFactorSecretCiphertext;
    this.isActive = params.isActive;
  }
}
