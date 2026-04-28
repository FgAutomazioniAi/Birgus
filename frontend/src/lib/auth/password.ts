import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { AUTH_PEPPER } from "@/lib/auth/constants";

const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  p: 1,
  r: 8,
};

const normalizePassword = (password: string) => password.normalize("NFKC");

const deriveScryptHash = async (password: string, salt: string, keyLength: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await deriveScryptHash(normalizePassword(password) + AUTH_PEPPER, salt, SCRYPT_KEY_LENGTH);

  return `${PASSWORD_HASH_PREFIX}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, salt, hash] = storedHash.split("$");
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const expectedHash = Buffer.from(hash, "base64url");
  const derived = await deriveScryptHash(normalizePassword(password) + AUTH_PEPPER, salt, expectedHash.length);

  if (expectedHash.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, derived);
}
