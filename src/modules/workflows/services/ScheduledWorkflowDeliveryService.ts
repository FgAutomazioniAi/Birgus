import { Logger } from "@nestjs/common";
import {
  Prisma,
  ScheduledWorkflowDeliveryChannel,
  ScheduledWorkflowDeliveryStatus,
} from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { BackendPythonModulesClient } from "../../document-intelligence/services/BackendPythonModulesClient.js";

export type ScheduledDeliveryChannel = "email" | "telegram" | "whatsapp";

export interface ScheduleWorkflowDeliveryCommand {
  workspaceId: string;
  workflowRunId?: string | null;
  workflowNodeId?: string | null;
  channel: ScheduledDeliveryChannel;
  recipient: string;
  subject?: string | null;
  message: string;
  attachments?: unknown;
  providerPayload?: unknown;
  runAt: Date;
  repeatEverySeconds?: number | null;
}

export class ScheduledWorkflowDeliveryService {
  private readonly logger = new Logger(ScheduledWorkflowDeliveryService.name);
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  public constructor(
    private readonly pythonModulesClient: BackendPythonModulesClient,
    options: { pollIntervalMs?: number; maxAttempts?: number } = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? this.readPositiveInt("SCHEDULED_WORKFLOW_DELIVERY_POLL_MS", 15_000);
    this.maxAttempts = options.maxAttempts ?? this.readPositiveInt("SCHEDULED_WORKFLOW_DELIVERY_MAX_ATTEMPTS", 5);
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    void this.processDueDeliveries();
    this.timer = setInterval(() => void this.processDueDeliveries(), this.pollIntervalMs);
    this.timer.unref?.();
    this.logger.log(`Scheduled workflow delivery worker started every ${this.pollIntervalMs}ms.`);
  }

  public async schedule(command: ScheduleWorkflowDeliveryCommand): Promise<{
    id: string;
    channel: ScheduledDeliveryChannel;
    recipient: string;
    nextRunAt: Date;
  }> {
    const recipient = command.recipient.trim();
    const message = command.message.trim();
    if (!recipient) {
      throw new Error("Destinatario mancante per invio pianificato.");
    }
    if (!message) {
      throw new Error("Messaggio mancante per invio pianificato.");
    }
    if (Number.isNaN(command.runAt.getTime())) {
      throw new Error("Data pianificazione non valida.");
    }

    const prisma = PrismaClientManager.getClient();
    const row = await prisma.scheduledWorkflowDelivery.create({
      data: {
        workspace_id: command.workspaceId,
        workflow_run_id: command.workflowRunId ?? null,
        workflow_node_id: command.workflowNodeId ?? null,
        channel: this.toPrismaChannel(command.channel),
        recipient,
        subject: command.subject?.trim() || null,
        message,
        attachments: this.toJsonInput(command.attachments),
        provider_payload: this.toJsonInput(command.providerPayload),
        run_at: command.runAt,
        repeat_every_seconds: command.repeatEverySeconds ?? null,
        next_run_at: command.runAt,
        status: ScheduledWorkflowDeliveryStatus.ACTIVE,
      },
    });

    return {
      id: row.id,
      channel: this.fromPrismaChannel(row.channel),
      recipient: row.recipient,
      nextRunAt: row.next_run_at,
    };
  }

