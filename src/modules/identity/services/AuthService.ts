import { AppError } from "../../../core/errors/AppError.js";
import { LoginCommand } from "../dto/LoginCommand.js";
import { LoginResult } from "../dto/LoginResult.js";
import { AuthSessionRepository } from "../repositories/AuthSessionRepository.js";
import { UserAccountRepository } from "../repositories/UserAccountRepository.js";
import { PasswordHasher } from "./PasswordHasher.js";
import { SessionTokenService } from "./SessionTokenService.js";

export class AuthService {
  private readonly userRepository: UserAccountRepository;
  private readonly sessionRepository: AuthSessionRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly tokenService: SessionTokenService;
  private readonly sessionHours: number;
  private readonly rememberDays: number;

  public constructor(
    userRepository: UserAccountRepository,
    sessionRepository: AuthSessionRepository,
    passwordHasher: PasswordHasher,
    tokenService: SessionTokenService,
    sessionHours = 12,
    rememberDays = 30,
  ) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.sessionHours = sessionHours;
    this.rememberDays = rememberDays;
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

    const token = this.tokenService.generateToken();
    const tokenHash = this.tokenService.hashToken(token);
    const expiresAt = this.resolveExpiration(command.rememberMe);

    const created = await this.sessionRepository.create({
      userId: user.id,
      tokenHash,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      expiresAt,
    });

    const fullName = [user.firstName, user.lastName ?? ""].join(" ").trim();

    return new LoginResult({
      sessionId: created.id,
      token,
      expiresAt,
      userId: user.id,
      email: user.email,
      fullName,
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

  private resolveExpiration(rememberMe: boolean): Date {
    const milliseconds = rememberMe
      ? this.rememberDays * 24 * 60 * 60 * 1000
      : this.sessionHours * 60 * 60 * 1000;

    return new Date(Date.now() + milliseconds);
  }
}
