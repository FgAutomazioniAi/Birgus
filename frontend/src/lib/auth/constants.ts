const parsePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const AUTH_SESSION_COOKIE_NAME = "vl_session";
export const AUTH_CONFIGURED_COOKIE_NAME = process.env.AUTH_COOKIE_NAME?.trim() || AUTH_SESSION_COOKIE_NAME;
export const AUTH_PEPPER = process.env.AUTH_PEPPER ?? "";
export const AUTH_SESSION_HOURS = parsePositiveNumber(process.env.AUTH_SESSION_HOURS, 12);
export const AUTH_SESSION_REMEMBER_DAYS = parsePositiveNumber(process.env.AUTH_SESSION_REMEMBER_DAYS, 30);
export const AUTH_PASSWORD_RESET_CODE_TTL_MINUTES = parsePositiveNumber(
  process.env.AUTH_PASSWORD_RESET_CODE_TTL_MINUTES,
  15,
);
