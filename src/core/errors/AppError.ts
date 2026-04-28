export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  public constructor(message: string, code = "APP_ERROR", statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
