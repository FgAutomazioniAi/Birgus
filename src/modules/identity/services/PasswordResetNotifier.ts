export interface PasswordResetNotifier {
  sendResetCode(params: {
    email: string;
    firstName: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void>;
}
