import { createHash } from "node:crypto";

import { AppError } from "../../../core/errors/AppError.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { StorageSelector } from "../../../storage/StorageSelector.js";
import { DocumentIntelligenceService } from "../../document-intelligence/services/DocumentIntelligenceService.js";

const MAX_ASSISTANT_DOCUMENT_BYTES = 15 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "log"]);

export interface AssistantSessionDocumentView {
  id: string;
  documentId: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  knowledgeDocumentId: string | null;
  extractionStatus: string | null;
  createdAt: Date;
}

export class AssistantSessionDocumentService {
  public constructor(private readonly documentIntelligenceService: DocumentIntelligenceService) {}

  public async listSessionDocuments(params: {
    workspaceId: string;
    sessionId: string;
  }): Promise<AssistantSessionDocumentView[]> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.assistantSessionDocument.findMany({
      where: {
        workspace_id: params.workspaceId,
        session_id: params.sessionId,
        deleted_at: null,
      },
      include: {
        document: {
          include: {
            file_type: {
              select: {
                mime_type: true,
              },
            },
            knowledge_documents: {
              where: {
                deleted_at: null,
              },
              orderBy: {
                updated_at: "desc",
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        created_at: "asc",
      },
    });

    return rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      fileName: row.display_name ?? row.document.filename ?? "documento",
      contentType: row.document.file_type.mime_type,
      sizeBytes: row.document.size_bytes === null ? null : Number(row.document.size_bytes),
      knowledgeDocumentId: row.document.knowledge_documents[0]?.id ?? null,
      extractionStatus: row.document.knowledge_documents[0]?.extraction_status ?? null,
      createdAt: row.created_at,
    }));
  }

  public async uploadSessionDocument(params: {
    workspaceId: string;
    sessionId: string;
    userId: string;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  }): Promise<AssistantSessionDocumentView> {
    this.validateUpload(params.fileName, params.mimeType, params.bytes);

    const prisma = PrismaClientManager.getClient();
    const session = await prisma.assistantSession.findFirst({
      where: {
        id: params.sessionId,
        workspace_id: params.workspaceId,
        opened_by_user_id: params.userId,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });
    if (!session) {
      throw new AppError("Sessione assistente non trovata.", "ASSISTANT_SESSION_NOT_FOUND", 404);
    }

    const storage = StorageSelector.create();
    const checksum = createHash("sha256").update(params.bytes).digest("hex");
    const fileName = this.sanitizeFileName(params.fileName);
    const extension = this.extensionOf(fileName) || "bin";
    const contentType = this.resolveContentType(fileName, params.mimeType);
    const objectKey = GaragePath.buildObjectKey(
      storage.storagePrefix(),
      params.workspaceId,
      params.sessionId,
      "assistant-chat",
      "attachment",
      checksum,
      fileName,
    );
    const stored = await storage.putObject({
      objectKey,
      bytes: params.bytes,
      contentType,
      metadata: {
        workspaceid: params.workspaceId,
        sessionid: params.sessionId,
        sha256: checksum,
      },
    });

    const storagePath = GaragePath.toStoragePath(stored.bucket, stored.objectKey);
    const [fileType, fileStatus, node, moduleRecord] = await Promise.all([
      prisma.fileType.upsert({
        where: { key: extension },
        update: { mime_type: contentType },
        create: { key: extension, mime_type: contentType },
      }),
      prisma.fileStatus.upsert({
        where: { key: "uploaded" },
        update: {},
        create: { key: "uploaded" },
      }),
      prisma.node.upsert({
        where: {
          workspace_id_path_cache: {
            workspace_id: params.workspaceId,
            path_cache: `/documents/assistant/${params.sessionId}`,
          },
        },
        update: { deleted_at: null },
        create: {
          workspace_id: params.workspaceId,
          name: params.sessionId,
          path_cache: `/documents/assistant/${params.sessionId}`,
          depth: 2,
        },
      }),
      prisma.module.findUnique({
        where: { key: "conversational_assistant" },
        select: { id: true },
      }),
    ]);

    const document = await prisma.document.create({
      data: {
        workspace_id: params.workspaceId,
        node_id: node.id,
        file_type_id: fileType.id,
        file_status_id: fileStatus.id,
        module_id: moduleRecord?.id ?? null,
        scope: "WORKSPACE",
        filename: fileName,
        size_bytes: BigInt(params.bytes.length),
        storage_path: storagePath,
        checksum_sha256: checksum,
        uploaded_by_user_id: params.userId,
      },
      select: {
        id: true,
      },
    });

    const link = await prisma.assistantSessionDocument.create({
      data: {
        workspace_id: params.workspaceId,
        session_id: params.sessionId,
        document_id: document.id,
        uploaded_by_user_id: params.userId,
        display_name: fileName,
      },
      select: {
        id: true,
      },
    });

    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        domain_entity_type: "AssistantSessionDocument",
        domain_entity_id: link.id,
      },
    });

    await this.documentIntelligenceService.refreshDocumentKnowledge(params.workspaceId, document.id);
    const view = await this.listSessionDocuments({
      workspaceId: params.workspaceId,
      sessionId: params.sessionId,
    });
    return view.find((item) => item.id === link.id)
      ?? {
        id: link.id,
        documentId: document.id,
        fileName,
        contentType,
        sizeBytes: params.bytes.length,
        knowledgeDocumentId: null,
        extractionStatus: null,
        createdAt: new Date(),
      };
  }

  private validateUpload(fileName: string, mimeType: string, bytes: Buffer): void {
    if (!bytes.length) {
      throw new AppError("File vuoto.", "ASSISTANT_DOCUMENT_EMPTY", 400);
    }
    if (bytes.length > MAX_ASSISTANT_DOCUMENT_BYTES) {
      throw new AppError("File troppo grande. Limite: 15 MB.", "ASSISTANT_DOCUMENT_TOO_LARGE", 413);
    }
    if (this.isPdf(fileName, mimeType, bytes) || this.isTextLike(fileName, mimeType)) {
      return;
    }

    throw new AppError("Formato non supportato: carica PDF o file testuali.", "ASSISTANT_DOCUMENT_UNSUPPORTED", 400);
  }

  private isPdf(fileName: string, mimeType: string, bytes: Buffer): boolean {
    const hasPdfNameOrMime = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
    return hasPdfNameOrMime && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  }

  private isTextLike(fileName: string, mimeType: string): boolean {
    return mimeType.startsWith("text/")
      || TEXT_EXTENSIONS.has(this.extensionOf(fileName));
  }

  private resolveContentType(fileName: string, mimeType: string): string {
    if (mimeType && mimeType !== "application/octet-stream") {
      return mimeType;
    }
    if (fileName.toLowerCase().endsWith(".pdf")) {
      return "application/pdf";
    }
    return "text/plain";
  }

  private extensionOf(fileName: string): string {
    const match = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim());
    return match?.[1]?.toLowerCase() ?? "";
  }

  private sanitizeFileName(fileName: string): string {
    const normalized = fileName.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
    const safeName = normalized.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ");
    return safeName || "documento.txt";
  }
}
