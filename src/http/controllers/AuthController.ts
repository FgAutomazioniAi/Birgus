import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { LoginCommand } from "../../modules/identity/dto/LoginCommand.js";
import { AuthService } from "../../modules/identity/services/AuthService.js";
import { PasswordResetService } from "../../modules/identity/services/PasswordResetService.js";
import { SessionCookieFactory } from "../auth/SessionCookieFactory.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(5),
});

export class AuthController {
  private readonly authService: AuthService;
  private readonly passwordResetService: PasswordResetService;
  private readonly sessionCookieFactory: SessionCookieFactory;

  public constructor(
    authService: AuthService,
    passwordResetService: PasswordResetService,
    sessionCookieFactory: SessionCookieFactory,
  ) {
    this.authService = authService;
    this.passwordResetService = passwordResetService;
    this.sessionCookieFactory = sessionCookieFactory;
  }

  public login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const body = loginSchema.parse(request.body);

      const result = await this.authService.login(
        new LoginCommand({
          email: body.email,
          password: body.password,
          rememberMe: body.rememberMe,
          ipAddress: this.getIpAddress(request),
          userAgent: this.getUserAgent(request),
        }),
      );

      const cookieMaxAgeSeconds = Math.max(
        1,
        Math.floor((result.expiresAt.getTime() - Date.now()) / 1000),
      );
      reply.header(
        "Set-Cookie",
        this.sessionCookieFactory.createSessionCookie(result.token, cookieMaxAgeSeconds),
      );

      reply.code(200).send({
        ok: true,
        sessionId: result.sessionId,
        token: result.token,
        expiresAt: result.expiresAt,
        user: {
          id: result.userId,
          email: result.email,
          fullName: result.fullName,
        },
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public logout = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.authService.logout(request.requestContext.token);
      reply.header("Set-Cookie", this.sessionCookieFactory.createExpiredCookie());
      reply.code(200).send({ ok: true });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public session = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      const session = await this.authService.validateToken(request.requestContext.token);
      if (!session) {
        throw new AppError("Invalid or expired session.", "AUTH_SESSION_INVALID", 401);
      }

      reply.code(200).send({
        ok: true,
        sessionId: request.requestContext.sessionId,
        workspaceId: request.requestContext.workspace.workspaceId,
        userId: request.requestContext.workspace.userId,
        user: {
          id: session.userId,
          email: session.email,
          fullName: session.fullName,
        },
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public forgotPassword = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const body = forgotPasswordSchema.parse(request.body);
      const outcome = await this.passwordResetService.requestReset(body.email);

      reply.code(200).send({
        ok: true,
        message: "If the account exists, a reset code has been generated.",
        expiresAt: outcome?.expiresAt ?? null,
        debugCode: outcome?.debugCode ?? null,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public resetPassword = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const body = resetPasswordSchema.parse(request.body);
      await this.passwordResetService.resetPassword({
        email: body.email,
        code: body.code,
        newPassword: body.newPassword,
      });

      reply.code(200).send({ ok: true, message: "Password reset completed." });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private getIpAddress(request: FastifyRequest): string | null {
    const forwarded = request.headers["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() ?? null;
    }

    const realIp = request.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
      return realIp.trim();
    }

    return null;
  }

  private getUserAgent(request: FastifyRequest): string | null {
    const value = request.headers["user-agent"];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }

    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
