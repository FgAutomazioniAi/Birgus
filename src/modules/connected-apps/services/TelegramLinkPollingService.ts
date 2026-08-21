import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { ConnectedAppsService } from "./ConnectedAppsService.js";

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string };
    from?: { id?: number | string; username?: string };
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: {
      message_id?: number;
      chat?: { id?: number | string };
    };
  };
}

type InlineKeyboard = Array<Array<{ text: string; callback_data: string }>>;

@Injectable()
export class TelegramLinkPollingService {
  private readonly logger = new Logger(TelegramLinkPollingService.name);
  private readonly menuMessageIds = new Map<string, number>();
  private readonly pendingLinkChats = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  public constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConnectedAppsService)
    private readonly connectedAppsService: ConnectedAppsService,
  ) {}

  public start(): void {
    if (this.timer || !this.botToken()) {
      return;
    }
    this.timer = setInterval(() => void this.poll(), 15_000);
    void this.poll();
    this.logger.log("Telegram account-link worker started every 15000ms.");
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.isPolling) {
      return;
    }
    const token = this.botToken();
    if (!token) {
      return;
    }

    this.isPolling = true;
    try {
      const offset = await this.getOffset();
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset, timeout: 10, allowed_updates: ["message", "callback_query"] }),
      });
      if (!response.ok) {
        this.logger.warn(`Telegram polling failed with HTTP ${response.status}.`);
        return;
      }
      const payload = await response.json() as { ok?: boolean; result?: TelegramUpdate[]; description?: string };
      if (!payload.ok || !Array.isArray(payload.result)) {
        this.logger.warn(`Telegram polling rejected: ${payload.description ?? "invalid payload"}`);
        return;
      }
      for (const update of payload.result) {
        await this.processUpdate(token, update);
        if (typeof update.update_id === "number") {
          await this.setOffset(update.update_id + 1);
        }
      }
    } catch (error) {
      this.logger.warn(`Telegram polling unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      this.isPolling = false;
    }
  }

  private async processUpdate(token: string, update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.processCallbackQuery(token, update.callback_query);
      return;
    }

    const message = update.message;
    const text = message?.text?.trim() ?? "";
    const chatId = message?.chat?.id;
    if (chatId === undefined || chatId === null) {
      return;
    }
    const recipientId = String(chatId);
    const explicitMatch = text.match(/^\/(?:link|start)(?:@\w+)?\s+([A-Za-z0-9_-]{6,64})$/i);
    const codeOnlyMatch = text.match(/^([A-Za-z0-9_-]{6,64})$/i);
    const hasPendingLink = (this.pendingLinkChats.get(recipientId) ?? 0) > Date.now();

    if (/^\/start(?:@\w+)?$/i.test(text)) {
      await this.deleteIncomingMessage(token, recipientId, message?.message_id);
      await this.showMainMenu(token, recipientId);
      return;
    }

    if (!explicitMatch && !hasPendingLink) {
      if (/^\/link(?:@\w+)?$/i.test(text)) {
        await this.deleteIncomingMessage(token, recipientId, message?.message_id);
        await this.showLinkInstructions(token, recipientId);
      }
      return;
    }

    const code = explicitMatch?.[1] ?? codeOnlyMatch?.[1];
    if (!code) {
      await this.showLinkInstructions(token, recipientId);
      return;
    }
    this.pendingLinkChats.delete(recipientId);

    const app = await this.connectedAppsService.completeTelegramLink({
      code,
      chatId: recipientId,
      telegramUserId: message?.from?.id === undefined ? null : String(message.from.id),
      username: message?.from?.username ?? null,
    });
    await this.deleteIncomingMessage(token, recipientId, message?.message_id);
    await this.showMainMenu(token, recipientId, app
      ? "Account Birgus collegato. Ora puoi selezionare questo canale nei workflow."
      : "Codice non valido o scaduto. Generane uno nuovo dalla dashboard Birgus.");
  }

  private async processCallbackQuery(
    token: string,
    query: NonNullable<TelegramUpdate["callback_query"]>,
  ): Promise<void> {
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    if (!query.id || chatId === undefined || chatId === null || !messageId) {
      return;
    }

    const recipientId = String(chatId);
    this.menuMessageIds.set(recipientId, messageId);
    await this.answerCallbackQuery(token, query.id);
    if (query.data === "birgus:link") {
      await this.showLinkInstructions(token, recipientId, messageId);
      return;
    }
    if (query.data === "birgus:info") {
      await this.editMenuMessage(
        token,
        recipientId,
        messageId,
        "Ciao! sono il tuo assistente per ricevere informazioni dai tuoi flussi di lavoro su Birgus.",
        [[{ text: "Torna al menu", callback_data: "birgus:menu" }]],
      );
      return;
    }
    if (query.data === "birgus:menu") {
      this.pendingLinkChats.delete(recipientId);
      await this.showMainMenu(token, recipientId, undefined, messageId);
    }
  }

  private async showMainMenu(token: string, chatId: string, status?: string, messageId?: number): Promise<void> {
    const text = status ? `${status}\n\nCosa vuoi fare?` : "Benvenuto in Birgus. Cosa vuoi fare?";
    const keyboard: InlineKeyboard = [
      [{ text: "Collega account", callback_data: "birgus:link" }],
      [{ text: "Info", callback_data: "birgus:info" }],
    ];
    const targetMessageId = messageId ?? this.menuMessageIds.get(chatId);
    if (targetMessageId) {
      await this.editMenuMessage(token, chatId, targetMessageId, text, keyboard);
      return;
    }
    const result = await this.telegramApi<{ message_id?: number }>(token, "sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: keyboard },
    });
    if (typeof result?.message_id === "number") {
      this.menuMessageIds.set(chatId, result.message_id);
    }
  }

  private async showLinkInstructions(token: string, chatId: string, messageId?: number): Promise<void> {
    this.pendingLinkChats.set(chatId, Date.now() + 10 * 60 * 1000);
    const keyboard: InlineKeyboard = [[{ text: "Annulla", callback_data: "birgus:menu" }]];
    const text = "Mandami il codice generato dalla tua Dashboard su Birgus.";
    const targetMessageId = messageId ?? this.menuMessageIds.get(chatId);
    if (targetMessageId) {
      await this.editMenuMessage(token, chatId, targetMessageId, text, keyboard);
      return;
    }
    const result = await this.telegramApi<{ message_id?: number }>(token, "sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: keyboard },
    });
    if (typeof result?.message_id === "number") {
      this.menuMessageIds.set(chatId, result.message_id);
    }
  }

  private async editMenuMessage(
    token: string,
    chatId: string,
    messageId: number,
    text: string,
    keyboard: InlineKeyboard,
  ): Promise<void> {
    await this.telegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private async answerCallbackQuery(token: string, callbackQueryId: string): Promise<void> {
    await this.telegramApi(token, "answerCallbackQuery", { callback_query_id: callbackQueryId });
  }

  private async deleteIncomingMessage(token: string, chatId: string, messageId: number | undefined): Promise<void> {
    if (messageId) {
      await this.telegramApi(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
    }
  }

  private async telegramApi<T = unknown>(token: string, method: string, body: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { ok?: boolean; result?: T };
      if (!response.ok || !payload.ok) {
        this.logger.warn(`Telegram ${method} failed.`);
        return null;
      }
      return payload.result ?? null;
    } catch (error) {
      this.logger.warn(`Telegram ${method} unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
      return null;
    }
  }

  private async getOffset(): Promise<number | undefined> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: "telegram_link_polling_offset" },
      select: { value: true },
    });
    const value = setting?.value;
    return typeof value === "object" && value !== null && "offset" in value && typeof value.offset === "number"
      ? value.offset
      : undefined;
  }

  private async setOffset(offset: number): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: "telegram_link_polling_offset" },
      create: { key: "telegram_link_polling_offset", value: { offset } },
      update: { value: { offset } },
    });
  }

  private botToken(): string | null {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
    return token || null;
  }
}
