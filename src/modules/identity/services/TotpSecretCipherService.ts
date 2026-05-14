import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { AppError } from "../../../core/errors/AppError.js";

const CIPHER_VERSION = "v1";

export class TotpSecretCipherService {
  private readonly key: Buffer;

  public constructor(secretMaterial: string) {
    this.key = createHash("sha256").update(secretMaterial || "birgus-dev-totp-key").digest();
  }

  public encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      CIPHER_VERSION,
      iv.toString("base64url"),
      authTag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(":");
  }

  public decrypt(payload: string): string {
    const [version, ivEncoded, tagEncoded, dataEncoded] = payload.split(":");
    if (version !== CIPHER_VERSION || !ivEncoded || !tagEncoded || !dataEncoded) {
      throw new AppError("Invalid 2FA secret payload.", "AUTH_2FA_SECRET_INVALID", 500);
    }

    const iv = Buffer.from(ivEncoded, "base64url");
    const tag = Buffer.from(tagEncoded, "base64url");
    const data = Buffer.from(dataEncoded, "base64url");

    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString("utf8");
  }
}
