export class Result<T> {
  private readonly value?: T;
  private readonly error?: Error;

  private constructor(value?: T, error?: Error) {
    this.value = value;
    this.error = error;
  }

  public static ok<T>(value: T): Result<T> {
    return new Result<T>(value);
  }

  public static fail<T>(error: Error): Result<T> {
    return new Result<T>(undefined, error);
  }

  public isOk(): boolean {
    return this.error === undefined;
  }

  public isFail(): boolean {
    return this.error !== undefined;
  }

  public getValue(): T {
    if (this.value === undefined) {
      throw new Error("Result has no value.");
    }

    return this.value;
  }

  public getError(): Error {
    if (this.error === undefined) {
      throw new Error("Result has no error.");
    }

    return this.error;
  }
}
