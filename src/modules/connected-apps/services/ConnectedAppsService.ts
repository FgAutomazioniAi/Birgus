import { createHash, randomInt } from "node:crypto";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../../nest/prisma/prisma.service.js";

export type ConnectedAppProvider = "telegram";

export interface ConnectedAppDto {
  id: string;
  provider: ConnectedAppProvider;
  recipientId: string;
  username: string | null;
  label: string;
  isDefault: boolean;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConnectedAppsService {
  public constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  public async createTelegramLinkCode(input: { workspaceId: string; userId: string }): Promise<{
    code: string;
    expiresAt: Date;
    botUsername: string | null;
  }> {
    if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      throw new BadRequestException("Bot Telegram non configurato. Imposta TELEGRAM_BOT_TOKEN prima di collegare un account.");
    }

    const code = this.createLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.telegramLinkCode.deleteMany({
      where: {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        consumed_at: null,
      },
    });
    await this.prisma.telegramLinkCode.create({
      data: {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        code_hash: this.hashLinkCode(code),
        expires_at: expiresAt,
      },
    });

    return {
      code,
      expiresAt,
      botUsername: this.normalizeBotUsername(process.env.TELEGRAM_BOT_USERNAME ?? null),
    };
  }

  public async completeTelegramLink(input: {
    code: string;
    chatId: string;
    telegramUserId?: string | null;
    username?: string | null;
  }): Promise<ConnectedAppDto | null> {
    const codeHash = this.hashLinkCode(input.code);
    const now = new Date();
    const chatId = input.chatId.trim();
    if (!/^-?\d{4,30}$/.test(chatId)) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const link = await tx.telegramLinkCode.findFirst({
        where: {
          code_hash: codeHash,
          consumed_at: null,
          expires_at: { gt: now },
        },
      });
      if (!link) {
        return null;
      }

      await tx.telegramLinkCode.update({
        where: { id: link.id },
        data: { consumed_at: now },
      });
      await tx.userMessagingChannel.updateMany({
        where: {
          workspace_id: link.workspace_id,
          user_id: link.user_id,
          provider: "telegram",
          deleted_at: null,
        },
        data: { is_default: false },
      });
      const username = input.username?.trim() || null;
      const row = await tx.userMessagingChannel.upsert({
        where: {
          workspace_id_user_id_provider_recipient_id: {
            workspace_id: link.workspace_id,
            user_id: link.user_id,
            provider: "telegram",
            recipient_id: chatId,
          },
        },
        create: {
          workspace_id: link.workspace_id,
          user_id: link.user_id,
          provider: "telegram",
          recipient_id: chatId,
          external_user_id: input.telegramUserId?.trim() || null,
          username,
          label: username ? `Telegram @${username}` : "Telegram personale",
          is_default: true,
          verified_at: now,
        },
        update: {
          external_user_id: input.telegramUserId?.trim() || null,
          username,
          label: username ? `Telegram @${username}` : "Telegram personale",
          is_default: true,
          verified_at: now,
          deleted_at: null,
        },
      });
      return this.toDto(row);
    });
  }

  public async listUserApps(params: {
    workspaceId: string;
    userId: string;
    provider?: ConnectedAppProvider;
  }): Promise<ConnectedAppDto[]> {
    const rows = await this.prisma.userMessagingChannel.findMany({
      where: {
        workspace_id: params.workspaceId,
        user_id: params.userId,
        deleted_at: null,
        ...(params.provider ? { provider: params.provider } : {}),
      },
      orderBy: [{ is_default: "desc" }, { updated_at: "desc" }],
    });

    return rows.map((row) => this.toDto(row));
  }

  public async deleteUserApp(params: {
    workspaceId: string;
    userId: string;
    appId: string;
  }): Promise<void> {
    const row = await this.prisma.userMessagingChannel.findFirst({
      where: {
        id: params.appId,
        workspace_id: params.workspaceId,
        user_id: params.userId,
        deleted_at: null,
      },
    });

    if (!row) {
      throw new NotFoundException("Applicativo collegato non trovato.");
    }

    await this.prisma.userMessagingChannel.update({
      where: { id: row.id },
      data: { deleted_at: new Date(), is_default: false },
    });
  }

  public async resolveTelegramChatId(params: {
    workspaceId: string;
    userId: string | null;
    channelId?: unknown;
    fallbackChatId?: unknown;
  }): Promise<string> {
    const fallback = typeof params.fallbackChatId === "string" ? params.fallbackChatId.trim() : "";
    const channelId = typeof params.channelId === "string" ? params.channelId.trim() : "";

    if (!channelId) {
      return fallback;
    }

    if (!params.userId) {
      throw new BadRequestException("Impossibile usare il collegamento Telegram: utente workflow assente.");
    }

    const row = await this.prisma.userMessagingChannel.findFirst({
      where: {
        id: channelId,
        workspace_id: params.workspaceId,
        user_id: params.userId,
        provider: "telegram",
        deleted_at: null,
      },
    });

    if (!row) {
      throw new BadRequestException("Collegamento Telegram non trovato per questo utente.");
    }

    return row.recipient_id;
  }

  private toDto(row: {
    id: string;
    provider: string;
    recipient_id: string;
    username: string | null;
    label: string | null;
    is_default: boolean;
    verified_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): ConnectedAppDto {
    return {
      id: row.id,
      provider: row.provider as ConnectedAppProvider,
      recipientId: row.recipient_id,
      username: row.username,
      label: row.label?.trim() || this.defaultLabel(row.provider),
      isDefault: row.is_default,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private defaultLabel(provider: string): string {
    return provider === "telegram" ? "Telegram personale" : provider;
  }

  private hashLinkCode(code: string): string {
    return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
  }

  private createLinkCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  }

  private normalizeBotUsername(value: string | null): string | null {
    const username = value?.trim().replace(/^@/, "") ?? "";
    return username || null;
  }
}
