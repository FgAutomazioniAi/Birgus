import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { AppError } from "../../core/errors/AppError.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { AssistantConversationService } from "../../modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionDocumentService } from "../../modules/conversational-assistant/services/AssistantSessionDocumentService.js";
import { AssistantSessionService } from "../../modules/conversational-assistant/services/AssistantSessionService.js";
import { MultipartFormReader } from "../../shared/http/MultipartFormReader.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const createSessionSchema = z.object({
  moduleKey: z.string().min(1).optional().nullable(),
  title: z.string().min(1).max(200).optional().nullable(),
  contextEntityType: z.string().min(1).max(100).optional().nullable(),
  contextEntityId: z.string().min(1).max(200).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  projectVersionId: z.number().int().positive().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  ddtDocumentId: z.string().uuid().optional().nullable(),
  knowledgeMode: z.enum(["on_demand", "saved", "hybrid"]).optional().nullable(),
});

const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

const postMessageSchema = z.object({
  content: z.string().min(1),
});

const updateSessionPreferencesSchema = z.object({
  knowledgeMode: z.enum(["on_demand", "saved", "hybrid"]),
});

@Controller("/api/assistant")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.CONVERSATIONAL_ASSISTANT)
export class NestAssistantController {
  public constructor(
    @Inject(AssistantSessionService)
    private readonly sessionService: AssistantSessionService,
    @Inject(AssistantConversationService)
    private readonly conversationService: AssistantConversationService,
    @Inject(AssistantSessionDocumentService)
    private readonly sessionDocumentService: AssistantSessionDocumentService,
  ) {}

