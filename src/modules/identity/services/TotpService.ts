import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export class TotpService {
  private readonly digits: number;
  private readonly stepSeconds: number;
  private readonly periodLabel: string;

  public constructor(digits = 6, stepSeconds = 60) {
    this.digits = digits;
    this.stepSeconds = stepSeconds;
    this.periodLabel = String(stepSeconds);
  }

  public generateSecret(lengthBytes = 20): string {
    return this.toBase32(randomBytes(lengthBytes));
  }

  public buildOtpAuthUri(params: {
    issuer: string;
    accountName: string;
    secret: string;
  }): string {
    const issuer = params.issuer.trim();
    const accountName = params.accountName.trim();
    const label = `${issuer}:${accountName}`;

    const query = new URLSearchParams({
      secret: params.secret,
      issuer,
      algorithm: "SHA1",
      digits: String(this.digits),
      period: this.periodLabel,
    });

    return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
  }

  public verify(params: {
    secret: string;
    code: string;
    now?: Date;
    window?: number;
  }): boolean {
    const now = params.now ?? new Date();
    const window = Number.isInteger(params.window) ? Math.max(0, params.window ?? 1) : 1;
    const normalizedCode = params.code.replace(/\s+/g, "").trim();

    if (!/^\d+$/.test(normalizedCode) || normalizedCode.length !== this.digits) {
      return false;
    }

    const secret = this.fromBase32(params.secret);
    const currentCounter = Math.floor(now.getTime() / 1000 / this.stepSeconds);

    for (let offset = -window; offset <= window; offset += 1) {
      const counter = currentCounter + offset;
      if (counter < 0) {
        continue;
      }

      const expectedCode = this.generateCode(secret, counter);
      const expectedBuffer = Buffer.from(expectedCode, "utf8");
      const providedBuffer = Buffer.from(normalizedCode, "utf8");
      if (expectedBuffer.length !== providedBuffer.length) {
        continue;
      }

      if (timingSafeEqual(expectedBuffer, providedBuffer)) {
        return true;
      }
    }

    return false;
  }

  private generateCode(secret: Buffer, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));

    const digest = createHmac("sha1", secret).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24)
      | ((digest[offset + 1] & 0xff) << 16)
      | ((digest[offset + 2] & 0xff) << 8)
      | (digest[offset + 3] & 0xff);

    const code = binary % (10 ** this.digits);
    return code.toString().padStart(this.digits, "0");
  }

  private toBase32(input: Buffer): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    let output = "";

    for (const byte of input) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private fromBase32(base32: string): Buffer {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const clean = base32.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");

    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of clean) {
      const index = alphabet.indexOf(char);
      if (index < 0) {
        throw new Error("Invalid TOTP base32 secret.");
      }

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
