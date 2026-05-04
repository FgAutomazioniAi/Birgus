import { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../core/errors/AppError.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { WorkspaceContext } from "../../core/tenancy/WorkspaceContext.js";
import { AuthService } from "../../modules/identity/services/AuthService.js";
import { TenancyGuard } from "../../core/tenancy/TenancyGuard.js";

export class AuthMiddleware {
  private readonly authService: AuthService;
  private readonly tenancyGuard: TenancyGuard;
  private readonly cookieSessionName: string;

  public constructor(authService: AuthService, tenancyGuard: TenancyGuard, cookieSessionName?: string) {
    this.authService = authService;
    this.tenancyGuard = tenancyGuard;
    this.cookieSessionName = cookieSessionName?.trim() || "vl_session";
  }

  public async requireAuthenticated(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const token = this.extractSessionToken(request);
      const preferredWorkspaceId = this.extractWorkspaceId(request);
      const session = await this.authService.validateToken(token);

      if (!session) {
        throw new AppError("Invalid or expired session.", "AUTH_SESSION_INVALID", 401);
      }

      const workspaceId = await this.tenancyGuard.resolveWorkspaceIdForUser(session.userId, preferredWorkspaceId);

      request.requestContext = new RequestContext({
        workspace: new WorkspaceContext(workspaceId, session.userId),
        sessionId: session.sessionId,
        token,
      });
    } catch (error) {
      const appError = this.normalizeError(error);
      reply.code(appError.statusCode).send({
        code: appError.code,
        message: appError.message,
      });
    }
  }

  private extractSessionToken(request: FastifyRequest): string {
    const authorization = request.headers.authorization;
    if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
      const token = authorization.slice(7).trim();
      if (!token) {
        throw new AppError("Invalid Bearer token.", "AUTH_BEARER_INVALID", 401);
      }

      return token;
    }

    const cookieToken = this.extractCookieToken(request.headers.cookie ?? null);
    if (!cookieToken) {
      throw new AppError("Missing authentication token.", "AUTH_TOKEN_REQUIRED", 401);
    }

    return cookieToken;
  }

  private extractCookieToken(cookieHeader: string | null): string | null {
    if (!cookieHeader || !cookieHeader.trim()) {
      return null;
    }

    const entries = cookieHeader.split(";").map((item) => item.trim());
    for (const entry of entries) {
      const separator = entry.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = entry.slice(0, separator).trim();
      if (key !== this.cookieSessionName) {
        continue;
      }

      const value = entry.slice(separator + 1).trim();
      if (!value) {
        return null;
      }

      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }

    return null;
  }

  private extractWorkspaceId(request: FastifyRequest): string | null {
    const workspaceId = request.headers["x-workspace-id"];

    if (typeof workspaceId !== "string" || !workspaceId.trim()) {
      return null;
    }

    return workspaceId.trim();
  }

  private normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    return new AppError("Authentication middleware failed.", "AUTH_MIDDLEWARE_ERROR", 500);
  }
}
