import { PrismaClient } from "@prisma/client";

import { PermissionPolicy } from "../src/core/authorization/PermissionPolicy.js";
import { ModuleAccessPolicy } from "../src/core/module-access/ModuleAccessPolicy.js";
import { PrismaClientManager } from "../src/database/PrismaClientManager.js";
import { WorkspacePermissionPrismaReader } from "../src/database/WorkspacePermissionPrismaReader.js";
import { AiProviderSettingsService } from "../src/modules/ai-runtime/services/AiProviderSettingsService.js";
import { OpenAiCompatibleLmClient } from "../src/modules/ai-runtime/services/OpenAiCompatibleLmClient.js";
import { OpenAiCompatibleToolChatClient } from "../src/modules/ai-runtime/services/OpenAiCompatibleToolChatClient.js";
import { PrismaAssistantSessionRepository } from "../src/modules/conversational-assistant/infra/PrismaAssistantSessionRepository.js";
import { AssistantConversationService } from "../src/modules/conversational-assistant/services/AssistantConversationService.js";
import { AssistantSessionDocumentService } from "../src/modules/conversational-assistant/services/AssistantSessionDocumentService.js";
import { AssistantSessionService } from "../src/modules/conversational-assistant/services/AssistantSessionService.js";
import { AssistantToolAccessService } from "../src/modules/conversational-assistant/services/AssistantToolAccessService.js";
import { AssistantToolRegistry } from "../src/modules/conversational-assistant/services/AssistantToolRegistry.js";
import { PrismaDocumentArchiveRepository } from "../src/modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { DocumentArchiveService } from "../src/modules/document-archive/services/DocumentArchiveService.js";
import { DocumentIntelligenceService } from "../src/modules/document-intelligence/services/DocumentIntelligenceService.js";
import { PrismaModuleAccessRepository } from "../src/modules/module-management/infra/PrismaModuleAccessRepository.js";
import { PrismaProjectRepository } from "../src/modules/projects/infra/PrismaProjectRepository.js";
import { ProjectService } from "../src/modules/projects/services/ProjectService.js";
import { PrismaShipmentRepository } from "../src/modules/shipping/infra/PrismaShipmentRepository.js";
import { ShipmentService } from "../src/modules/shipping/services/ShipmentService.js";
import { StorageSelector } from "../src/storage/StorageSelector.js";

const DOCS = [
  {
    fileName: "chatbot-e2e-alpha.txt",
    text: [
      "Documento Alpha per test chatbot.",
      "Cliente Alpha: manutenzione urgente sulla linea packaging A7.",
      "Priorita: critica.",
      "Azione: inviare un tecnico domani mattina e preparare ricambi motore.",
    ].join("\n"),
  },
  {
    fileName: "chatbot-e2e-beta.txt",
    text: [
      "Documento Beta per test chatbot.",
      "Cliente Beta: offerta retrofit quadro elettrico da 18500 euro.",
      "Priorita: media.",
      "Azione: inviare follow-up commerciale entro venerdi.",
    ].join("\n"),
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  PrismaClientManager.setClient(prisma);

  const workspace = await prisma.workspace.findFirstOrThrow({
    where: { code: "main", deleted_at: null },
    select: { id: true },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "samuel.m@fgautomazioni.it" },
    select: { id: true, email: true },
  });

  const aiSettingsService = new AiProviderSettingsService(prisma);
  OpenAiCompatibleLmClient.setRuntimeConfigResolver(() => aiSettingsService.getRuntimeConfig());

  const storage = StorageSelector.create();
  const archiveService = new DocumentArchiveService(new PrismaDocumentArchiveRepository(), storage);
  const intelligenceService = new DocumentIntelligenceService(archiveService);
  const sessionRepository = new PrismaAssistantSessionRepository();
  const sessionService = new AssistantSessionService(sessionRepository);
  const uploadService = new AssistantSessionDocumentService(intelligenceService);
  const shipmentService = new ShipmentService(new PrismaShipmentRepository());
  const projectService = new ProjectService(new PrismaProjectRepository(), shipmentService);
  const toolRegistry = new AssistantToolRegistry(projectService, shipmentService, intelligenceService);
  const toolAccessService = new AssistantToolAccessService(
    new ModuleAccessPolicy(new PrismaModuleAccessRepository()),
    new PermissionPolicy(new WorkspacePermissionPrismaReader()),
  );
  const conversationService = new AssistantConversationService({
    sessionService,
    toolRegistry,
    toolAccessService,
    documentIntelligenceService: intelligenceService,
    chatClient: new OpenAiCompatibleToolChatClient(),
    repository: sessionRepository,
  });

  const session = await sessionService.createSession({
    workspaceId: workspace.id,
    openedByUserId: user.id,
    moduleKey: "conversational_assistant",
    title: "Chatbot e2e memoria knowledge",
  });

  const uploadedDocuments = [];
  for (const item of DOCS) {
    uploadedDocuments.push(await uploadService.uploadSessionDocument({
      workspaceId: workspace.id,
      sessionId: session.id,
      userId: user.id,
      fileName: item.fileName,
      mimeType: "text/plain",
      bytes: Buffer.from(item.text, "utf8"),
    }));
  }

  const scopedSearch = await toolRegistry.executeTool(
    "search_session_documents_knowledge",
    {
      workspaceId: workspace.id,
      userId: user.id,
      sessionId: session.id,
    },
    {
      query: "cliente priorita critica manutenzione urgente",
      topK: 3,
    },
  );

  const firstTurn = await conversationService.postUserMessage({
    workspaceId: workspace.id,
    userId: user.id,
    sessionId: session.id,
    contentText: "Riassumi i documenti allegati e dimmi cliente, priorita e prossima azione per ognuno.",
  });

  const secondTurn = await conversationService.postUserMessage({
    workspaceId: workspace.id,
    userId: user.id,
    sessionId: session.id,
    contentText: "Nel messaggio precedente quale cliente aveva priorita critica? Rispondi solo con cliente e azione.",
  });

  const messages = await sessionService.listMessagesForUser(workspace.id, user.id, session.id);
  const memory = await sessionService.findLatestMemorySnapshot(workspace.id, user.id, session.id);
  const toolCalls = await prisma.assistantToolCall.findMany({
    where: {
      workspace_id: workspace.id,
      session_id: session.id,
    },
    select: {
      tool_name: true,
      status: true,
      denied_reason: true,
      result_payload: true,
    },
    orderBy: {
      created_at: "asc",
    },
  });

  console.log(JSON.stringify({
    ok: true,
    workspaceId: workspace.id,
    userEmail: user.email,
    sessionId: session.id,
    uploadedDocuments,
    scopedSearch,
    firstTurn: {
      assistantText: firstTurn.assistantMessage.contentText,
      toolCalls: firstTurn.toolCalls.map((toolCall) => ({
        toolName: toolCall.toolName,
        status: toolCall.status,
        deniedReason: toolCall.deniedReason,
      })),
    },
    secondTurn: {
      assistantText: secondTurn.assistantMessage.contentText,
      toolCalls: secondTurn.toolCalls.map((toolCall) => ({
        toolName: toolCall.toolName,
        status: toolCall.status,
        deniedReason: toolCall.deniedReason,
      })),
    },
    memory,
    persisted: {
      messageCount: messages.length,
      roles: messages.map((message) => message.role),
      toolCalls: toolCalls.map((toolCall) => ({
        toolName: toolCall.tool_name,
        status: toolCall.status,
        deniedReason: toolCall.denied_reason,
        hasResult: toolCall.result_payload !== null,
      })),
    },
  }, null, 2));

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
