import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";

export type ActiveDocumentContainer = "all" | "modules" | "playgrounds";

export interface ActiveDocumentDto {
  id: string;
  filename: string;
  sizeBytes: number | null;
  createdAt: string;
  extension: string | null;
  moduleName: string | null;
  moduleKey: string | null;
  nodePath: string;
  container: Exclude<ActiveDocumentContainer, "all"> | "other";
  knowledgeStatus: "indexed" | "processing" | "not_indexed";
}

export class ActiveDocumentsService {
  public async listDocuments(params: {
    workspaceId: string;
    container: ActiveDocumentContainer;
    query?: string;
    knowledge?: "all" | "indexed" | "not_indexed";
  }): Promise<{ selectedContainer: ActiveDocumentContainer; containers: Array<{ key: ActiveDocumentContainer; label: string; description: string; count: number }>; documents: ActiveDocumentDto[] }> {
    const prisma = PrismaClientManager.getClient();
    const rows = await prisma.document.findMany({
      where: {
        workspace_id: params.workspaceId,
        deleted_at: null,
        ...(params.query?.trim()
          ? { filename: { contains: params.query.trim(), mode: "insensitive" } }
          : {}),
      },
      select: {
        id: true,
        filename: true,
        size_bytes: true,
        created_at: true,
        domain_entity_type: true,
        domain_entity_id: true,
        module_id: true,
        node: { select: { path_cache: true } },
        module: { select: { key: true, name: true } },
        file_type: { select: { key: true } },
        knowledge_documents: {
          where: { deleted_at: null },
          orderBy: { updated_at: "desc" },
          take: 1,
          select: { extraction_status: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const workflowRunIds = rows
      .filter((row) => row.domain_entity_type === "WorkflowRun" && row.domain_entity_id)
      .map((row) => row.domain_entity_id as string);
    const workflowKeyByRunId = new Map<string, string>();
    if (workflowRunIds.length > 0) {
      const runs = await prisma.moduleWorkflowRun.findMany({
        where: { workspace_id: params.workspaceId, id: { in: workflowRunIds } },
        select: { id: true, workflow: { select: { key: true } } },
      });
      for (const run of runs) {
        workflowKeyByRunId.set(run.id, run.workflow.key);
      }
    }

    const documents = rows.map((row): ActiveDocumentDto => {
      const workflowKey = row.domain_entity_id ? workflowKeyByRunId.get(row.domain_entity_id) : null;
      const isPlayground = workflowKey === "workflow_playground" || workflowKey?.startsWith("playground_") === true;
      const knowledge = row.knowledge_documents[0];
      const knowledgeStatus = !knowledge
        ? "not_indexed"
        : knowledge.extraction_status === "READY"
          ? "indexed"
          : "processing";
      return {
        id: row.id,
        filename: row.filename?.trim() || "Documento senza nome",
        sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
        createdAt: row.created_at.toISOString(),
        extension: row.file_type.key || null,
        moduleName: row.module?.name ?? null,
        moduleKey: row.module?.key ?? null,
        nodePath: row.node.path_cache,
        container: isPlayground ? "playgrounds" : row.module_id !== null ? "modules" : "other",
        knowledgeStatus,
      };
    });

    const visibleDocuments = documents.filter((document) => {
      if (params.container !== "all" && document.container !== params.container) {
        return false;
      }
      if (params.knowledge === "indexed" && document.knowledgeStatus !== "indexed") {
        return false;
      }
      return !(params.knowledge === "not_indexed" && document.knowledgeStatus === "indexed");
    });

    return {
      selectedContainer: params.container,
      containers: [
        { key: "all", label: "Tutto", description: "Tutti i documenti disponibili", count: documents.length },
        { key: "modules", label: "Moduli salvati", description: "Documenti prodotti o gestiti dai moduli", count: documents.filter((document) => document.container === "modules").length },
        { key: "playgrounds", label: "Playground", description: "Documenti dei workflow liberi", count: documents.filter((document) => document.container === "playgrounds").length },
      ],
      documents: visibleDocuments,
    };
  }

  public async deleteDocument(params: { workspaceId: string; documentId: string }): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const document = await prisma.document.findFirst({
      where: { id: params.documentId, workspace_id: params.workspaceId, deleted_at: null },
      select: { id: true },
    });
    if (!document) {
      throw new AppError("Documento non trovato.", "DOCUMENT_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeDocument.deleteMany({
        where: {
          workspace_id: params.workspaceId,
          OR: [
            { document_id: document.id },
            { source_entity_type: "Document", source_entity_id: document.id },
          ],
        },
      });
      await tx.document.update({ where: { id: document.id }, data: { deleted_at: new Date() } });
    });
  }
}
