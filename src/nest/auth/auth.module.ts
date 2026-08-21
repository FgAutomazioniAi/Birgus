import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ModuleAccessPolicy } from "../../core/module-access/ModuleAccessPolicy.js";
import { PermissionPolicy } from "../../core/authorization/PermissionPolicy.js";
import { TenancyGuard } from "../../core/tenancy/TenancyGuard.js";
import { PrismaAuthLoginChallengeRepository } from "../../modules/identity/infra/PrismaAuthLoginChallengeRepository.js";
import { PrismaAuthSessionRepository } from "../../modules/identity/infra/PrismaAuthSessionRepository.js";
import { PrismaPasswordResetCodeRepository } from "../../modules/identity/infra/PrismaPasswordResetCodeRepository.js";
import { PrismaUserAccountRepository } from "../../modules/identity/infra/PrismaUserAccountRepository.js";
import { AuthService } from "../../modules/identity/services/AuthService.js";
import { PasswordHasher } from "../../modules/identity/services/PasswordHasher.js";
import { PasswordResetService } from "../../modules/identity/services/PasswordResetService.js";
import { SessionTokenService } from "../../modules/identity/services/SessionTokenService.js";
import { SmtpPasswordResetNotifier } from "../../modules/identity/services/SmtpPasswordResetNotifier.js";
import { MailProviderSettingsService } from "../../modules/mail-runtime/services/MailProviderSettingsService.js";
import { TotpSecretCipherService } from "../../modules/identity/services/TotpSecretCipherService.js";
import { TotpService } from "../../modules/identity/services/TotpService.js";
import { SessionCookieFactory } from "../../shared/http/SessionCookieFactory.js";
import { AppConfigService } from "../config/app-config.service.js";
import { BackendProvidersModule } from "../providers/backend-providers.module.js";
import { AccessPolicyGuard } from "./access-policy.guard.js";
import { NestAuthController } from "./auth.controller.js";
import { RequestContextAuthGuard } from "./request-context-auth.guard.js";

@Module({
  imports: [BackendProvidersModule],
  controllers: [NestAuthController],
  providers: [
    {
      provide: PasswordHasher,
      useFactory: (configService: AppConfigService) => new PasswordHasher(
        resolveProductionSecret(configService, "AUTH_PEPPER"),
      ),
      inject: [AppConfigService],
    },
    {
      provide: SessionTokenService,
      useFactory: () => new SessionTokenService(),
    },
    {
      provide: TotpService,
      useFactory: (configService: AppConfigService) => new TotpService(
        configService.getNumber("AUTH_TOTP_DIGITS", 6),
        configService.getNumber("AUTH_TOTP_STEP_SECONDS", 30),
      ),
      inject: [AppConfigService],
    },
    {
      provide: TotpSecretCipherService,
      useFactory: (configService: AppConfigService) => new TotpSecretCipherService(
        resolveProductionSecret(
          configService,
          "AUTH_TOTP_ENCRYPTION_KEY",
          configService.getString("AUTH_PEPPER", ""),
        ),
      ),
      inject: [AppConfigService],
    },
    {
      provide: SessionCookieFactory,
      useFactory: (configService: AppConfigService) => new SessionCookieFactory({
        cookieName: configService.getString("AUTH_COOKIE_NAME", "vl_session"),
        domain: configService.getOptionalString("AUTH_COOKIE_DOMAIN") ?? undefined,
        path: configService.getString("AUTH_COOKIE_PATH", "/"),
        secure: parseBoolean(configService.getString("AUTH_COOKIE_SECURE", "false")),
        sameSite: resolveSameSiteMode(configService.getOptionalString("AUTH_COOKIE_SAME_SITE")),
      }),
      inject: [AppConfigService],
    },
    {
      provide: SmtpPasswordResetNotifier,
      useFactory: (mailProviderSettingsService: MailProviderSettingsService) => new SmtpPasswordResetNotifier(mailProviderSettingsService),
      inject: [MailProviderSettingsService],
    },
    {
      provide: AuthService,
      useFactory: (
        userRepository: PrismaUserAccountRepository,
        authSessionRepository: PrismaAuthSessionRepository,
        authLoginChallengeRepository: PrismaAuthLoginChallengeRepository,
        passwordHasher: PasswordHasher,
        tokenService: SessionTokenService,
        totpService: TotpService,
        totpSecretCipherService: TotpSecretCipherService,
        configService: AppConfigService,
      ) => new AuthService(
        userRepository,
        authSessionRepository,
        authLoginChallengeRepository,
        passwordHasher,
        tokenService,
        totpService,
        totpSecretCipherService,
        configService.getString("AUTH_TOTP_ISSUER", "Birgus"),
        configService.getNumber("AUTH_SESSION_HOURS", 12),
        configService.getNumber("AUTH_SESSION_REMEMBER_DAYS", 30),
        configService.getNumber("AUTH_2FA_CHALLENGE_TTL_MINUTES", 5),
      ),
      inject: [
        PrismaUserAccountRepository,
        PrismaAuthSessionRepository,
        PrismaAuthLoginChallengeRepository,
        PasswordHasher,
        SessionTokenService,
        TotpService,
        TotpSecretCipherService,
        AppConfigService,
      ],
    },
    {
      provide: PasswordResetService,
      useFactory: (
        userRepository: PrismaUserAccountRepository,
        passwordResetCodeRepository: PrismaPasswordResetCodeRepository,
        authSessionRepository: PrismaAuthSessionRepository,
        passwordHasher: PasswordHasher,
        notifier: SmtpPasswordResetNotifier,
        configService: AppConfigService,
      ) => new PasswordResetService(
        userRepository,
        passwordResetCodeRepository,
        authSessionRepository,
        passwordHasher,
        notifier,
        configService.getNumber("AUTH_PASSWORD_RESET_CODE_TTL_MINUTES", 15),
      ),
      inject: [
        PrismaUserAccountRepository,
        PrismaPasswordResetCodeRepository,
        PrismaAuthSessionRepository,
        PasswordHasher,
        SmtpPasswordResetNotifier,
        AppConfigService,
      ],
    },
    {
      provide: RequestContextAuthGuard,
      useFactory: (authService: AuthService, tenancyGuard: TenancyGuard) => new RequestContextAuthGuard(authService, tenancyGuard),
      inject: [AuthService, TenancyGuard],
    },
    {
      provide: AccessPolicyGuard,
      useFactory: (
        reflector: Reflector,
        moduleAccessPolicy: ModuleAccessPolicy,
        permissionPolicy: PermissionPolicy,
      ) => new AccessPolicyGuard(reflector, moduleAccessPolicy, permissionPolicy),
      inject: [Reflector, ModuleAccessPolicy, PermissionPolicy],
    },
  ],
  exports: [
    AuthService,
    PasswordResetService,
    PasswordHasher,
    SessionCookieFactory,
    RequestContextAuthGuard,
    AccessPolicyGuard,
  ],
})
export class AuthModule {}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveProductionSecret(configService: AppConfigService, key: string, fallback = ""): string {
  const value = configService.getString(key, fallback);
  if (process.env.NODE_ENV === "production" && !value.trim()) {
    throw new Error(`${key} is required in production.`);
  }

  return value;
}

function resolveSameSiteMode(value: string | null): "Strict" | "Lax" | "None" {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict") {
    return "Strict";
  }

  if (normalized === "none") {
    return "None";
  }

  return "Lax";
}
