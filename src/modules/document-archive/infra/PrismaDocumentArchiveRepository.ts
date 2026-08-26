import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";
import { DocumentEntity } from "../domain/DocumentEntity.js";
import { FileKindValue } from "../domain/FileKind.js";
import { DocumentArchiveRepository } from "../repositories/DocumentArchiveRepository.js";

const ROOT_PATH = "/documents";

const FILE_KIND_META: Record<FileKindValue, { defaultFileName: string; extension: string }> = {
  "email-pdf": { defaultFileName: "email.pdf", extension: "pdf" },
  "quotation-docx": { defaultFileName: "preventivo.docx", extension: "docx" },
  "quotation-pdf": { defaultFileName: "preventivo.pdf", extension: "pdf" },
  "quotation-xlsx": { defaultFileName: "preventivo.xlsx", extension: "xlsx" },
  "tech-pdf": { defaultFileName: "specifica-tecnica.pdf", extension: "pdf" },
};

export class PrismaDocumentArchiveRepository implements DocumentArchiveRepository {
  public async getCurrentProjectFile(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName?: string;
  }): Promise<DocumentEntity | null> {
    const prisma = PrismaClientManager.getClient();
    const nodePath = this.buildNodePath(params.projectId, params.versionLabel, params.fileKind);

    const node = await prisma.node.findFirst({
      where: {
        workspace_id: params.workspaceId,
        path_cache: nodePath,
        deleted_at: null,
      },
      select: {
        id: true,
      },
    });

    if (!node) {
      return null;
    }

    const row = await prisma.document.findFirst({
      where: {
        workspace_id: params.workspaceId,
        node_id: node.id,
        filename: params.fileName ?? undefined,
        deleted_at: null,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        id: true,
        workspace_id: true,
        node_id: true,
        filename: true,
        size_bytes: true,
        storage_path: true,
        created_at: true,
      },
    });

    return row ? this.toDocumentEntity(row) : null;
  }

  public async upsertProjectFileRecord(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName: string;
    storagePath: string;
    sizeBytes: number;
    uploadedByUserId: string | null;
  }): Promise<{ document: DocumentEntity; previousStoragePath: string | null }> {
    const prisma = PrismaClientManager.getClient();
    const normalizedVersion = this.normalizeVersionLabel(params.versionLabel);

    const node = await this.ensureProjectNodeChain(
      params.workspaceId,
      params.projectId,
      normalizedVersion,
      params.fileKind,
    );

    const meta = FILE_KIND_META[params.fileKind];
    const resolvedFileName = (params.fileName.trim() || meta.defaultFileName).trim();

    const [fileType, fileStatus, existing] = await Promise.all([
      prisma.fileType.upsert({
        where: { key: meta.extension },
        update: {},
        create: {
          key: meta.extension,
          mime_type: this.resolveMimeType(meta.extension),
        },
      }),
      prisma.fileStatus.upsert({
        where: { key: "uploaded" },
        update: {},
        create: {
          key: "uploaded",
        },
      }),
      prisma.document.findFirst({
        where: {
          workspace_id: params.workspaceId,
          node_id: node.id,
          filename: resolvedFileName,
          deleted_at: null,
        },
        orderBy: {
          created_at: "desc",
        },
        select: {
          id: true,
          storage_path: true,
        },
      }),
    ]);

    if (existing) {
      const updated = await prisma.document.update({
        where: {
          id: existing.id,
        },
        data: {
          filename: resolvedFileName,
          size_bytes: BigInt(params.sizeBytes),
          storage_path: params.storagePath,
          file_type_id: fileType.id,
          file_status_id: fileStatus.id,
          uploaded_by_user_id: params.uploadedByUserId,
        },
        select: {
          id: true,
          workspace_id: true,
          node_id: true,
          filename: true,
          size_bytes: true,
          storage_path: true,
          created_at: true,
        },
      });

      return {
        document: this.toDocumentEntity(updated),
        previousStoragePath: existing.storage_path,
      };
    }

    const created = await prisma.document.create({
      data: {
        workspace_id: params.workspaceId,
        node_id: node.id,
        filename: resolvedFileName,
        size_bytes: BigInt(params.sizeBytes),
        storage_path: params.storagePath,
        file_type_id: fileType.id,
        file_status_id: fileStatus.id,
        uploaded_by_user_id: params.uploadedByUserId,
        scope: "PROJECT",
        domain_entity_type: "Project",
        domain_entity_id: params.projectId,
      },
      select: {
        id: true,
        workspace_id: true,
        node_id: true,
        filename: true,
        size_bytes: true,
        storage_path: true,
        created_at: true,
      },
    });

    return {
      document: this.toDocumentEntity(created),
      previousStoragePath: null,
    };
  }

  public async listProjectVersionFiles(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
  }): Promise<DocumentEntity[]> {
    const prisma = PrismaClientManager.getClient();
    const versionPath = `${ROOT_PATH}/${params.projectId}/${this.normalizeVersionLabel(params.versionLabel)}/`;

    const rows = await prisma.document.findMany({
      where: {
        workspace_id: params.workspaceId,
        deleted_at: null,
        node: {
          workspace_id: params.workspaceId,
          deleted_at: null,
          path_cache: {
            startsWith: versionPath,
          },
        },
      },
      select: {
        id: true,
        workspace_id: true,
        node_id: true,
        filename: true,
        size_bytes: true,
        storage_path: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return rows.map((row) => this.toDocumentEntity(row));
  }

  public async softDeleteProjectFile(params: {
    workspaceId: string;
    projectId: string;
    versionLabel: string;
    fileKind: FileKindValue;
    fileName?: string;
  }): Promise<DocumentEntity | null> {
    const existing = await this.getCurrentProjectFile(params);
    if (!existing) {
      return null;
    }

    const prisma = PrismaClientManager.getClient();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.knowledgeDocument.deleteMany({
        where: {
          workspace_id: params.workspaceId,
          OR: [
            { document_id: existing.id },
            { source_entity_type: "Document", source_entity_id: existing.id },
          ],
        },
      });

      return tx.document.update({
        where: {
          id: existing.id,
        },
        data: {
          deleted_at: new Date(),
        },
        select: {
          id: true,
          workspace_id: true,
          node_id: true,
          filename: true,
          size_bytes: true,
          storage_path: true,
          created_at: true,
        },
      });
    });

    return this.toDocumentEntity(updated);
  }

  private async ensureProjectNodeChain(
    workspaceId: string,
    projectId: string,
    versionLabel: string,
    fileKind: FileKindValue,
  ): Promise<{ id: string; depth: number }> {
    const root = await this.ensureNode(workspaceId, null, "documents", ROOT_PATH, 0);

    const projectPath = `${ROOT_PATH}/${projectId}`;
    const projectNode = await this.ensureNode(workspaceId, root.id, projectId, projectPath, 1);

    const versionPath = `${projectPath}/${versionLabel}`;
    const versionNode = await this.ensureNode(
      workspaceId,
      projectNode.id,
      versionLabel,
      versionPath,
      projectNode.depth + 1,
    );

    const kindPath = `${versionPath}/${fileKind}`;
    return this.ensureNode(
      workspaceId,
      versionNode.id,
      fileKind,
      kindPath,
      versionNode.depth + 1,
    );
  }

  private async ensureNode(
    workspaceId: string,
    parentId: string | null,
    name: string,
    pathCache: string,
    depth: number,
  ): Promise<{ id: string; depth: number }> {
    const prisma = PrismaClientManager.getClient();

    const existing = await prisma.node.findFirst({
      where: {
        workspace_id: workspaceId,
        path_cache: pathCache,
        deleted_at: null,
      },
      select: {
        id: true,
        depth: true,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.node.create({
      data: {
        workspace_id: workspaceId,
        parent_id: parentId,
        name,
        path_cache: pathCache,
        depth,
      },
      select: {
        id: true,
        depth: true,
      },
    });
  }

  private buildNodePath(projectId: string, versionLabel: string, fileKind: FileKindValue): string {
    return `${ROOT_PATH}/${projectId}/${this.normalizeVersionLabel(versionLabel)}/${fileKind}`;
  }

  private normalizeVersionLabel(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    return normalized || "v1";
  }

  private resolveMimeType(extension: string): string {
    switch (extension) {
      case "pdf":
        return "application/pdf";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  }

  private toDocumentEntity(row: {
    id: string;
    workspace_id: string;
    node_id: string;
    filename: string | null;
    size_bytes: bigint | null;
    storage_path: string;
    created_at: Date;
  }): DocumentEntity {
    return new DocumentEntity({
      id: row.id,
      workspaceId: row.workspace_id,
      nodeId: row.node_id,
      filename: row.filename,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      storagePath: row.storage_path,
      createdAt: row.created_at,
    });
  }
}
