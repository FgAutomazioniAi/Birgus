import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AssistantMessageEntity } from "../domain/AssistantMessageEntity.js";
import { AssistantSessionEntity } from "../domain/AssistantSessionEntity.js";
import { AssistantSessionRepository } from "../repositories/AssistantSessionRepository.js";
import { PrismaAssistantSessionRepository } from "../infra/PrismaAssistantSessionRepository.js";
import { normalizeKnowledgeMode, type KnowledgeMode } from "../../document-intelligence/domain/KnowledgeMode.js";

export interface AssistantMemorySnapshotView {
  summaryText: string;
  extractedFacts: Record<string, unknown> | null;
  messageCount: number;
  tokenEstimate: number | null;
  generatedAt: Date;
}

export class AssistantSessionService {
  private readonly repository: AssistantSessionRepository;

  public constructor(repository?: AssistantSessionRepository) {
    this.repository = repository ?? new PrismaAssistantSessionRepository();
  }

  public async listSessionsForUser(workspaceId: string, userId: string): Promise<AssistantSessionEntity[]> {
    return this.repository.listSessions(workspaceId, userId);
  }

  public async createSession(params: {
    workspaceId: string;
    openedByUserId: string;
    moduleKey?: string | null;
    title?: string | null;
    contextEntityType?: string | null;
    contextEntityId?: string | null;
    projectId?: string | null;
    projectVersionId?: number | null;
    clientId?: string | null;
    shipmentId?: string | null;
    documentId?: string | null;
    ddtDocumentId?: string | null;
    knowledgeMode?: KnowledgeMode | string | null;
  }): Promise<AssistantSessionEntity> {
    const moduleId = await this.resolveModuleId(params.moduleKey ?? null);
    return this.repository.createSession({
      workspaceId: params.workspaceId,
      openedByUserId: params.openedByUserId,
      moduleId,
      title: this.normalizeOptionalText(params.title),
      contextEntityType: this.normalizeOptionalText(params.contextEntityType),
      contextEntityId: this.normalizeOptionalText(params.contextEntityId),
      projectId: this.normalizeOptionalText(params.projectId),
      projectVersionId: params.projectVersionId ?? null,
      clientId: this.normalizeOptionalText(params.clientId),
      shipmentId: this.normalizeOptionalText(params.shipmentId),
      documentId: this.normalizeOptionalText(params.documentId),
      ddtDocumentId: this.normalizeOptionalText(params.ddtDocumentId),
      configuration: {
        knowledgeMode: normalizeKnowledgeMode(params.knowledgeMode, "on_demand"),
      },
    });
  }

  public async updateKnowledgeModeForUser(
    workspaceId: string,
    userId: string,
    sessionId: string,
    knowledgeMode: KnowledgeMode | string | null,
  ): Promise<AssistantSessionEntity> {
    const session = await this.getSessionForUser(workspaceId, userId, sessionId);
    const nextConfiguration = {
      ...(session.configuration ?? {}),
      knowledgeMode: normalizeKnowledgeMode(knowledgeMode, "on_demand"),
    };
    return this.repository.updateSessionConfiguration({
      workspaceId,
      sessionId,
      configuration: nextConfiguration,
    });
  }

  public async getSessionForUser(workspaceId: string, userId: string, sessionId: string): Promise<AssistantSessionEntity> {
    const session = await this.repository.findSessionById(workspaceId, sessionId);
    if (!session) {
      throw new AppError("Sessione assistente non trovata.", "ASSISTANT_SESSION_NOT_FOUND", 404);
    }

    if (session.openedByUserId && session.openedByUserId !== userId) {
      throw new AppError("Sessione assistente non accessibile.", "ASSISTANT_SESSION_FORBIDDEN", 403);
    }

    return session;
  }

  public async listMessagesForUser(workspaceId: string, userId: string, sessionId: string): Promise<AssistantMessageEntity[]> {
    await this.getSessionForUser(workspaceId, userId, sessionId);
    return this.repository.listMessages(workspaceId, sessionId);
  }

  public async closeSessionForUser(workspaceId: string, userId: string, sessionId: string): Promise<void> {
    const session = await this.getSessionForUser(workspaceId, userId, sessionId);
    if (session.status === "CLOSED") {
      return;
    }

    await this.repository.closeSession(workspaceId, sessionId);
  }

  public async findLatestMemorySnapshot(workspaceId: string, userId: string, sessionId: string): Promise<AssistantMemorySnapshotView | null> {
    await this.getSessionForUser(workspaceId, userId, sessionId);

    const prisma = PrismaClientManager.getClient();
    const row = await prisma.assistantMemorySnapshot.findFirst({
      where: {
        workspace_id: workspaceId,
        session_id: sessionId,
      },
      orderBy: {
        generated_at: "desc",
      },
    });

    if (!row) {
      return null;
    }

    return {
      summaryText: row.summary_text,
      extractedFacts: row.extracted_facts && typeof row.extracted_facts === "object"
        ? row.extracted_facts as Record<string, unknown>
        : null,
      messageCount: row.message_count,
      tokenEstimate: row.token_estimate,
      generatedAt: row.generated_at,
    };
  }

  private async resolveModuleId(moduleKey: string | null): Promise<number | null> {
    const normalized = this.normalizeOptionalText(moduleKey);
    if (!normalized) {
      return null;
    }

    const prisma = PrismaClientManager.getClient();
    const row = await prisma.module.findFirst({
      where: {
        key: normalized,
        is_active: true,
      },
      select: {
        id: true,
      },
    });

    if (!row) {
      throw new AppError(`Modulo '${normalized}' non trovato.`, "ASSISTANT_MODULE_NOT_FOUND", 404);
    }

    return row.id;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
