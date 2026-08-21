import { AssistantMessageEntity } from "../domain/AssistantMessageEntity.js";
import { AssistantSessionEntity } from "../domain/AssistantSessionEntity.js";
import { AssistantToolCallEntity } from "../domain/AssistantToolCallEntity.js";

export interface AssistantSessionRepository {
  listSessions(workspaceId: string, userId: string): Promise<AssistantSessionEntity[]>;
  createSession(params: {
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
  }): Promise<AssistantSessionEntity>;
  findSessionById(workspaceId: string, sessionId: string): Promise<AssistantSessionEntity | null>;
  updateSessionConfiguration(params: {
    workspaceId: string;
    sessionId: string;
    configuration: Record<string, unknown>;
  }): Promise<AssistantSessionEntity>;
  closeSession(workspaceId: string, sessionId: string): Promise<void>;
  appendMessage(params: {
    sessionId: string;
    workspaceId: string;
    authorUserId: string | null;
    role: string;
    contentText: string | null;
    contentPayload: Record<string, unknown> | null;
    modelName?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
  }): Promise<AssistantMessageEntity>;
  listMessages(workspaceId: string, sessionId: string): Promise<AssistantMessageEntity[]>;
  createToolCall(params: {
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
  }): Promise<AssistantToolCallEntity>;
  updateToolCall(params: {
    toolCallId: string;
    workspaceId: string;
    status: string;
    resultPayload?: Record<string, unknown> | null;
    authorizationContext?: Record<string, unknown> | null;
    deniedReason?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<void>;
  upsertMemorySnapshot(params: {
    sessionId: string;
    workspaceId: string;
    summaryText: string;
    extractedFacts: Record<string, unknown> | null;
    messageCount: number;
    tokenEstimate: number | null;
  }): Promise<void>;
}
