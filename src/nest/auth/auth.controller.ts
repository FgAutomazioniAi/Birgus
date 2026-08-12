import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError } from "../../core/errors/AppError.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { PrismaClientManager } from "../../database/PrismaClientManager.js";
import { LoginCommand } from "../../modules/identity/dto/LoginCommand.js";
import { AuthService } from "../../modules/identity/services/AuthService.js";
import { PasswordResetService } from "../../modules/identity/services/PasswordResetService.js";
import { SessionCookieFactory } from "../../shared/http/SessionCookieFactory.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequestContextAuthGuard } from "./request-context-auth.guard.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const login2faSchema = z.object({
  challengeToken: z.string().min(1),
  otpCode: z.string().min(6).max(10),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(5),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(5),
});

  @Controller("/api/auth")
export class NestAuthController {
  public constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(PasswordResetService)
    private readonly passwordResetService: PasswordResetService,
    @Inject(SessionCookieFactory)
    private readonly sessionCookieFactory: SessionCookieFactory,
  ) {}

  @Post("login")
  @HttpCode(200)
  public async login(
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Record<string, unknown>> {
    const body = loginSchema.parse(bodyRaw);

    const result = await this.authService.login(
      new LoginCommand({
        email: body.email,
        password: body.password,
        rememberMe: body.rememberMe,
        ipAddress: this.getIpAddress(request),
        userAgent: this.getUserAgent(request),
      }),
    );

    if (result.requiresTwoFactor) {
      reply.statusCode = 202;
      return {
        ok: true,
        twoFactorRequired: true,
        challengeToken: result.twoFactorChallengeToken,
        setupRequired: result.twoFactorSetupRequired,
        setup: result.twoFactorSetupRequired
          ? {
              secret: result.twoFactorSetupSecret,
              otpauthUri: result.twoFactorSetupUri,
            }
          : null,
        user: {
          id: result.userId,
          email: result.email,
          fullName: result.fullName,
        },
      };
    }

    if (!result.token || !result.expiresAt || !result.sessionId) {
      throw new AppError("Invalid auth state.", "AUTH_STATE_INVALID", 500);
    }

    const cookieMaxAgeSeconds = Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000));
    reply.header(
      "Set-Cookie",
      this.sessionCookieFactory.createSessionCookie(result.token, cookieMaxAgeSeconds),
    );

    return {
      ok: true,
      twoFactorRequired: false,
      sessionId: result.sessionId,
      token: result.token,
      expiresAt: result.expiresAt,
      user: {
        id: result.userId,
        email: result.email,
        fullName: result.fullName,
      },
    };
  }

  @Post("login/2fa/verify")
  @HttpCode(200)
  public async verifyLogin2fa(
    @Body() bodyRaw: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Record<string, unknown>> {
    const body = login2faSchema.parse(bodyRaw);
    const result = await this.authService.verifyTwoFactorLogin({
      challengeToken: body.challengeToken,
      otpCode: body.otpCode,
      ipAddress: this.getIpAddress(request),
      userAgent: this.getUserAgent(request),
    });

    if (!result.token || !result.expiresAt || !result.sessionId) {
      throw new AppError("Invalid auth state.", "AUTH_STATE_INVALID", 500);
    }

    const cookieMaxAgeSeconds = Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000));
    reply.header(
      "Set-Cookie",
      this.sessionCookieFactory.createSessionCookie(result.token, cookieMaxAgeSeconds),
    );

    return {
      ok: true,
      twoFactorRequired: false,
      sessionId: result.sessionId,
      token: result.token,
      expiresAt: result.expiresAt,
      user: {
        id: result.userId,
        email: result.email,
        fullName: result.fullName,
      },
    };
  }

  @Post("logout")
  @UseGuards(RequestContextAuthGuard)
  @HttpCode(200)
  public async logout(
    @CurrentRequestContext() requestContext: RequestContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true }> {
    await this.authService.logout(requestContext.token);
    reply.header("Set-Cookie", this.sessionCookieFactory.createExpiredCookie());
    return { ok: true };
  }

  @Get("session")
  @UseGuards(RequestContextAuthGuard)
  public async session(@CurrentRequestContext() requestContext: RequestContext): Promise<Record<string, unknown>> {
    const session = await this.authService.validateToken(requestContext.token);
    if (!session) {
      throw new AppError("Invalid or expired session.", "AUTH_SESSION_INVALID", 401);
    }

    const roleKeys = await this.listWorkspaceRoleKeys(
      requestContext.workspace.workspaceId,
      requestContext.workspace.userId,
    );

    return {
      ok: true,
      sessionId: requestContext.sessionId,
      workspaceId: requestContext.workspace.workspaceId,
      userId: requestContext.workspace.userId,
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
        roleKeys,
      },
    };
  }

  @Get("me")
  @UseGuards(RequestContextAuthGuard)
  public async me(@CurrentRequestContext() requestContext: RequestContext): Promise<Record<string, unknown>> {
    const userId = requestContext.workspace.userId;
    const workspaceId = requestContext.workspace.workspaceId;
    const prisma = PrismaClientManager.getClient();

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deleted_at: null,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        created_at: true,
        password_updated_at: true,
        two_factor_enabled: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      throw new AppError("Invalid user.", "AUTH_USER_INVALID", 401);
    }

    const fullName = [user.first_name, user.last_name ?? ""].join(" ").trim();
    const roleKeys = await this.listWorkspaceRoleKeys(workspaceId, userId);
    const normalizedRoleKeys = roleKeys.map((item) => item.trim().toLowerCase());
    let roleLabel = "Operatore";
    if (normalizedRoleKeys.includes("superadmin")) {
      roleLabel = "Superadmin";
    } else if (normalizedRoleKeys.includes("admin")) {
      roleLabel = "Admin";
    }

    return {
      ok: true,
      user: {
        id: user.id,
        fullName,
        roleLabel,
        email: user.email,
        memberSince: user.created_at,
        passwordUpdatedAt: user.password_updated_at,
        twoFactorEnabled: user.two_factor_enabled,
      },
    };
  }

  @Post("password/forgot")
  @HttpCode(200)
  public async forgotPassword(@Body() bodyRaw: unknown): Promise<Record<string, unknown>> {
    const body = forgotPasswordSchema.parse(bodyRaw);
    const outcome = await this.passwordResetService.requestReset(body.email);

    return {
      ok: true,
      message: "If the account exists, a reset code has been generated.",
      expiresAt: outcome?.expiresAt ?? null,
      debugCode: outcome?.debugCode ?? null,
    };
  }

  @Post("password/reset")
  @HttpCode(200)
  public async resetPassword(@Body() bodyRaw: unknown): Promise<{ ok: true; message: string }> {
    const body = resetPasswordSchema.parse(bodyRaw);
    await this.passwordResetService.resetPassword({
      email: body.email,
      code: body.code,
      newPassword: body.newPassword,
    });

    return { ok: true, message: "Password reset completed." };
  }

  @Post("password/change")
  @UseGuards(RequestContextAuthGuard)
  @HttpCode(200)
  public async changePassword(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<{ ok: true; message: string }> {
    const body = changePasswordSchema.parse(bodyRaw);
    await this.authService.changePassword({
      userId: requestContext.workspace.userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      currentSessionId: requestContext.sessionId,
    });

    return { ok: true, message: "Password aggiornata correttamente." };
  }

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

  private async listWorkspaceRoleKeys(workspaceId: string, userId: string): Promise<string[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.userWorkspaceRole.findMany({
      where: {
        workspace_id: workspaceId,
        user_id: userId,
      },
      select: {
        role: {
          select: {
            key: true,
          },
        },
      },
    });

    return rows.map((row) => row.role.key);
  }
}