  public async processDueDeliveries(limit = 20): Promise<number> {
    if (this.isProcessing) {
      return 0;
    }

    this.isProcessing = true;
    try {
      const prisma = PrismaClientManager.getClient();
      const dueRows = await prisma.scheduledWorkflowDelivery.findMany({
        where: {
          status: ScheduledWorkflowDeliveryStatus.ACTIVE,
          next_run_at: {
            lte: new Date(),
          },
        },
        orderBy: {
          next_run_at: "asc",
        },
        take: limit,
      });

      let sent = 0;
      for (const row of dueRows) {
        if (await this.processOne(row.id)) {
          sent += 1;
        }
      }
      return sent;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOne(id: string): Promise<boolean> {
    const prisma = PrismaClientManager.getClient();
    const claimed = await prisma.scheduledWorkflowDelivery.updateMany({
      where: {
        id,
        status: ScheduledWorkflowDeliveryStatus.ACTIVE,
      },
      data: {
        status: ScheduledWorkflowDeliveryStatus.PROCESSING,
        attempts: {
          increment: 1,
        },
        last_error: null,
      },
    });
    if (claimed.count === 0) {
      return false;
    }

    const row = await prisma.scheduledWorkflowDelivery.findUnique({ where: { id } });
    if (!row) {
      return false;
    }

    try {
      await this.dispatch(row);
      const now = new Date();
      if (row.repeat_every_seconds && row.repeat_every_seconds > 0) {
        await prisma.scheduledWorkflowDelivery.update({
          where: { id },
          data: {
            status: ScheduledWorkflowDeliveryStatus.ACTIVE,
            last_run_at: now,
            next_run_at: new Date(now.getTime() + row.repeat_every_seconds * 1000),
            last_error: null,
          },
        });
      } else {
        await prisma.scheduledWorkflowDelivery.update({
          where: { id },
          data: {
            status: ScheduledWorkflowDeliveryStatus.COMPLETED,
            last_run_at: now,
            last_error: null,
          },
        });
      }
      return true;
    } catch (error) {
      const retryDelaySeconds = Math.min(300, 30 * Math.max(1, row.attempts));
      await prisma.scheduledWorkflowDelivery.update({
        where: { id },
        data: {
          status: row.attempts >= this.maxAttempts
            ? ScheduledWorkflowDeliveryStatus.FAILED
            : ScheduledWorkflowDeliveryStatus.ACTIVE,
          next_run_at: new Date(Date.now() + retryDelaySeconds * 1000),
          last_error: this.sanitizeError(error),
        },
      });
      return false;
    }
  }

  private async dispatch(row: {
    channel: ScheduledWorkflowDeliveryChannel;
    recipient: string;
    subject: string | null;
    message: string;
    attachments: Prisma.JsonValue | null;
    provider_payload: Prisma.JsonValue | null;
  }): Promise<void> {
    if (row.channel === ScheduledWorkflowDeliveryChannel.TELEGRAM) {
      await this.pythonModulesClient.execute("messaging_engine", "send_telegram", {
        chat_id: row.recipient,
        text: row.message,
      });
      return;
    }

    if (row.channel === ScheduledWorkflowDeliveryChannel.WHATSAPP) {
      await this.pythonModulesClient.execute("messaging_engine", "send_whatsapp", {
        to: row.recipient,
        text: row.message,
      });
      return;
    }

    await this.pythonModulesClient.execute("mail_engine", "send_email", {
      to: row.recipient,
      subject: row.subject || "Messaggio programmato",
      text: row.message,
      attachments: row.attachments ?? [],
      mail_provider: this.toProviderPayload(row.provider_payload),
    });
  }

  private toPrismaChannel(channel: ScheduledDeliveryChannel): ScheduledWorkflowDeliveryChannel {
    if (channel === "telegram") {
      return ScheduledWorkflowDeliveryChannel.TELEGRAM;
    }
    if (channel === "whatsapp") {
      return ScheduledWorkflowDeliveryChannel.WHATSAPP;
    }
    return ScheduledWorkflowDeliveryChannel.EMAIL;
  }

  private fromPrismaChannel(channel: ScheduledWorkflowDeliveryChannel): ScheduledDeliveryChannel {
    if (channel === ScheduledWorkflowDeliveryChannel.TELEGRAM) {
      return "telegram";
    }
    if (channel === ScheduledWorkflowDeliveryChannel.WHATSAPP) {
      return "whatsapp";
    }
    return "email";
  }

  private toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return value as Prisma.InputJsonValue;
  }

  private toProviderPayload(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 500);
  }

  private readPositiveInt(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
