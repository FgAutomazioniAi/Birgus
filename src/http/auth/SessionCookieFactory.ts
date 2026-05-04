type SameSiteMode = "Strict" | "Lax" | "None";

export type SessionCookieFactoryOptions = {
  cookieName?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  sameSite?: SameSiteMode;
};

export class SessionCookieFactory {
  private readonly cookieName: string;
  private readonly domain: string | null;
  private readonly path: string;
  private readonly secure: boolean;
  private readonly sameSite: SameSiteMode;

  public constructor(options?: SessionCookieFactoryOptions) {
    this.cookieName = options?.cookieName ?? "vl_session";
    this.domain = options?.domain?.trim() ? options.domain.trim() : null;
    this.path = options?.path?.trim() ? options.path.trim() : "/";
    this.secure = options?.secure ?? false;
    this.sameSite = options?.sameSite ?? "Lax";
  }

  public createSessionCookie(token: string, maxAgeSeconds: number): string {
    const parts = [
      `${this.cookieName}=${encodeURIComponent(token)}`,
      `Path=${this.path}`,
      "HttpOnly",
      `SameSite=${this.sameSite}`,
      `Max-Age=${maxAgeSeconds}`,
    ];

    if (this.secure) {
      parts.push("Secure");
    }

    if (this.domain) {
      parts.push(`Domain=${this.domain}`);
    }

    return parts.join("; ");
  }

  public createExpiredCookie(): string {
    const parts = [
      `${this.cookieName}=`,
      `Path=${this.path}`,
      "HttpOnly",
      `SameSite=${this.sameSite}`,
      "Max-Age=0",
    ];

    if (this.secure) {
      parts.push("Secure");
    }

    if (this.domain) {
      parts.push(`Domain=${this.domain}`);
    }

    return parts.join("; ");
  }
}
