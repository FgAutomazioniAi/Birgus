import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { AssistantConversationService } from "../../modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionService } from "../../modules/conversational-assistant/services/AssistantSessionService.js";
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

@Controller("/api/assistant")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.CONVERSATIONAL_ASSISTANT)
export class NestAssistantController {
  public constructor(
    @Inject(AssistantSessionService)
    private readonly sessionService: AssistantSessionService,
    @Inject(AssistantConversationService)
    private readonly conversationService: AssistantConversationService,
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
        shipmentId: session.shipmentId,
        documentId: session.documentId,
        ddtDocumentId: session.ddtDocumentId,
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
      shipmentId: body.shipmentId ?? null,
      documentId: body.documentId ?? null,
      ddtDocumentId: body.ddtDocumentId ?? null,
    });

    return {
      id: session.id,
      status: session.status,
      title: session.title,
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
      shipmentId: session.shipmentId,
      documentId: session.documentId,
      ddtDocumentId: session.ddtDocumentId,
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
