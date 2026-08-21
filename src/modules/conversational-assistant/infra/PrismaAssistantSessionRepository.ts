import { Prisma } from "@prisma/client";

import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AssistantMessageEntity } from "../domain/AssistantMessageEntity.js";
import { AssistantSessionEntity } from "../domain/AssistantSessionEntity.js";
import { AssistantToolCallEntity } from "../domain/AssistantToolCallEntity.js";
import { AssistantSessionRepository } from "../repositories/AssistantSessionRepository.js";

export class PrismaAssistantSessionRepository implements AssistantSessionRepository {
  public async listSessions(workspaceId: string, userId: string): Promise<AssistantSessionEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.assistantSession.findMany({
      where: {
        workspace_id: workspaceId,
        opened_by_user_id: userId,
        deleted_at: null,
      },
      orderBy: {
        last_activity_at: "desc",
      },
    });

    return rows.map((row) => this.toSessionEntity(row));
  }

  public async createSession(params: {
    workspaceId: string;
    openedByUserId: string;
    moduleId: number | null;
    title: string | null;
    contextEntityType: string | null;
    contextEntityId: string | null;
    projectId: string | null;
    projectVersionId: number | null;
    clientId: string | null;
    shipmentId: string | null;
    documentId: string | null;
    ddtDocumentId: string | null;
    configuration: Record<string, unknown> | null;
  }): Promise<AssistantSessionEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.assistantSession.create({
      data: {
        workspace_id: params.workspaceId,
        opened_by_user_id: params.openedByUserId,
        module_id: params.moduleId,
        title: params.title,
        context_entity_type: params.contextEntityType,
        context_entity_id: params.contextEntityId,
        project_id: params.projectId,
        project_version_id: params.projectVersionId,
        client_id: params.clientId,
        shipment_id: params.shipmentId,
        document_id: params.documentId,
        ddt_document_id: params.ddtDocumentId,
        configuration: this.toInputJson(params.configuration),
      },
    });

    return this.toSessionEntity(row);
  }

  public async findSessionById(workspaceId: string, sessionId: string): Promise<AssistantSessionEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.assistantSession.findFirst({
      where: {
        id: sessionId,
        workspace_id: workspaceId,
        deleted_at: null,
      },
    });

    return row ? this.toSessionEntity(row) : null;
  }

  public async updateSessionConfiguration(params: {
    workspaceId: string;
    sessionId: string;
    configuration: Record<string, unknown>;
  }): Promise<AssistantSessionEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.assistantSession.update({
      where: {
        id: params.sessionId,
        workspace_id: params.workspaceId,
      },
      data: {
        configuration: this.toInputJson(params.configuration),
        last_activity_at: new Date(),
      },
    });

    return this.toSessionEntity(row);
  }

  public async closeSession(workspaceId: string, sessionId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.assistantSession.updateMany({
      where: {
        id: sessionId,
        workspace_id: workspaceId,
        deleted_at: null,
      },
      data: {
        status: "CLOSED",
        closed_at: new Date(),
        last_activity_at: new Date(),
      },
    });
  }

  public async appendMessage(params: {
    sessionId: string;
    workspaceId: string;
    authorUserId: string | null;
    role: string;
    contentText: string | null;
    contentPayload: Record<string, unknown> | null;
    modelName?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
  }): Promise<AssistantMessageEntity> {
    const prisma = PrismaClientManager.getClient();
    const sequence = await prisma.assistantMessage.aggregate({
      where: {
        session_id: params.sessionId,
        workspace_id: params.workspaceId,
        deleted_at: null,
      },
      _max: {
        sequence_no: true,
      },
    });

    const sequenceNo = (sequence._max.sequence_no ?? 0) + 1;
    const row = await prisma.assistantMessage.create({
      data: {
        session_id: params.sessionId,
        workspace_id: params.workspaceId,
        author_user_id: params.authorUserId,
        role: params.role as never,
        sequence_no: sequenceNo,
        content_text: params.contentText,
        content_payload: this.toInputJson(params.contentPayload),
        model_name: params.modelName ?? null,
        prompt_tokens: params.promptTokens ?? null,
        completion_tokens: params.completionTokens ?? null,
      },
    });

    await prisma.assistantSession.updateMany({
      where: {
        id: params.sessionId,
        workspace_id: params.workspaceId,
      },
      data: {
        last_activity_at: new Date(),
      },
    });

    return this.toMessageEntity(row);
  }

  public async listMessages(workspaceId: string, sessionId: string): Promise<AssistantMessageEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.assistantMessage.findMany({
      where: {
        workspace_id: workspaceId,
        session_id: sessionId,
        deleted_at: null,
      },
      orderBy: {
        sequence_no: "asc",
      },
    });

    return rows.map((row) => this.toMessageEntity(row));
  }

  public async createToolCall(params: {
    sessionId: string;
    messageId: string | null;
    workspaceId: string;
    moduleId: number | null;
    toolName: string;
    status: string;
    argumentsPayload: Record<string, unknown> | null;
    resultPayload?: Record<string, unknown> | null;
    authorizationContext?: Record<string, unknown> | null;
    deniedReason?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<AssistantToolCallEntity> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.assistantToolCall.create({
      data: {
        session_id: params.sessionId,
        message_id: params.messageId,
        workspace_id: params.workspaceId,
        module_id: params.moduleId,
        tool_name: params.toolName,
        status: params.status as never,
        arguments_payload: this.toInputJson(params.argumentsPayload),
        result_payload: this.toInputJson(params.resultPayload),
        authorization_context: this.toInputJson(params.authorizationContext),
        denied_reason: params.deniedReason,
        started_at: params.startedAt ?? null,
        completed_at: params.completedAt ?? null,
      },
    });

    return this.toToolCallEntity(row);
  }

  public async updateToolCall(params: {
    toolCallId: string;
    workspaceId: string;
    status: string;
    resultPayload?: Record<string, unknown> | null;
    authorizationContext?: Record<string, unknown> | null;
    deniedReason?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    await prisma.assistantToolCall.updateMany({
      where: {
        id: params.toolCallId,
        workspace_id: params.workspaceId,
      },
      data: {
        status: params.status as never,
        result_payload: this.toInputJson(params.resultPayload),
        authorization_context: this.toInputJson(params.authorizationContext),
        denied_reason: params.deniedReason ?? null,
        started_at: params.startedAt ?? undefined,
        completed_at: params.completedAt ?? undefined,
      },
    });
  }

  public async upsertMemorySnapshot(params: {
    sessionId: string;
    workspaceId: string;
    summaryText: string;
    extractedFacts: Record<string, unknown> | null;
    messageCount: number;
    tokenEstimate: number | null;
  }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const existing = await prisma.assistantMemorySnapshot.findFirst({
      where: {
        session_id: params.sessionId,
        workspace_id: params.workspaceId,
      },
      orderBy: {
        generated_at: "desc",
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await prisma.assistantMemorySnapshot.update({
        where: { id: existing.id },
        data: {
          summary_text: params.summaryText,
          extracted_facts: this.toInputJson(params.extractedFacts),
          message_count: params.messageCount,
          token_estimate: params.tokenEstimate,
          generated_at: new Date(),
        },
      });
      return;
    }

    await prisma.assistantMemorySnapshot.create({
      data: {
        session_id: params.sessionId,
        workspace_id: params.workspaceId,
        summary_text: params.summaryText,
        extracted_facts: this.toInputJson(params.extractedFacts),
        message_count: params.messageCount,
        token_estimate: params.tokenEstimate,
      },
    });
  }

  private toSessionEntity(row: Record<string, unknown>): AssistantSessionEntity {
    return new AssistantSessionEntity({
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      openedByUserId: typeof row.opened_by_user_id === "string" ? row.opened_by_user_id : null,
      moduleId: typeof row.module_id === "number" ? row.module_id : null,
      title: typeof row.title === "string" ? row.title : null,
      status: String(row.status),
      contextEntityType: typeof row.context_entity_type === "string" ? row.context_entity_type : null,
      contextEntityId: typeof row.context_entity_id === "string" ? row.context_entity_id : null,
      projectId: typeof row.project_id === "string" ? row.project_id : null,
      projectVersionId: typeof row.project_version_id === "number" ? row.project_version_id : null,
      clientId: typeof row.client_id === "string" ? row.client_id : null,
      shipmentId: typeof row.shipment_id === "string" ? row.shipment_id : null,
      documentId: typeof row.document_id === "string" ? row.document_id : null,
      ddtDocumentId: typeof row.ddt_document_id === "string" ? row.ddt_document_id : null,
      configuration: row.configuration && typeof row.configuration === "object" ? row.configuration as Record<string, unknown> : null,
      openedAt: row.opened_at instanceof Date ? row.opened_at : new Date(String(row.opened_at)),
      lastActivityAt: row.last_activity_at instanceof Date ? row.last_activity_at : new Date(String(row.last_activity_at)),
      closedAt: row.closed_at instanceof Date ? row.closed_at : row.closed_at ? new Date(String(row.closed_at)) : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    });
  }

  private toMessageEntity(row: Record<string, unknown>): AssistantMessageEntity {
    return new AssistantMessageEntity({
      id: String(row.id),
      sessionId: String(row.session_id),
      workspaceId: String(row.workspace_id),
      authorUserId: typeof row.author_user_id === "string" ? row.author_user_id : null,
      role: String(row.role),
      sequenceNo: Number(row.sequence_no),
      contentText: typeof row.content_text === "string" ? row.content_text : null,
      contentPayload: row.content_payload && typeof row.content_payload === "object" ? row.content_payload as Record<string, unknown> : null,
      modelName: typeof row.model_name === "string" ? row.model_name : null,
      promptTokens: typeof row.prompt_tokens === "number" ? row.prompt_tokens : null,
      completionTokens: typeof row.completion_tokens === "number" ? row.completion_tokens : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    });
  }

  private toToolCallEntity(row: Record<string, unknown>): AssistantToolCallEntity {
    return new AssistantToolCallEntity({
      id: String(row.id),
      sessionId: String(row.session_id),
      messageId: typeof row.message_id === "string" ? row.message_id : null,
      workspaceId: String(row.workspace_id),
      moduleId: typeof row.module_id === "number" ? row.module_id : null,
      toolName: String(row.tool_name),
      status: String(row.status),
      argumentsPayload: row.arguments_payload && typeof row.arguments_payload === "object" ? row.arguments_payload as Record<string, unknown> : null,
      resultPayload: row.result_payload && typeof row.result_payload === "object" ? row.result_payload as Record<string, unknown> : null,
      authorizationContext: row.authorization_context && typeof row.authorization_context === "object" ? row.authorization_context as Record<string, unknown> : null,
      deniedReason: typeof row.denied_reason === "string" ? row.denied_reason : null,
      startedAt: row.started_at instanceof Date ? row.started_at : row.started_at ? new Date(String(row.started_at)) : null,
      completedAt: row.completed_at instanceof Date ? row.completed_at : row.completed_at ? new Date(String(row.completed_at)) : null,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    });
  }

  private toInputJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }
}
