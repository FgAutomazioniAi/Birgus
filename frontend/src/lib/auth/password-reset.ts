import { createHash, randomInt } from "node:crypto";

import { AUTH_PASSWORD_RESET_CODE_TTL_MINUTES, AUTH_PEPPER } from "@/lib/auth/constants";

export const generatePasswordResetCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashPasswordResetCode = (code: string) =>
  createHash("sha256")
    .update(`${code}:${AUTH_PEPPER}`)
    .digest("hex");

export const getPasswordResetExpiresAt = () =>
  new Date(Date.now() + AUTH_PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000);