  @Get("sessions")
  @RequirePermission(PermissionKey.ASSISTANT_READ)
  public async listSessions(
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const sessions = await this.sessionService.listSessionsForUser(workspaceId, userId);

    return {
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
        documentId: session.documentId,
        ddtDocumentId: session.ddtDocumentId,
        knowledgeMode: session.configuration?.knowledgeMode ?? "on_demand",
        openedAt: session.openedAt,
        lastActivityAt: session.lastActivityAt,
        closedAt: session.closedAt,
      })),
    };
  }

  @Post("sessions")
  @HttpCode(201)
  @RequirePermission(PermissionKey.ASSISTANT_WRITE)
  public async createSession(
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const body = createSessionSchema.parse(bodyRaw ?? {});
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
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
      documentId: body.documentId ?? null,
      ddtDocumentId: body.ddtDocumentId ?? null,
      knowledgeMode: body.knowledgeMode ?? null,
    });

    return {
      id: session.id,
      status: session.status,
      title: session.title,
      knowledgeMode: session.configuration?.knowledgeMode ?? "on_demand",
      openedAt: session.openedAt,
    };
  }

  @Get("sessions/:sessionId")
  @RequirePermission(PermissionKey.ASSISTANT_READ)
  public async getSession(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const session = await this.sessionService.getSessionForUser(workspaceId, userId, sessionId);
    const memory = await this.sessionService.findLatestMemorySnapshot(workspaceId, userId, sessionId);

    return {
      id: session.id,
      moduleId: session.moduleId,
      title: session.title,
      status: session.status,
      contextEntityType: session.contextEntityType,
      contextEntityId: session.contextEntityId,
      projectId: session.projectId,
      projectVersionId: session.projectVersionId,
      clientId: session.clientId,
      documentId: session.documentId,
      ddtDocumentId: session.ddtDocumentId,
        knowledgeMode: session.configuration?.knowledgeMode ?? "on_demand",
      openedAt: session.openedAt,
      lastActivityAt: session.lastActivityAt,
      closedAt: session.closedAt,
      memory,
    };
  }

  @Get("sessions/:sessionId/messages")
  @RequirePermission(PermissionKey.ASSISTANT_READ)
  public async listMessages(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const messages = await this.sessionService.listMessagesForUser(workspaceId, userId, sessionId);

    return {
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
    };
  }

  @Post("sessions/:sessionId/preferences")
  @HttpCode(200)
  @RequirePermission(PermissionKey.ASSISTANT_WRITE)
  public async updateSessionPreferences(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const body = updateSessionPreferencesSchema.parse(bodyRaw ?? {});
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const session = await this.sessionService.updateKnowledgeModeForUser(
      workspaceId,
      userId,
      sessionId,
      body.knowledgeMode,
    );

    return {
      sessionId,
      knowledgeMode: session.configuration?.knowledgeMode ?? "on_demand",
    };
  }

  @Get("sessions/:sessionId/documents")
  @RequirePermission(PermissionKey.ASSISTANT_READ, PermissionKey.KNOWLEDGE_READ)
  public async listSessionDocuments(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    await this.sessionService.getSessionForUser(workspaceId, userId, sessionId);
    const documents = await this.sessionDocumentService.listSessionDocuments({ workspaceId, sessionId });

    return {
      sessionId,
      documents: documents.map((document) => ({
        id: document.id,
        documentId: document.documentId,
        fileName: document.fileName,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes,
        knowledgeDocumentId: document.knowledgeDocumentId,
        extractionStatus: document.extractionStatus,
        createdAt: document.createdAt,
      })),
    };
  }

  @Post("sessions/:sessionId/documents")
  @HttpCode(201)
  @RequirePermission(PermissionKey.ASSISTANT_WRITE, PermissionKey.KNOWLEDGE_READ)
  public async uploadSessionDocument(
    @Param() paramsRaw: unknown,
    @Req() request: FastifyRequest,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    await this.sessionService.getSessionForUser(workspaceId, userId, sessionId);

    const multipart = await MultipartFormReader.read(request);
    const uploaded = multipart.files.find((item) => item.fieldName === "file") ?? multipart.files[0];
    if (!uploaded) {
      throw new AppError("File mancante.", "ASSISTANT_DOCUMENT_REQUIRED", 400);
    }

    const document = await this.sessionDocumentService.uploadSessionDocument({
      workspaceId,
      sessionId,
      userId,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      bytes: uploaded.bytes,
    });

    return {
      document: {
        id: document.id,
        documentId: document.documentId,
        fileName: document.fileName,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes,
        knowledgeDocumentId: document.knowledgeDocumentId,
        extractionStatus: document.extractionStatus,
        createdAt: document.createdAt,
      },
    };
  }

  @Post("sessions/:sessionId/messages")
  @HttpCode(201)
  @RequirePermission(PermissionKey.ASSISTANT_WRITE)
  public async postMessage(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const body = postMessageSchema.parse(bodyRaw ?? {});
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    const result = await this.conversationService.postUserMessage({
      workspaceId,
      userId,
      sessionId,
      contentText: body.content,
    });

    return {
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
    };
  }

  @Post("sessions/:sessionId/messages/stream")
  @RequirePermission(PermissionKey.ASSISTANT_WRITE)
  public async postMessageStream(
    @Param() paramsRaw: unknown,
    @Body() bodyRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const body = postMessageSchema.parse(bodyRaw ?? {});
    reply.hijack();
    reply.raw.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    try {
      for await (const event of this.conversationService.postUserMessageStream({
        workspaceId: requestContext.workspace.workspaceId,
        userId: requestContext.workspace.userId,
        sessionId,
        contentText: body.content,
      })) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Risposta assistente non riuscita.";
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      reply.raw.end();
    }
  }

  @Post("sessions/:sessionId/close")
  @HttpCode(200)
  @RequirePermission(PermissionKey.ASSISTANT_WRITE)
  public async closeSession(
    @Param() paramsRaw: unknown,
    @CurrentRequestContext() requestContext: RequestContext,
  ): Promise<Record<string, unknown>> {
    const { sessionId } = sessionIdParamsSchema.parse(paramsRaw);
    const workspaceId = requestContext.workspace.workspaceId;
    const userId = requestContext.workspace.userId;
    await this.sessionService.closeSessionForUser(workspaceId, userId, sessionId);

    return { ok: true, sessionId, status: "CLOSED" };
  }
}
