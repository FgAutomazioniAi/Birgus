import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export class PasswordHasher {
  private readonly pepper: string;
  private readonly hashPrefix: string;

  public constructor(pepper: string) {
    this.pepper = pepper;
    this.hashPrefix = "scrypt";
  }

  public async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("base64url");
    const derived = await this.derive(this.normalize(password), salt, 64);

    return `${this.hashPrefix}$${salt}$${derived.toString("base64url")}`;
  }

  public async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [prefix, salt, encodedHash] = storedHash.split("$");

    if (prefix !== this.hashPrefix || !salt || !encodedHash) {
      return false;
    }

    const expectedHash = Buffer.from(encodedHash, "base64url");
    const derived = await this.derive(this.normalize(password), salt, expectedHash.length);

    if (expectedHash.length !== derived.length) {
      return false;
    }

    return timingSafeEqual(expectedHash, derived);
  }

  private normalize(value: string): string {
    return `${value.normalize("NFKC")}${this.pepper}`;
  }

  private async derive(password: string, salt: string, keyLength: number): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, keyLength, { N: 16384, p: 1, r: 8 }, (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(Buffer.from(derivedKey));
      });
    });
  }
}
