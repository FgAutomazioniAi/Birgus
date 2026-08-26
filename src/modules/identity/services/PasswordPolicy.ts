import { AppError } from "../../../core/errors/AppError.js";

export class PasswordPolicy {
  public readonly description = "Password di almeno 8 caratteri, con una lettera maiuscola e un numero.";

  public ensureValid(value: string, errorCode = "AUTH_PASSWORD_POLICY_INVALID"): string {
    const password = value.trim();
    if (!this.isValid(password)) {
      throw new AppError(this.description, errorCode, 400);
    }

    return password;
  }

  public isValid(value: string): boolean {
    return value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value);
  }
}
