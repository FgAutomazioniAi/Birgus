import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { AssistantConversationService } from "../../modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionService } from "../../modules/conversational-assistant/services/AssistantSessionService.js";
import { ModuleGuard } from "../middleware/ModuleGuard.js";
import { PermissionGuard } from "../middleware/PermissionGuard.js";
import { AuthenticatedRequest } from "../types/AuthenticatedRequest.js";

const createSessionSchema = z.object({
  moduleKey: z.string().min(1).optional().nullable(),
  title: z.string().min(1).max(200).optional().nullable(),
  contextEntityType: z.string().min(1).max(100).optional().nullable(),
  contextEntityId: z.string().min(1).max(200).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  projectVersionId: z.number().int().positive().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  shipmentId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  ddtDocumentId: z.string().uuid().optional().nullable(),
});

const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

const postMessageSchema = z.object({
  content: z.string().min(1),
});

export class AssistantController {
  private readonly sessionService: AssistantSessionService;
  private readonly conversationService: AssistantConversationService;
  private readonly moduleGuard: ModuleGuard;
  private readonly permissionGuard: PermissionGuard;

  public constructor(
    sessionService: AssistantSessionService,
    conversationService: AssistantConversationService,
    moduleGuard: ModuleGuard,
    permissionGuard: PermissionGuard,
  ) {
    this.sessionService = sessionService;
    this.conversationService = conversationService;
    this.moduleGuard = moduleGuard;
    this.permissionGuard = permissionGuard;
  }

  public listSessions = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.requireReadAccess(request);

      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const sessions = await this.sessionService.listSessionsForUser(workspaceId, userId);

      reply.code(200).send({
        workspaceId,
        sessions: sessions.map((session) => ({
          id: session.id,
          moduleId: session.moduleId,
          title: session.title,
          status: session.status,
          contextEntityType: session.contextEntityType,
          contextEntityId: session.contextEntityId,
          projectId: session.projectId,
          projectVersionId: session.projectVersionId,
          clientId: session.clientId,
          shipmentId: session.shipmentId,
          documentId: session.documentId,
          ddtDocumentId: session.ddtDocumentId,
          openedAt: session.openedAt,
          lastActivityAt: session.lastActivityAt,
          closedAt: session.closedAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public createSession = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.requireWriteAccess(request);

      const body = createSessionSchema.parse(request.body ?? {});
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const session = await this.sessionService.createSession({
        workspaceId,
        openedByUserId: userId,
        moduleKey: body.moduleKey ?? null,
        title: body.title ?? null,
        contextEntityType: body.contextEntityType ?? null,
        contextEntityId: body.contextEntityId ?? null,
        projectId: body.projectId ?? null,
        projectVersionId: body.projectVersionId ?? null,
        clientId: body.clientId ?? null,
        shipmentId: body.shipmentId ?? null,
        documentId: body.documentId ?? null,
        ddtDocumentId: body.ddtDocumentId ?? null,
      });

      reply.code(201).send({
        id: session.id,
        status: session.status,
        title: session.title,
        openedAt: session.openedAt,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public getSession = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.requireReadAccess(request);

      const { sessionId } = sessionIdParamsSchema.parse(request.params);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const session = await this.sessionService.getSessionForUser(workspaceId, userId, sessionId);
      const memory = await this.sessionService.findLatestMemorySnapshot(workspaceId, userId, sessionId);

      reply.code(200).send({
        id: session.id,
        moduleId: session.moduleId,
        title: session.title,
        status: session.status,
        contextEntityType: session.contextEntityType,
        contextEntityId: session.contextEntityId,
        projectId: session.projectId,
        projectVersionId: session.projectVersionId,
        clientId: session.clientId,
        shipmentId: session.shipmentId,
        documentId: session.documentId,
        ddtDocumentId: session.ddtDocumentId,
        openedAt: session.openedAt,
        lastActivityAt: session.lastActivityAt,
        closedAt: session.closedAt,
        memory,
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public listMessages = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.requireReadAccess(request);

      const { sessionId } = sessionIdParamsSchema.parse(request.params);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const messages = await this.sessionService.listMessagesForUser(workspaceId, userId, sessionId);

      reply.code(200).send({
        sessionId,
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          authorUserId: message.authorUserId,
          sequenceNo: message.sequenceNo,
          contentText: message.contentText,
          contentPayload: message.contentPayload,
          modelName: message.modelName,
          promptTokens: message.promptTokens,
          completionTokens: message.completionTokens,
          createdAt: message.createdAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public postMessage = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.requireWriteAccess(request);

      const { sessionId } = sessionIdParamsSchema.parse(request.params);
      const body = postMessageSchema.parse(request.body ?? {});
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      const result = await this.conversationService.postUserMessage({
        workspaceId,
        userId,
        sessionId,
        contentText: body.content,
      });

      reply.code(201).send({
        sessionId: result.sessionId,
        userMessage: {
          id: result.userMessage.id,
          role: result.userMessage.role,
          contentText: result.userMessage.contentText,
          createdAt: result.userMessage.createdAt,
        },
        assistantMessage: {
          id: result.assistantMessage.id,
          role: result.assistantMessage.role,
          contentText: result.assistantMessage.contentText,
          contentPayload: result.assistantMessage.contentPayload,
          modelName: result.assistantMessage.modelName,
          promptTokens: result.assistantMessage.promptTokens,
          completionTokens: result.assistantMessage.completionTokens,
          createdAt: result.assistantMessage.createdAt,
        },
        toolCalls: result.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          toolName: toolCall.toolName,
          status: toolCall.status,
          deniedReason: toolCall.deniedReason,
          resultPayload: toolCall.resultPayload,
          completedAt: toolCall.completedAt,
        })),
      });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  public closeSession = async (request: AuthenticatedRequest, reply: FastifyReply): Promise<void> => {
    try {
      await this.requireWriteAccess(request);

      const { sessionId } = sessionIdParamsSchema.parse(request.params);
      const workspaceId = request.requestContext.workspace.workspaceId;
      const userId = request.requestContext.workspace.userId;
      await this.sessionService.closeSessionForUser(workspaceId, userId, sessionId);

      reply.code(200).send({ ok: true, sessionId, status: "CLOSED" });
    } catch (error) {
      this.sendError(reply, error);
    }
  };

  private async requireReadAccess(request: AuthenticatedRequest): Promise<void> {
    await this.moduleGuard.requireModule(request.requestContext, ModuleKey.CONVERSATIONAL_ASSISTANT);
    await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.ASSISTANT_READ);
  }

  private async requireWriteAccess(request: AuthenticatedRequest): Promise<void> {
    await this.moduleGuard.requireModule(request.requestContext, ModuleKey.CONVERSATIONAL_ASSISTANT);
    await this.permissionGuard.requirePermission(request.requestContext, PermissionKey.ASSISTANT_WRITE);
  }

  private sendError(reply: FastifyReply, error: unknown): void {
    if (error instanceof z.ZodError) {
      reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid payload.", issues: error.issues });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ code: error.code, message: error.message });
      return;
    }

    reply.code(500).send({ code: "INTERNAL_ERROR", message: "Unexpected error." });
  }
}
