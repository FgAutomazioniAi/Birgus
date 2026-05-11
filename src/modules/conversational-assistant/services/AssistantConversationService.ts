import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AssistantMessageEntity } from "../domain/AssistantMessageEntity.js";
import { AssistantSessionRepository } from "../repositories/AssistantSessionRepository.js";
import { AssistantToolDefinition, AssistantToolExecutionContext } from "../tools/AssistantToolDefinition.js";
import { PrismaAssistantSessionRepository } from "../infra/PrismaAssistantSessionRepository.js";
import { AssistantSessionService } from "./AssistantSessionService.js";
import { AssistantToolAccessService } from "./AssistantToolAccessService.js";
import { AssistantToolRegistry } from "./AssistantToolRegistry.js";
import { DocumentChatContext, DocumentIntelligenceService } from "../../document-intelligence/services/DocumentIntelligenceService.js";
import { LmStudioChatClient } from "./LmStudioChatClient.js";

interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
}

export class AssistantConversationService {
  private readonly repository: AssistantSessionRepository;
  private readonly sessionService: AssistantSessionService;
  private readonly toolRegistry: AssistantToolRegistry;
  private readonly toolAccessService: AssistantToolAccessService;
  private readonly documentIntelligenceService: DocumentIntelligenceService;
  private readonly chatClient: LmStudioChatClient;

  public constructor(params: {
    sessionService: AssistantSessionService;
    toolRegistry: AssistantToolRegistry;
    toolAccessService: AssistantToolAccessService;
    documentIntelligenceService: DocumentIntelligenceService;
    chatClient?: LmStudioChatClient;
    repository?: AssistantSessionRepository;
  }) {
    this.sessionService = params.sessionService;
    this.toolRegistry = params.toolRegistry;
    this.toolAccessService = params.toolAccessService;
    this.documentIntelligenceService = params.documentIntelligenceService;
    this.chatClient = params.chatClient ?? new LmStudioChatClient();
    this.repository = params.repository ?? new PrismaAssistantSessionRepository();
  }

