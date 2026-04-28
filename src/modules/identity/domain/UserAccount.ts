export class UserAccount {
  public readonly id: string;
  public readonly email: string;
  public readonly firstName: string;
  public readonly lastName: string | null;
  public readonly passwordHash: string | null;
  public readonly isActive: boolean;

  public constructor(params: {
    id: string;
    email: string;
    firstName: string;
    lastName: string | null;
    passwordHash: string | null;
    isActive: boolean;
  }) {
    this.id = params.id;
    this.email = params.email;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.passwordHash = params.passwordHash;
    this.isActive = params.isActive;
  }
}
