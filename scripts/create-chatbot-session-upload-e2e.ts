import { PrismaClient } from "@prisma/client";

import { PrismaClientManager } from "../src/database/PrismaClientManager.js";
import { PrismaDocumentArchiveRepository } from "../src/modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { DocumentArchiveService } from "../src/modules/document-archive/services/DocumentArchiveService.js";
import { AssistantSessionDocumentService } from "../src/modules/conversational-assistant/services/AssistantSessionDocumentService.js";
import { DocumentIntelligenceService } from "../src/modules/document-intelligence/services/DocumentIntelligenceService.js";
import { StorageSelector } from "../src/storage/StorageSelector.js";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  PrismaClientManager.setClient(prisma);

  const workspace = await prisma.workspace.findFirstOrThrow({
    where: { code: "main", deleted_at: null },
    select: { id: true },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "samuel.m@fgautomazioni.it" },
    select: { id: true },
  });
  const moduleRecord = await prisma.module.findUnique({
    where: { key: "conversational_assistant" },
    select: { id: true },
  });

  const session = await prisma.assistantSession.create({
    data: {
      workspace_id: workspace.id,
      opened_by_user_id: user.id,
      module_id: moduleRecord?.id ?? null,
      title: "Chatbot upload e2e",
      status: "OPEN",
    },
    select: { id: true },
  });

  const archiveService = new DocumentArchiveService(new PrismaDocumentArchiveRepository(), StorageSelector.create());
  const intelligenceService = new DocumentIntelligenceService(archiveService);
  const uploadService = new AssistantSessionDocumentService(intelligenceService);
  const uploaded = await uploadService.uploadSessionDocument({
    workspaceId: workspace.id,
    sessionId: session.id,
    userId: user.id,
    fileName: "chatbot-session-upload-e2e.txt",
    mimeType: "text/plain",
    bytes: Buffer.from(
      "Documento allegato alla chat. Cliente Delta: manutenzione urgente domani mattina. Priorita critica.",
      "utf8",
    ),
  });

  const context = await intelligenceService.getDocumentChatContext({
    workspaceId: workspace.id,
    documentId: uploaded.documentId,
  });
  const hits = await intelligenceService.searchWorkspaceKnowledge({
    workspaceId: workspace.id,
    query: "Quale cliente ha manutenzione urgente e priorita critica?",
    topK: 3,
    sourceEntityType: context.sourceEntityType,
    sourceEntityId: context.sourceEntityId,
  });

  console.log(JSON.stringify({
    sessionId: session.id,
    uploaded,
    sourceEntityType: context.sourceEntityType,
    sourceEntityId: context.sourceEntityId,
    hits: hits.map((hit) => ({
      title: hit.title,
      preview: hit.contentText.slice(0, 120),
      distance: hit.distance,
    })),
  }, null, 2));

  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
