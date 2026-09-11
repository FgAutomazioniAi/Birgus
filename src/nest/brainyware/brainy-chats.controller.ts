import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { z } from "zod";

import { PermissionKey } from "../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../core/module-access/ModuleKey.js";
import { RequestContext } from "../../core/tenancy/RequestContext.js";
import { BrainyChatService } from "../../modules/brainyware/services/BrainyChatService.js";
import { AccessPolicyGuard } from "../auth/access-policy.guard.js";
import { RequestContextAuthGuard } from "../auth/request-context-auth.guard.js";
import { CurrentRequestContext } from "../common/decorators/request-context.decorator.js";
import { RequireModule } from "../common/decorators/require-module.decorator.js";
import { RequirePermission } from "../common/decorators/require-permission.decorator.js";

const createSchema = z.object({ title: z.string().trim().max(160).optional(), kind: z.enum(["AGENT", "DATABASE"]).default("AGENT"), agentId: z.string().uuid().optional(), databaseConnectionId: z.string().uuid().optional() });
const renameSchema = z.object({ title: z.string().trim().min(1).max(160) });
const messageSchema = z.object({ message: z.string().trim().min(1).max(100_000) });
const ragSchema = z.object({ enabled: z.boolean() });
const shareSchema = z.object({ userId: z.string().uuid(), accessLevel: z.enum(["READ", "WRITE"]) });

@Controller("/api/brainy")
@UseGuards(RequestContextAuthGuard, AccessPolicyGuard)
@RequireModule(ModuleKey.BRAINY)
export class BrainyChatsController {
  public constructor(@Inject(BrainyChatService) private readonly service: BrainyChatService) {}

  @Get("agents") @RequirePermission(PermissionKey.BRAINY_READ)
  public async agents(@CurrentRequestContext() context: RequestContext) {
    return { agents: await this.service.listAgents(context.workspace.workspaceId, context.workspace.userId) };
  }

  @Get("database-connections") @RequirePermission(PermissionKey.BRAINY_READ)
  public async databaseConnections(@CurrentRequestContext() context: RequestContext) { return { connections: await this.service.listDatabaseConnections(context.workspace.workspaceId, context.workspace.userId) }; }

  @Get("workspace-users") @RequirePermission(PermissionKey.BRAINY_READ)
  public async workspaceUsers(@CurrentRequestContext() context: RequestContext) { return { users: await this.service.listWorkspaceUsers(context.workspace.workspaceId) }; }

  @Get("chats") @RequirePermission(PermissionKey.BRAINY_READ)
  public async chats(@CurrentRequestContext() context: RequestContext) {
    return { chats: await this.service.listChats(context.workspace.workspaceId, context.workspace.userId) };
  }

  @Post("chats") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public create(@Body() body: unknown, @CurrentRequestContext() context: RequestContext) { const data = createSchema.parse(body); return this.service.createChat({ workspaceId: context.workspace.workspaceId, userId: context.workspace.userId, kind: data.kind, workspaceAgentId: data.agentId, workspaceDatabaseConnectionId: data.databaseConnectionId, title: data.title ?? "Nuova chat" }); }

  @Patch("chats/:chatId") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public rename(@Param("chatId") chatId: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext) { return this.service.renameChat({ workspaceId: context.workspace.workspaceId, userId: context.workspace.userId, chatId, title: renameSchema.parse(body).title }); }

  @Patch("chats/:chatId/rag") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public setRag(@Param("chatId") chatId: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext) { return this.service.setRagEnabled({ workspaceId: context.workspace.workspaceId, userId: context.workspace.userId, chatId, enabled: ragSchema.parse(body).enabled }); }

  @Patch("chats/:chatId/database-memory") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public setDatabaseMemory(@Param("chatId") chatId: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext) { return this.service.setDatabaseMemoryEnabled({ workspaceId: context.workspace.workspaceId, userId: context.workspace.userId, chatId, enabled: ragSchema.parse(body).enabled }); }

  @Get("chats/:chatId") @RequirePermission(PermissionKey.BRAINY_READ)
  public get(@Param("chatId") chatId: string, @CurrentRequestContext() context: RequestContext) { return this.service.getChat(context.workspace.workspaceId, context.workspace.userId, chatId); }

  @Get("chats/:chatId/shares") @RequirePermission(PermissionKey.BRAINY_READ)
  public shares(@Param("chatId") chatId: string, @CurrentRequestContext() context: RequestContext) { return { shares: this.service.listShares(context.workspace.workspaceId, context.workspace.userId, chatId) }; }

  @Post("chats/:chatId/shares") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public async share(@Param("chatId") chatId: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext) { const data = shareSchema.parse(body); await this.service.shareChat({ workspaceId: context.workspace.workspaceId, ownerUserId: context.workspace.userId, chatId, userId: data.userId, accessLevel: data.accessLevel }); return { ok: true }; }

  @Delete("chats/:chatId/shares/:userId") @HttpCode(204) @RequirePermission(PermissionKey.BRAINY_WRITE)
  public async unshare(@Param("chatId") chatId: string, @Param("userId") userId: string, @CurrentRequestContext() context: RequestContext): Promise<void> { await this.service.unshareChat({ workspaceId: context.workspace.workspaceId, ownerUserId: context.workspace.userId, chatId, userId }); }

  @Post("chats/:chatId/messages") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public send(@Param("chatId") chatId: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext) { return this.service.sendMessage({ workspaceId: context.workspace.workspaceId, userId: context.workspace.userId, chatId, message: messageSchema.parse(body).message }); }

  @Post("chats/:chatId/messages/stream") @RequirePermission(PermissionKey.BRAINY_WRITE)
  public async sendStream(@Param("chatId") chatId: string, @Body() body: unknown, @CurrentRequestContext() context: RequestContext, @Res() reply: FastifyReply): Promise<void> {
    const message = messageSchema.parse(body).message;
    reply.hijack();
    reply.raw.writeHead(200, { "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Content-Type": "text/event-stream; charset=utf-8", "X-Accel-Buffering": "no" });
    try {
      for await (const event of this.service.sendMessageStream({ workspaceId: context.workspace.workspaceId, userId: context.workspace.userId, chatId, message })) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      }
    } catch (error) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : "Risposta Brainy non riuscita." })}\n\n`);
    } finally {
      reply.raw.end();
    }
  }

  @Delete("chats/:chatId") @HttpCode(204) @RequirePermission(PermissionKey.BRAINY_WRITE)
  public async archive(@Param("chatId") chatId: string, @CurrentRequestContext() context: RequestContext): Promise<void> { await this.service.archiveChat(context.workspace.workspaceId, context.workspace.userId, chatId); }
}
