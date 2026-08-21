import { PrismaClient } from "@prisma/client";

import { PrismaClientManager } from "../src/database/PrismaClientManager.js";
import { PrismaDocumentArchiveRepository } from "../src/modules/document-archive/infra/PrismaDocumentArchiveRepository.js";
import { DocumentArchiveService } from "../src/modules/document-archive/services/DocumentArchiveService.js";
import { DocumentIntelligenceService } from "../src/modules/document-intelligence/services/DocumentIntelligenceService.js";
import { StorageSelector } from "../src/storage/StorageSelector.js";
import { GaragePath } from "../src/storage/GaragePath.js";

const TEST_DOCS = [
  {
    fileName: "chatbot-test-manutenzione.txt",
    text: [
      "Documento test manutenzione.",
      "Il cliente Alfa richiede manutenzione trimestrale sulla linea packaging A7.",
      "La priorita e alta per vibrazioni anomale sul motore principale.",
      "Azione consigliata: programmare intervento entro cinque giorni lavorativi.",
    ].join("\n"),
  },
  {
    fileName: "chatbot-test-offerta.txt",
    text: [
      "Documento test offerta commerciale.",
      "Il cliente Beta valuta una proposta da 18.500 euro per retrofit quadro elettrico.",
      "La probabilita stimata e media; il margine atteso e buono se i componenti restano disponibili.",
      "Azione consigliata: inviare follow-up tecnico e commerciale entro venerdi.",
    ].join("\n"),
  },
  {
    fileName: "chatbot-test-sicurezza.txt",
    text: [
      "Documento test sicurezza impianto.",
      "Il cliente Gamma segnala un blocco intermittente della barriera fotoelettrica.",
      "Il rischio operativo e medio per fermate non pianificate durante il turno notte.",
      "Azione consigliata: verificare cablaggio, log PLC e allineamento sensori.",
    ].join("\n"),
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  PrismaClientManager.setClient(prisma);

  const workspace = await prisma.workspace.findFirst({
    where: { code: "main", deleted_at: null },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error("Workspace main non trovato.");
  }

  const [fileType, fileStatus, node, moduleRecord] = await Promise.all([
    prisma.fileType.upsert({
      where: { key: "txt" },
      update: { mime_type: "text/plain" },
      create: { key: "txt", mime_type: "text/plain" },
    }),
    prisma.fileStatus.upsert({
      where: { key: "uploaded" },
      update: {},
      create: { key: "uploaded" },
    }),
    prisma.node.upsert({
      where: {
        workspace_id_path_cache: {
          workspace_id: workspace.id,
          path_cache: "/documents/chatbot-e2e",
        },
      },
      update: { deleted_at: null },
      create: {
        workspace_id: workspace.id,
        name: "chatbot-e2e",
        path_cache: "/documents/chatbot-e2e",
        depth: 1,
      },
    }),
    prisma.module.findUnique({
      where: { key: "document_intelligence" },
      select: { id: true },
    }),
  ]);

  const storage = StorageSelector.create();
  const archiveService = new DocumentArchiveService(new PrismaDocumentArchiveRepository(), storage);
  const intelligenceService = new DocumentIntelligenceService(archiveService);
  const createdDocuments: Array<{ id: string; fileName: string }> = [];

  for (const item of TEST_DOCS) {
    const bytes = Buffer.from(item.text, "utf8");
    const checksum = storage.sha256Hex(bytes);
    const objectKey = GaragePath.buildObjectKey(
      storage.storagePrefix(),
      workspace.id,
      "chatbot-e2e",
      "test-set",
      "knowledge-text",
      checksum,
      item.fileName,
    );
    const stored = await storage.putObject({
      objectKey,
      bytes,
      contentType: "text/plain; charset=utf-8",
      metadata: {
        workspaceid: workspace.id,
        purpose: "chatbot-e2e",
        sha256: checksum,
      },
    });
    const storagePath = GaragePath.toStoragePath(stored.bucket, stored.objectKey);

    const existing = await prisma.document.findFirst({
      where: {
        workspace_id: workspace.id,
        node_id: node.id,
        filename: item.fileName,
        deleted_at: null,
      },
      select: { id: true },
    });

    const document = existing
      ? await prisma.document.update({
          where: { id: existing.id },
          data: {
            file_type_id: fileType.id,
            file_status_id: fileStatus.id,
            module_id: moduleRecord?.id ?? null,
            filename: item.fileName,
            size_bytes: BigInt(bytes.length),
            storage_path: storagePath,
            checksum_sha256: checksum,
            scope: "WORKSPACE",
            domain_entity_type: null,
            domain_entity_id: null,
          },
          select: { id: true, filename: true },
        })
      : await prisma.document.create({
          data: {
            workspace_id: workspace.id,
            node_id: node.id,
            file_type_id: fileType.id,
            file_status_id: fileStatus.id,
            module_id: moduleRecord?.id ?? null,
            filename: item.fileName,
            size_bytes: BigInt(bytes.length),
            storage_path: storagePath,
            checksum_sha256: checksum,
            scope: "WORKSPACE",
          },
          select: { id: true, filename: true },
        });

    await intelligenceService.refreshDocumentKnowledge(workspace.id, document.id);
    createdDocuments.push({ id: document.id, fileName: document.filename ?? item.fileName });
  }

  const searchHits = await intelligenceService.searchWorkspaceKnowledge({
    workspaceId: workspace.id,
    query: "Quale cliente ha priorita alta per manutenzione e quale azione e consigliata?",
    topK: 5,
  });

  let aiAnalysis: Record<string, unknown> | null = null;
  let aiError: string | null = null;
  try {
    const aiProvider = await loadAiProviderOverride(prisma);
    aiAnalysis = await intelligenceService.analyzeDocumentSet({
      workspaceId: workspace.id,
      documentIds: createdDocuments.map((document) => document.id),
      prompt: "Riassumi i tre documenti e indica per ogni cliente priorita, rischio o prossima azione.",
      knowledgeMode: "hybrid",
      useDeepReasoning: false,
      aiProvider,
    });
  } catch (error) {
    aiError = error instanceof Error ? error.message : String(error);
  }

  console.log(JSON.stringify({
    workspaceId: workspace.id,
    documents: createdDocuments,
    searchHits: searchHits.map((hit) => ({
      title: hit.title,
      documentId: hit.documentId,
      chunkIndex: hit.chunkIndex,
      distance: hit.distance,
      preview: hit.contentText.slice(0, 180),
    })),
    aiAnalysis,
    aiError,
  }, null, 2));

  await prisma.$disconnect();
}

async function loadAiProviderOverride(prisma: PrismaClient): Promise<Record<string, unknown> | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: "ai_provider" },
    select: { value: true },
  });
  const value = row?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const config = value as Record<string, unknown>;
  const override: Record<string, unknown> = {};
  if (typeof config.baseUrl === "string" && config.baseUrl.trim()) {
    override.base_url = config.baseUrl.trim();
  }
  if (typeof config.chatModel === "string" && config.chatModel.trim()) {
    override.chat_model = config.chatModel.trim();
  }
  if (typeof config.temperature === "number" && Number.isFinite(config.temperature)) {
    override.temperature = config.temperature;
  }
  if (typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0) {
    override.timeout_ms = Math.trunc(config.timeoutMs);
  }
  return Object.keys(override).length > 0 ? override : null;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
