import { AppError } from "../../../core/errors/AppError.js";
import { LoginCommand } from "../dto/LoginCommand.js";
import { LoginResult } from "../dto/LoginResult.js";
import { AuthSessionRepository } from "../repositories/AuthSessionRepository.js";
import { AuthLoginChallengeRepository } from "../repositories/AuthLoginChallengeRepository.js";
import { UserAccountRepository } from "../repositories/UserAccountRepository.js";
import { PasswordHasher } from "./PasswordHasher.js";
import { SessionTokenService } from "./SessionTokenService.js";
import { TotpSecretCipherService } from "./TotpSecretCipherService.js";
import { TotpService } from "./TotpService.js";

export class AuthService {
  private readonly userRepository: UserAccountRepository;
  private readonly sessionRepository: AuthSessionRepository;
  private readonly authLoginChallengeRepository: AuthLoginChallengeRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly tokenService: SessionTokenService;
  private readonly totpService: TotpService;
  private readonly totpSecretCipherService: TotpSecretCipherService;
  private readonly totpIssuer: string;
  private readonly sessionHours: number;
  private readonly rememberDays: number;
  private readonly twoFactorChallengeMinutes: number;

  public constructor(
    userRepository: UserAccountRepository,
    sessionRepository: AuthSessionRepository,
    authLoginChallengeRepository: AuthLoginChallengeRepository,
    passwordHasher: PasswordHasher,
    tokenService: SessionTokenService,
    totpService: TotpService,
    totpSecretCipherService: TotpSecretCipherService,
    totpIssuer = "Birgus",
    sessionHours = 12,
    rememberDays = 30,
    twoFactorChallengeMinutes = 5,
  ) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.authLoginChallengeRepository = authLoginChallengeRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.totpService = totpService;
    this.totpSecretCipherService = totpSecretCipherService;
    this.totpIssuer = totpIssuer;
    this.sessionHours = sessionHours;
    this.rememberDays = rememberDays;
    this.twoFactorChallengeMinutes = twoFactorChallengeMinutes;
  }

  public async login(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(command.email);

    if (!user || !user.passwordHash || !user.isActive) {
      throw new AppError("Invalid credentials.", "AUTH_INVALID_CREDENTIALS", 401);
    }

    const passwordValid = await this.passwordHasher.verifyPassword(command.password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError("Invalid credentials.", "AUTH_INVALID_CREDENTIALS", 401);
    }

    const fullName = [user.firstName, user.lastName ?? ""].join(" ").trim();
    const isSuperadmin = await this.userRepository.isSuperadmin(user.id);

    if (isSuperadmin) {
      const challengeToken = this.tokenService.generateToken();
      const challengeHash = this.tokenService.hashToken(challengeToken);
      const setupRequired = !user.twoFactorEnabled || !user.twoFactorSecretCiphertext;
      const setupSecret = setupRequired ? this.totpService.generateSecret() : null;

      await this.authLoginChallengeRepository.create({
        userId: user.id,
        challengeHash,
        rememberMe: command.rememberMe,
        requiresTotpSetup: setupRequired,
        setupSecretCiphertext: setupSecret ? this.totpSecretCipherService.encrypt(setupSecret) : null,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        expiresAt: new Date(Date.now() + this.twoFactorChallengeMinutes * 60 * 1000),
      });

      const setupUri = setupSecret
        ? this.totpService.buildOtpAuthUri({
          issuer: this.totpIssuer,
          accountName: user.email,
          secret: setupSecret,
        })
        : null;

      return new LoginResult({
        userId: user.id,
        email: user.email,
        fullName,
        requiresTwoFactor: true,
        twoFactorChallengeToken: challengeToken,
        twoFactorSetupRequired: setupRequired,
        twoFactorSetupSecret: setupSecret,
        twoFactorSetupUri: setupUri,
      });
    }

    return this.createSessionLoginResult({
      userId: user.id,
      email: user.email,
      fullName,
      rememberMe: command.rememberMe,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });
  }

  public async verifyTwoFactorLogin(params: {
    challengeToken: string;
    otpCode: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<LoginResult> {
    await this.authLoginChallengeRepository.deleteExpired(new Date());
    const challengeHash = this.tokenService.hashToken(params.challengeToken.trim());
    const challenge = await this.authLoginChallengeRepository.findByChallengeHash(challengeHash);

    if (!challenge || !challenge.isUsable(new Date())) {
      throw new AppError("Challenge 2FA non valido o scaduto.", "AUTH_2FA_CHALLENGE_INVALID", 401);
    }

    const user = await this.userRepository.findById(challenge.userId);
    if (!user || !user.isActive) {
      throw new AppError("Invalid credentials.", "AUTH_INVALID_CREDENTIALS", 401);
    }

    const fullName = [user.firstName, user.lastName ?? ""].join(" ").trim();

    let effectiveSecret: string;
    if (challenge.requiresTotpSetup) {
      if (!challenge.setupSecretCiphertext) {
        throw new AppError("Setup 2FA non disponibile.", "AUTH_2FA_SETUP_MISSING", 400);
      }

      effectiveSecret = this.totpSecretCipherService.decrypt(challenge.setupSecretCiphertext);
      const isValidSetupOtp = this.totpService.verify({ secret: effectiveSecret, code: params.otpCode, window: 1 });
      if (!isValidSetupOtp) {
        throw new AppError("Codice 2FA non valido.", "AUTH_2FA_OTP_INVALID", 401);
      }

      await this.userRepository.setTwoFactorSecret(
        user.id,
        this.totpSecretCipherService.encrypt(effectiveSecret),
      );
    } else {
      if (!user.twoFactorEnabled || !user.twoFactorSecretCiphertext) {
        throw new AppError("Autenticazione 2FA non configurata.", "AUTH_2FA_NOT_CONFIGURED", 400);
      }

      effectiveSecret = this.totpSecretCipherService.decrypt(user.twoFactorSecretCiphertext);
      const isValidOtp = this.totpService.verify({ secret: effectiveSecret, code: params.otpCode, window: 1 });
      if (!isValidOtp) {
        throw new AppError("Codice 2FA non valido.", "AUTH_2FA_OTP_INVALID", 401);
      }
      await this.userRepository.markTwoFactorVerified(user.id);
    }

    await this.authLoginChallengeRepository.consumeById(challenge.id);

    return this.createSessionLoginResult({
      userId: user.id,
      email: user.email,
      fullName,
      rememberMe: challenge.rememberMe,
      ipAddress: params.ipAddress ?? challenge.ipAddress,
      userAgent: params.userAgent ?? challenge.userAgent,
    });
  }

  private async createSessionLoginResult(params: {
    userId: string;
    email: string;
    fullName: string;
    rememberMe: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<LoginResult> {
    const token = this.tokenService.generateToken();
    const tokenHash = this.tokenService.hashToken(token);
    const expiresAt = this.resolveExpiration(params.rememberMe);

    const created = await this.sessionRepository.create({
      userId: params.userId,
      tokenHash,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt,
    });

    return new LoginResult({
      sessionId: created.id,
      token,
      expiresAt,
      userId: params.userId,
      email: params.email,
      fullName: params.fullName,
    });
  }

  public async validateToken(token: string): Promise<{
    sessionId: string;
    userId: string;
    email: string;
    fullName: string;
    expiresAt: Date;
  } | null> {
    const tokenHash = this.tokenService.hashToken(token);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!session || !session.isValid(new Date())) {
      return null;
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || !user.isActive) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      email: user.email,
      fullName: [user.firstName, user.lastName ?? ""].join(" ").trim(),
      expiresAt: session.expiresAt,
    };
  }

  public async logout(token: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(token);
    await this.sessionRepository.revokeByTokenHash(tokenHash);
  }

  public async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hash = await this.passwordHasher.hashPassword(newPassword);
    await this.userRepository.updatePassword(userId, hash);
    await this.sessionRepository.revokeAllForUser(userId);
  }

  public async changePassword(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    currentSessionId: string;
  }): Promise<void> {
    const user = await this.userRepository.findById(params.userId);
    if (!user || !user.isActive || !user.passwordHash) {
      throw new AppError("Utente non valido.", "AUTH_USER_INVALID", 401);
    }

    const currentPasswordValid = await this.passwordHasher.verifyPassword(params.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new AppError("Password attuale non corretta.", "AUTH_CURRENT_PASSWORD_INVALID", 401);
    }

    const nextHash = await this.passwordHasher.hashPassword(params.newPassword);
    await this.userRepository.updatePassword(user.id, nextHash);
    await this.sessionRepository.revokeAllForUserExceptSession(user.id, params.currentSessionId);
  }

  private resolveExpiration(rememberMe: boolean): Date {
    const milliseconds = rememberMe
      ? this.rememberDays * 24 * 60 * 60 * 1000
      : this.sessionHours * 60 * 60 * 1000;

    return new Date(Date.now() + milliseconds);
  }
}
