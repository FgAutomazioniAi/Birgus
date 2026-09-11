import { Inject, Injectable } from "@nestjs/common";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaService } from "../../../nest/prisma/prisma.service.js";
import { BrainywareClient, BrainywareHttpError } from "./BrainywareClient.js";
import { BrainyWorkspaceAgentService } from "./BrainyWorkspaceAgentService.js";
import { BrainyWorkspaceDatabaseConnectionService } from "./BrainyWorkspaceDatabaseConnectionService.js";

type ChatKind = "AGENT" | "DATABASE";
type AccessLevel = "READ" | "WRITE";

export interface BrainyChatView {
  id: string; title: string; kind: ChatKind;
  agentId: string | null; agentLabel: string | null;
  databaseConnectionId: string | null; databaseLabel: string | null;
  updatedAt: string; ragEnabled: boolean; databaseMemoryEnabled: boolean;
  isOwner: boolean; canWrite: boolean; createdByUserId: string | null;
}

@Injectable()
export class BrainyChatService {
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(BrainywareClient) private readonly client: BrainywareClient, @Inject(BrainyWorkspaceAgentService) private readonly workspaceAgentService: BrainyWorkspaceAgentService, @Inject(BrainyWorkspaceDatabaseConnectionService) private readonly workspaceDatabaseConnectionService: BrainyWorkspaceDatabaseConnectionService) {}

  public async listAgents(workspaceId: string, userId: string) {
    return this.workspaceAgentService.listForUser(workspaceId, userId);
  }

  public async listDatabaseConnections(workspaceId: string, userId: string) {
    return (await this.workspaceDatabaseConnectionService.listForUser(workspaceId, userId)).map((row) => ({ id: row.id, label: row.label }));
  }

  public async listWorkspaceUsers(workspaceId: string) {
    const rows = await this.prisma.workspaceMembership.findMany({ where: { workspace_id: workspaceId, status: "ACTIVE", user: { is_active: true, deleted_at: null } }, select: { user: { select: { id: true, first_name: true, last_name: true, email: true } } }, orderBy: { user: { first_name: "asc" } } });
    return rows.map(({ user }) => ({ id: user.id, label: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email, email: user.email }));
  }

  public async listChats(workspaceId: string, userId: string): Promise<BrainyChatView[]> {
    const rows = await this.prisma.brainyChat.findMany({ where: { workspace_id: workspaceId, deleted_at: null, OR: [{ created_by_user_id: userId }, { shares: { some: { user_id: userId } } }] }, include: { workspace_database_connection: true, shares: { where: { user_id: userId }, select: { access_level: true } } }, orderBy: { updated_at: "desc" } });
    const agents = await this.prisma.brainyWorkspaceAgent.findMany({ where: { workspace_id: workspaceId, deleted_at: null }, select: { id: true, label: true } });
    const activeAgentIds = new Set((await this.workspaceAgentService.listForUser(workspaceId, userId)).map((agent) => agent.id));
    const activeDatabaseIds = new Set((await this.workspaceDatabaseConnectionService.listForUser(workspaceId, userId)).map((connection) => connection.id));
    return rows
      .filter((row) => (row.kind !== "AGENT" || (row.workspace_agent_id !== null && activeAgentIds.has(row.workspace_agent_id))) && (row.kind !== "DATABASE" || (row.workspace_database_connection_id !== null && activeDatabaseIds.has(row.workspace_database_connection_id))))
      .map((row) => this.toView(row, userId, new Map(agents.map((agent) => [agent.id, agent.label]))));
  }

  public async createChat(params: { workspaceId: string; userId: string; kind: ChatKind; workspaceAgentId?: string; workspaceDatabaseConnectionId?: string; title: string }): Promise<BrainyChatView> {
    const title = params.title.trim() || "Nuova chat";
    if (title.length > 160) throw new AppError("Il nome della chat supera 160 caratteri.", "BRAINY_CHAT_TITLE_INVALID", 400);
    if (params.kind === "DATABASE") {
      const database = await this.workspaceDatabaseConnectionService.requireForUser(params.workspaceId, params.userId, params.workspaceDatabaseConnectionId ?? "");
      const row = await this.prisma.brainyChat.create({ data: { workspace_id: params.workspaceId, kind: "DATABASE", workspace_database_connection_id: database.id, title, created_by_user_id: params.userId }, include: { workspace_database_connection: true, shares: true } });
      return this.toView(row, params.userId);
    }
    const availableAgents = await this.workspaceAgentService.listForUser(params.workspaceId, params.userId);
    const selectedAgentId = params.workspaceAgentId ?? availableAgents.find((agent) => agent.isDefault)?.id ?? availableAgents[0]?.id;
    if (params.workspaceAgentId && !availableAgents.some((agent) => agent.id === params.workspaceAgentId)) throw new AppError("Non hai accesso all'agente Brainy selezionato.", "BRAINY_AGENT_ACCESS_DENIED", 403);
    const agent = selectedAgentId ? await this.prisma.brainyWorkspaceAgent.findFirst({ where: { id: selectedAgentId, workspace_id: params.workspaceId, deleted_at: null, is_enabled: true } }) : null;
    if (!agent) throw new AppError("Configurare e attivare almeno un agente Brainy.", "BRAINY_AGENT_REQUIRED", 409);
    const row = await this.prisma.brainyChat.create({ data: { workspace_id: params.workspaceId, kind: "AGENT", workspace_agent_id: agent.id, brainyware_agent_id: agent.brainyware_agent_id, title, created_by_user_id: params.userId }, include: { workspace_database_connection: true, shares: true } });
    return this.toView(row, params.userId, new Map([[agent.id, agent.label]]));
  }

  public async getChat(workspaceId: string, userId: string, chatId: string) {
    const { chat } = await this.requireAccess(workspaceId, userId, chatId, "READ", true);
    return { chat: this.toView(chat, userId), messages: chat.messages.map((message) => this.messageView(message)) };
  }

  public async renameChat(params: { workspaceId: string; userId: string; chatId: string; title: string }): Promise<BrainyChatView> {
    const title = params.title.trim();
    if (!title || title.length > 160) throw new AppError("Il nome della chat deve contenere da 1 a 160 caratteri.", "BRAINY_CHAT_TITLE_INVALID", 400);
    const { chat } = await this.requireAccess(params.workspaceId, params.userId, params.chatId, "WRITE");
    await this.ensureAgentAvailableToUser(chat, params.workspaceId, params.userId);
    return this.toView(await this.prisma.brainyChat.update({ where: { id: chat.id }, data: { title }, include: { workspace_database_connection: true, shares: { where: { user_id: params.userId }, select: { access_level: true } } } }), params.userId);
  }

  public async setRagEnabled(params: { workspaceId: string; userId: string; chatId: string; enabled: boolean }): Promise<BrainyChatView> {
    const { chat } = await this.requireAccess(params.workspaceId, params.userId, params.chatId, "WRITE");
    if (chat.kind !== "AGENT") throw new AppError("Knowledge non e' disponibile nelle chat database.", "BRAINY_CHAT_KIND_INVALID", 409);
    return this.toView(await this.prisma.brainyChat.update({ where: { id: chat.id }, data: { rag_enabled: params.enabled }, include: { workspace_database_connection: true, shares: { where: { user_id: params.userId }, select: { access_level: true } } } }), params.userId);
  }

  public async setDatabaseMemoryEnabled(params: { workspaceId: string; userId: string; chatId: string; enabled: boolean }): Promise<BrainyChatView> {
    const { chat } = await this.requireAccess(params.workspaceId, params.userId, params.chatId, "WRITE");
    if (chat.kind !== "DATABASE") throw new AppError("La memoria database e' disponibile solo nelle chat database.", "BRAINY_CHAT_KIND_INVALID", 409);
    return this.toView(await this.prisma.brainyChat.update({ where: { id: chat.id }, data: { database_memory_enabled: params.enabled }, include: { workspace_database_connection: true, shares: { where: { user_id: params.userId }, select: { access_level: true } } } }), params.userId);
  }

  public async listShares(workspaceId: string, userId: string, chatId: string) {
    await this.requireOwner(workspaceId, userId, chatId);
    const rows = await this.prisma.brainyChatShare.findMany({ where: { chat_id: chatId }, include: { user: { select: { first_name: true, last_name: true, email: true } } }, orderBy: { created_at: "asc" } });
    return rows.map((row) => ({ userId: row.user_id, accessLevel: row.access_level, label: [row.user.first_name, row.user.last_name].filter(Boolean).join(" ") || row.user.email, email: row.user.email }));
  }

  public async shareChat(params: { workspaceId: string; ownerUserId: string; chatId: string; userId: string; accessLevel: AccessLevel }) {
    await this.requireOwner(params.workspaceId, params.ownerUserId, params.chatId);
    if (params.ownerUserId === params.userId) throw new AppError("Il proprietario dispone gia' della chat.", "BRAINY_CHAT_SHARE_OWNER", 400);
    const member = await this.prisma.workspaceMembership.findFirst({ where: { workspace_id: params.workspaceId, user_id: params.userId, status: "ACTIVE", user: { is_active: true, deleted_at: null } } });
    if (!member) throw new AppError("L'utente selezionato non appartiene al workspace.", "BRAINY_CHAT_SHARE_USER_INVALID", 400);
    await this.prisma.brainyChatShare.upsert({ where: { chat_id_user_id: { chat_id: params.chatId, user_id: params.userId } }, create: { chat_id: params.chatId, workspace_id: params.workspaceId, user_id: params.userId, access_level: params.accessLevel, granted_by_user_id: params.ownerUserId }, update: { access_level: params.accessLevel, granted_by_user_id: params.ownerUserId } });
  }

  public async unshareChat(params: { workspaceId: string; ownerUserId: string; chatId: string; userId: string }) { await this.requireOwner(params.workspaceId, params.ownerUserId, params.chatId); await this.prisma.brainyChatShare.deleteMany({ where: { chat_id: params.chatId, workspace_id: params.workspaceId, user_id: params.userId } }); }

  public async *sendMessageStream(params: { workspaceId: string; userId: string; chatId: string; message: string }): AsyncGenerator<{ type: "delta" | "done"; payload: Record<string, unknown> }> {
    const message = params.message.trim();
    if (!message || message.length > 100_000) throw new AppError("Messaggio Brainy non valido.", "BRAINY_MESSAGE_INVALID", 400);
    const { chat } = await this.requireAccess(params.workspaceId, params.userId, params.chatId, "WRITE");
    const history = await this.prisma.brainyChatMessage.findMany({ where: { chat_id: chat.id }, orderBy: { created_at: "desc" }, take: 24, select: { role: true, content_text: true } });
    let reply = "";
    try {
      if (chat.kind === "DATABASE") await this.client.assertReadOnlyDatabaseConnection(chat.workspace_database_connection?.brainyware_connection_id ?? "");
      const stream = chat.kind === "DATABASE"
        ? this.client.runDatabaseStream({ connectionId: chat.workspace_database_connection?.brainyware_connection_id ?? "", message, history: history.reverse().map((item) => ({ role: item.role, content: item.content_text })), includeHistory: chat.database_memory_enabled })
        : this.client.runAgentStream({ agentId: chat.brainyware_agent_id ?? "", sessionId: "", sessionName: chat.title, message: this.composeAgentMessage(history.reverse(), message, chat.rag_enabled ? await this.client.searchKnowledge(message) : "") });
      for await (const chunk of stream) { reply += chunk; yield { type: "delta", payload: { text: chunk } }; }
    } catch (error) { throw this.toExternalServiceError(error); }
    reply = reply.trim(); if (!reply) throw new AppError("Brainyware ha risposto senza contenuto testuale.", "BRAINYWARE_EMPTY_RESPONSE", 502);
    const [userMessage, assistantMessage] = await this.prisma.$transaction([this.prisma.brainyChatMessage.create({ data: { chat_id: chat.id, workspace_id: params.workspaceId, author_user_id: params.userId, role: "user", content_text: message } }), this.prisma.brainyChatMessage.create({ data: { chat_id: chat.id, workspace_id: params.workspaceId, role: "assistant", content_text: reply } }), this.prisma.brainyChat.update({ where: { id: chat.id }, data: {} })]);
    yield { type: "done", payload: { userMessage: this.messageView(userMessage), assistantMessage: this.messageView(assistantMessage) } };
  }

  public async sendMessage(params: { workspaceId: string; userId: string; chatId: string; message: string }) {
    let completed: Record<string, unknown> | null = null;
    for await (const event of this.sendMessageStream(params)) if (event.type === "done") completed = event.payload;
    if (!completed) throw new AppError("Brainyware ha risposto senza contenuto testuale.", "BRAINYWARE_EMPTY_RESPONSE", 502);
    return completed;
  }

  public async archiveChat(workspaceId: string, userId: string, chatId: string): Promise<void> { const chat = await this.requireOwner(workspaceId, userId, chatId); await this.prisma.brainyChat.update({ where: { id: chat.id }, data: { deleted_at: new Date() } }); }

  private async requireAccess(workspaceId: string, userId: string, chatId: string, required: AccessLevel, withMessages = false) {
    const chat = await this.prisma.brainyChat.findFirst({ where: { id: chatId, workspace_id: workspaceId, deleted_at: null }, include: { workspace_database_connection: true, shares: { where: { user_id: userId }, select: { access_level: true } }, ...(withMessages ? { messages: { orderBy: { created_at: "asc" } } } : {}) } });
    if (!chat) throw new AppError("Chat Brainy non trovata.", "BRAINY_CHAT_NOT_FOUND", 404);
    const access: "OWNER" | AccessLevel | null = chat.created_by_user_id === userId ? "OWNER" : chat.shares[0]?.access_level ?? null;
    if (!access || (required === "WRITE" && access === "READ")) throw new AppError("Non hai accesso a questa chat Brainy.", "BRAINY_CHAT_ACCESS_DENIED", 403);
    await this.ensureAgentAvailableToUser(chat, workspaceId, userId);
    await this.ensureDatabaseAvailableToUser(chat, workspaceId, userId);
    return { chat, access };
  }

  private async ensureAgentAvailableToUser(chat: { kind: ChatKind; workspace_agent_id: string | null }, workspaceId: string, userId: string): Promise<void> {
    if (chat.kind !== "AGENT") return;
    const agents = await this.workspaceAgentService.listForUser(workspaceId, userId);
    if (!chat.workspace_agent_id || !agents.some((agent) => agent.id === chat.workspace_agent_id)) throw new AppError("Non hai accesso all'agente Brainy associato a questa chat.", "BRAINY_AGENT_ACCESS_DENIED", 403);
  }

  private async ensureDatabaseAvailableToUser(chat: { kind: ChatKind; workspace_database_connection_id: string | null }, workspaceId: string, userId: string): Promise<void> {
    if (chat.kind !== "DATABASE") return;
    await this.workspaceDatabaseConnectionService.requireForUser(workspaceId, userId, chat.workspace_database_connection_id ?? "");
  }

  private async requireOwner(workspaceId: string, userId: string, chatId: string) { const chat = await this.prisma.brainyChat.findFirst({ where: { id: chatId, workspace_id: workspaceId, deleted_at: null, created_by_user_id: userId } }); if (!chat) throw new AppError("Solo il proprietario puo' gestire le condivisioni o archiviare la chat.", "BRAINY_CHAT_OWNER_REQUIRED", 403); return chat; }
  private toView(chat: any, userId: string, agentLabels = new Map<string, string>()): BrainyChatView { const isOwner = chat.created_by_user_id === userId; const access = isOwner ? "OWNER" : chat.shares?.[0]?.access_level; return { id: chat.id, title: chat.title, kind: chat.kind, agentId: chat.workspace_agent_id, agentLabel: chat.kind === "AGENT" ? agentLabels.get(chat.workspace_agent_id ?? "") ?? "Agente archiviato" : null, databaseConnectionId: chat.workspace_database_connection_id, databaseLabel: chat.workspace_database_connection?.label ?? null, updatedAt: chat.updated_at.toISOString(), ragEnabled: chat.rag_enabled, databaseMemoryEnabled: chat.database_memory_enabled, isOwner, canWrite: access === "OWNER" || access === "WRITE", createdByUserId: chat.created_by_user_id }; }
  private messageView(message: { id: string; role: string; content_text: string; created_at: Date }) { return { id: message.id, role: message.role, content: message.content_text, createdAt: message.created_at.toISOString() }; }
  private toExternalServiceError(error: unknown): AppError { if (error instanceof AppError) return error; if (error instanceof BrainywareHttpError && error.statusCode === 403) return new AppError("Il service account Brainyware non ha accesso alla risorsa configurata.", "BRAINYWARE_ACCESS_DENIED", 409); if (error instanceof BrainywareHttpError && error.statusCode === 404) return new AppError("La risorsa Brainyware configurata non esiste oppure non e' accessibile.", "BRAINYWARE_NOT_FOUND", 409); if (error instanceof BrainywareHttpError && error.statusCode === 401) return new AppError("Le credenziali del service account Brainyware non sono valide.", "BRAINYWARE_AUTHENTICATION_FAILED", 502); if (error instanceof BrainywareHttpError) return new AppError(`Brainyware ha rifiutato la richiesta (HTTP ${error.statusCode}).`, "BRAINYWARE_REQUEST_FAILED", 502); if (error instanceof Error && /READ_ONLY|accessibile/.test(error.message)) return new AppError(error.message, "BRAINY_DATABASE_READ_ONLY_REQUIRED", 409); return new AppError("Brainyware non e' disponibile per questa operazione.", "BRAINYWARE_UNAVAILABLE", 502); }
  private composeAgentMessage(history: Array<{ role: string; content_text: string }>, message: string, ragContext = "") { const knowledge = ragContext ? `\n\nContesto knowledge RAG Brainyware:\n${ragContext}\n\nRispondi usando il contesto solo quando pertinente.` : ""; const available = 90_000 - message.length - knowledge.length; const recent: string[] = []; let length = 0; for (const item of [...history].reverse()) { const entry = `${item.role === "assistant" ? "Assistente" : "Utente"}: ${item.content_text}`; if (length + entry.length > available) break; recent.unshift(entry); length += entry.length; } return recent.length ? `Cronologia della conversazione Birgus:\n${recent.join("\n")}\n\nNuovo messaggio dell'utente:\n${message}${knowledge}` : `${message}${knowledge}`; }
}