  public async postUserMessage(params: {
    workspaceId: string;
    userId: string;
    sessionId: string;
    contentText: string;
  }): Promise<{
    sessionId: string;
    userMessage: AssistantMessageEntity;
    assistantMessage: AssistantMessageEntity;
    toolCalls: Array<{
      id: string;
      toolName: string;
      status: string;
      deniedReason: string | null;
      resultPayload: Record<string, unknown> | null;
      completedAt: Date | null;
    }>;
  }> {
    const contentText = params.contentText.trim();
    if (!contentText) {
      throw new AppError("Il messaggio non puo essere vuoto.", "ASSISTANT_MESSAGE_EMPTY", 400);
    }

    const session = await this.sessionService.getSessionForUser(params.workspaceId, params.userId, params.sessionId);
    if (session.status !== "OPEN") {
      throw new AppError("La sessione assistente e chiusa.", "ASSISTANT_SESSION_CLOSED", 409);
    }

    const userMessage = await this.repository.appendMessage({
      sessionId: session.id,
      workspaceId: params.workspaceId,
      authorUserId: params.userId,
      role: "USER",
      contentText,
      contentPayload: null,
    });

    const documentContext = await this.resolveLinkedDocumentContext(params.workspaceId, session);
    const history = await this.repository.listMessages(params.workspaceId, session.id);
    const memorySnapshot = await this.sessionService.findLatestMemorySnapshot(params.workspaceId, params.userId, session.id);
    const initialMessages = this.buildModelMessages({
      session,
      history,
      memorySummary: memorySnapshot?.summaryText ?? null,
      documentContext,
    });

    const toolDefinitions = this.toolRegistry.listDefinitions();
    const firstPass = await this.chatClient.chatWithTools({
      messages: initialMessages,
      tools: toolDefinitions.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parametersJsonSchema,
        },
      })),
    });

    const toolCalls = await this.executeToolCalls({
      workspaceId: params.workspaceId,
      userId: params.userId,
      sessionId: session.id,
      sourceMessageId: userMessage.id,
      toolCalls: firstPass.toolCalls,
      toolDefinitions,
    });

    let finalContent = firstPass.content?.trim() || null;
    let finalPromptTokens = firstPass.promptTokens;
    let finalCompletionTokens = firstPass.completionTokens;
    let finalRaw = firstPass.raw;

    if (toolCalls.modelMessages.length > 0) {
      const secondPass = await this.chatClient.chat({
        messages: [
          ...initialMessages,
          {
            role: "assistant",
            content: firstPass.content,
            tool_calls: firstPass.toolCalls.map((toolCall) => ({
              id: toolCall.id,
              type: toolCall.type,
              function: toolCall.function,
            })),
          },
          ...toolCalls.modelMessages,
        ],
      });

      finalContent = secondPass.content?.trim() || finalContent;
      finalPromptTokens = secondPass.promptTokens;
      finalCompletionTokens = secondPass.completionTokens;
      finalRaw = secondPass.raw;
    }

    if (!finalContent) {
      finalContent = "Non ho trovato ancora una risposta affidabile. Prova a specificare meglio progetto, versione o documento da analizzare.";
    }

    const assistantMessage = await this.repository.appendMessage({
      sessionId: session.id,
      workspaceId: params.workspaceId,
      authorUserId: null,
      role: "ASSISTANT",
      contentText: finalContent,
      contentPayload: {
        raw_response: finalRaw,
        tool_calls_count: toolCalls.persisted.length,
      },
      modelName: firstPass.model,
      promptTokens: finalPromptTokens,
      completionTokens: finalCompletionTokens,
    });

    await this.refreshMemorySnapshot(params.workspaceId, session.id, session, history.length + 1);

    return {
      sessionId: session.id,
      userMessage,
      assistantMessage,
      toolCalls: toolCalls.persisted,
    };
  }

  private async executeToolCalls(params: {
    workspaceId: string;
    userId: string;
    sessionId: string;
    sourceMessageId: string;
    toolCalls: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
    toolDefinitions: AssistantToolDefinition[];
  }): Promise<{
    persisted: Array<{
      id: string;
      toolName: string;
      status: string;
      deniedReason: string | null;
      resultPayload: Record<string, unknown> | null;
      completedAt: Date | null;
    }>;
    modelMessages: ModelMessage[];
  }> {
    const persisted: Array<{
      id: string;
      toolName: string;
      status: string;
      deniedReason: string | null;
      resultPayload: Record<string, unknown> | null;
      completedAt: Date | null;
    }> = [];
    const modelMessages: ModelMessage[] = [];
    const context: AssistantToolExecutionContext = {
      workspaceId: params.workspaceId,
      userId: params.userId,
      sessionId: params.sessionId,
    };

    for (const toolCall of params.toolCalls) {
      const tool = params.toolDefinitions.find((candidate) => candidate.name === toolCall.function.name)
        ?? this.toolRegistry.getTool(toolCall.function.name);
      const moduleId = await this.resolvePrimaryModuleId(tool?.moduleKeys?.[0] ?? null);
      const argumentsPayload = this.parseToolArguments(toolCall.function.arguments);
      const logEntry = await this.repository.createToolCall({
        sessionId: params.sessionId,
        messageId: params.sourceMessageId,
        workspaceId: params.workspaceId,
        moduleId,
        toolName: toolCall.function.name,
        status: "REQUESTED",
        argumentsPayload,
      });

      if (!tool) {
        const resultPayload = {
          error: true,
          code: "ASSISTANT_TOOL_UNKNOWN",
          message: `Tool '${toolCall.function.name}' non registrato.`,
        };
        await this.repository.updateToolCall({
          toolCallId: logEntry.id,
          workspaceId: params.workspaceId,
          status: "FAILED",
          resultPayload,
          deniedReason: "Tool non registrato.",
          completedAt: new Date(),
        });
        modelMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultPayload),
        });
        persisted.push({
          id: logEntry.id,
          toolName: logEntry.toolName,
          status: "FAILED",
          deniedReason: "Tool non registrato.",
          resultPayload,
          completedAt: new Date(),
        });
        continue;
      }

      try {
        const authorization = await this.toolAccessService.ensureAllowed(context, tool);
        await this.repository.updateToolCall({
          toolCallId: logEntry.id,
          workspaceId: params.workspaceId,
          status: "RUNNING",
          authorizationContext: authorization,
          startedAt: new Date(),
        });

        const result = await this.toolRegistry.executeTool(tool.name, context, argumentsPayload);
        await this.repository.updateToolCall({
          toolCallId: logEntry.id,
          workspaceId: params.workspaceId,
          status: "SUCCEEDED",
          resultPayload: result,
          authorizationContext: authorization,
          completedAt: new Date(),
        });

        modelMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
        persisted.push({
          id: logEntry.id,
          toolName: logEntry.toolName,
          status: "SUCCEEDED",
          deniedReason: null,
          resultPayload: result,
          completedAt: new Date(),
        });
      } catch (error) {
        const normalized = this.normalizeToolError(error);
        const failedStatus = normalized.statusCode === 403 ? "DENIED" : "FAILED";
        const resultPayload = {
          error: true,
          code: normalized.code,
          message: normalized.message,
        };

        await this.repository.updateToolCall({
          toolCallId: logEntry.id,
          workspaceId: params.workspaceId,
          status: failedStatus,
          resultPayload,
          authorizationContext: tool.moduleKeys.length || tool.permissionKeys.length
            ? {
                moduleKeys: tool.moduleKeys,
                permissionKeys: tool.permissionKeys,
              }
            : null,
          deniedReason: normalized.message,
          completedAt: new Date(),
        });

        modelMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultPayload),
        });
        persisted.push({
          id: logEntry.id,
          toolName: logEntry.toolName,
          status: failedStatus,
          deniedReason: normalized.message,
          resultPayload,
          completedAt: new Date(),
        });
      }
    }

    return { persisted, modelMessages };
  }

  private async refreshMemorySnapshot(
    workspaceId: string,
    sessionId: string,
    session: {
      projectId: string | null;
      projectVersionId: number | null;
      shipmentId: string | null;
      documentId: string | null;
      ddtDocumentId: string | null;
      contextEntityType: string | null;
      contextEntityId: string | null;
    },
    recentMessageCountHint: number,
  ): Promise<void> {
    const messages = await this.repository.listMessages(workspaceId, sessionId);
    const relevant = messages.slice(-8);
    const summary = relevant
      .map((message) => {
        const role = message.role === "USER" ? "Utente" : message.role === "ASSISTANT" ? "Assistente" : message.role;
        const content = (message.contentText ?? "").replace(/\s+/g, " ").trim();
        if (!content) {
          return null;
        }

        return `${role}: ${content}`;
      })
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .slice(0, 4000);

    await this.repository.upsertMemorySnapshot({
      sessionId,
      workspaceId,
      summaryText: summary || "Sessione avviata, nessun riassunto disponibile.",
      extractedFacts: {
        contextEntityType: session.contextEntityType,
        contextEntityId: session.contextEntityId,
        projectId: session.projectId,
        projectVersionId: session.projectVersionId,
        shipmentId: session.shipmentId,
        documentId: session.documentId,
        ddtDocumentId: session.ddtDocumentId,
      },
      messageCount: Math.max(messages.length, recentMessageCountHint),
      tokenEstimate: Math.max(1, Math.ceil(summary.length / 4)),
    });
  }

  private buildModelMessages(params: {
    session: {
      title: string | null;
      contextEntityType: string | null;
      contextEntityId: string | null;
      projectId: string | null;
      projectVersionId: number | null;
      shipmentId: string | null;
      documentId: string | null;
      ddtDocumentId: string | null;
    };
    history: AssistantMessageEntity[];
    memorySummary: string | null;
    documentContext: DocumentChatContext | null;
  }): ModelMessage[] {
    const messages: ModelMessage[] = [
      {
        role: "system",
        content: [
          "Sei l'assistente applicativo interno di Birgus.",
          "Rispondi in italiano, in modo chiaro e concreto.",
          "Ogni conversazione e limitata alla sessione corrente: non usare memoria esterna o richieste precedenti non presenti nella sessione.",
          "Per leggere dati di business usa solo i tool disponibili. Non assumere accesso diretto al database, a Garage o ai file.",
          "Se il backend ti fornisce un contesto documentale gia estratto per questa sessione, puoi usarlo come fonte primaria del documento collegato.",
          "Se devi approfondire il documento collegato alla sessione, preferisci il tool dedicato al documento collegato prima di allargare la ricerca all'intero workspace.",
          "Se l'utente richiede esplicitamente ricerca 'semantica', usa il tool semantico; se richiede ricerca 'mirata', 'keyword' o 'puntuale', usa il tool targeted.",
          "Non inventare dati mancanti. Se il contesto non basta, chiedi conferma o usa il tool piu adatto.",
          "Quando il tool restituisce dati strutturati, sintetizzali senza alterarne il significato.",
        ].join(" "),
      },
    ];

    const sessionContext = this.describeSessionContext(params.session);
    if (sessionContext) {
      messages.push({
        role: "system",
        content: `Contesto sessione: ${sessionContext}`,
      });
    }

    if (params.memorySummary) {
      messages.push({
        role: "system",
        content: `Memoria compatta della sessione: ${params.memorySummary}`,
      });
    }

    if (params.documentContext) {
      const structuredParts = [
        params.documentContext.kind === "ddt_document" && params.documentContext.ddtDocumentId
          ? `Tipo documento collegato: DDT (${params.documentContext.ddtDocumentId})`
          : "Tipo documento collegato: documento generico",
        params.documentContext.title ? `Titolo: ${params.documentContext.title}` : null,
        params.documentContext.sourceLabel ? `Origine archivio: ${params.documentContext.sourceLabel}` : null,
        params.documentContext.summaryText ? `Riassunto estratto: ${params.documentContext.summaryText}` : null,
        params.documentContext.contentPreview ? `Estratto contenuto: ${params.documentContext.contentPreview}` : null,
        params.documentContext.ddtAnalysis
          ? `Analisi DDT strutturata: ${JSON.stringify(params.documentContext.ddtAnalysis)}`
          : null,
        params.documentContext.structuredPayload
          ? `Payload strutturato documento: ${JSON.stringify(params.documentContext.structuredPayload)}`
          : null,
      ].filter((value): value is string => Boolean(value));

      messages.push({
        role: "system",
        content: structuredParts.join("\n"),
      });
    }

    for (const item of params.history.slice(-12)) {
      const role = this.toModelRole(item.role);
      if (!role) {
        continue;
      }

      messages.push({
        role,
        content: item.contentText,
      });
    }

    return messages;
  }

  private describeSessionContext(session: {
    title: string | null;
    contextEntityType: string | null;
    contextEntityId: string | null;
    projectId: string | null;
    projectVersionId: number | null;
    shipmentId: string | null;
    documentId: string | null;
    ddtDocumentId: string | null;
  }): string | null {
    const parts = [
      session.title ? `titolo ${session.title}` : null,
      session.contextEntityType && session.contextEntityId
        ? `entita ${session.contextEntityType}:${session.contextEntityId}`
        : null,
      session.projectId ? `projectId ${session.projectId}` : null,
      session.projectVersionId ? `projectVersionId ${session.projectVersionId}` : null,
      session.shipmentId ? `shipmentId ${session.shipmentId}` : null,
      session.documentId ? `documentId ${session.documentId}` : null,
      session.ddtDocumentId ? `ddtDocumentId ${session.ddtDocumentId}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(", ") : null;
  }

  private async resolveLinkedDocumentContext(
    workspaceId: string,
    session: {
      documentId: string | null;
      ddtDocumentId: string | null;
    },
  ): Promise<DocumentChatContext | null> {
    if (session.ddtDocumentId) {
      return this.documentIntelligenceService.getDdtDocumentChatContext({
        workspaceId,
        ddtDocumentId: session.ddtDocumentId,
      });
    }

    if (session.documentId) {
      return this.documentIntelligenceService.getDocumentChatContext({
        workspaceId,
        documentId: session.documentId,
      });
    }

    return null;
  }

  private toModelRole(role: string): ModelMessage["role"] | null {
    if (role === "USER") {
      return "user";
    }

    if (role === "ASSISTANT") {
      return "assistant";
    }

    if (role === "TOOL") {
      return "tool";
    }

    return null;
  }

  private parseToolArguments(value: string): Record<string, unknown> {
    const normalized = value.trim();
    if (!normalized) {
      return {};
    }

    try {
      const parsed = JSON.parse(normalized);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : { value: parsed };
    } catch {
      return { raw: normalized };
    }
  }

  private normalizeToolError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, "ASSISTANT_TOOL_ERROR", 500);
    }

    return new AppError("Errore imprevisto durante l'esecuzione del tool.", "ASSISTANT_TOOL_ERROR", 500);
  }

  private async resolvePrimaryModuleId(moduleKey: string | null): Promise<number | null> {
    if (!moduleKey) {
      return null;
    }

    const prisma = PrismaClientManager.getClient();
    const row = await prisma.module.findFirst({
      where: {
        key: moduleKey,
        is_active: true,
      },
      select: {
        id: true,
      },
    });

    return row?.id ?? null;
  }
}
