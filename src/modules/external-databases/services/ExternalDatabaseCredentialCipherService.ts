import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { AppError } from "../../../core/errors/AppError.js";

const CIPHER_VERSION = "v1";

/** Encrypts credentials at rest. The value is never returned by the settings API. */
export class ExternalDatabaseCredentialCipherService {
  private readonly key: Buffer;

  public constructor(secretMaterial: string) {
    this.key = createHash("sha256")
      .update(`birgus:external-database:${secretMaterial}`)
      .digest();
  }

  public encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [
      CIPHER_VERSION,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(":");
  }

  public decrypt(payload: string): string {
    const [version, iv, tag, ciphertext] = payload.split(":");
    if (version !== CIPHER_VERSION || !iv || !tag || !ciphertext) {
      throw new AppError(
        "Configurazione credenziali database non valida.",
        "EXTERNAL_DATABASE_CREDENTIAL_INVALID",
        500,
      );
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
