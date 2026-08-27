import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { AppError } from "../../../core/errors/AppError.js";
import { GaragePath } from "../../../storage/GaragePath.js";
import { ProjectBinaryStorage } from "../../../storage/ProjectBinaryStorage.js";
import { Prisma } from "@prisma/client";

export type ArchivePackageKey = "complete" | "projects";

export interface ArchivePackageSummary {
  key: ArchivePackageKey;
  label: string;
  description: string;
  count: number;
}

export interface ArchivedItemDto {
  id: string;
  entityType: "project" | "project_version" | "shipment" | "document";
  entityId: string;
  archivedAt: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  versionLabel: string | null;
  shipmentCode: string | null;
  fileName: string | null;
  scope: string | null;
}

export interface ArchivedItemsView {
  selectedPackage: ArchivePackageKey;
  packages: ArchivePackageSummary[];
  items: ArchivedItemDto[];
}

export class ArchivedItemsService {
  private readonly objectStorage: ProjectBinaryStorage;

  public constructor(objectStorage: ProjectBinaryStorage) {
    this.objectStorage = objectStorage;
  }

  public async listArchivedItems(params: {
    workspaceId: string;
    packageKey: ArchivePackageKey;
  }): Promise<ArchivedItemsView> {
    const prisma = PrismaClientManager.getClient();

    const [projects, versions, shipments, documents] = await Promise.all([
      prisma.project.findMany({
        where: {
          workspace_id: params.workspaceId,
          deleted_at: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          deleted_at: true,
        },
      }),
      prisma.projectVersion.findMany({
        where: {
          workspace_id: params.workspaceId,
          deleted_at: {
            not: null,
          },
        },
        select: {
          id: true,
          project_id: true,
          version_label: true,
          deleted_at: true,
          project: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.shipment.findMany({
        where: {
          workspace_id: params.workspaceId,
          deleted_at: {
            not: null,
          },
        },
        select: {
          id: true,
          code: true,
          project_version_id: true,
          deleted_at: true,
          project_version: {
            select: {
              version_label: true,
              project_id: true,
              project: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.document.findMany({
        where: {
          workspace_id: params.workspaceId,
          deleted_at: {
            not: null,
          },
        },
        select: {
          id: true,
          filename: true,
          scope: true,
          domain_entity_type: true,
          domain_entity_id: true,
          size_bytes: true,
          deleted_at: true,
          node: {
            select: {
              path_cache: true,
            },
          },
        },
      }),
    ]);

    const projectNameById = new Map<string, string>();
    for (const project of projects) {
      projectNameById.set(project.id, project.name);
    }

    const missingProjectIds = new Set<string>();
    for (const version of versions) {
      if (!projectNameById.has(version.project_id)) {
        missingProjectIds.add(version.project_id);
      }
    }
    for (const shipment of shipments) {
      if (!projectNameById.has(shipment.project_version.project_id)) {
        missingProjectIds.add(shipment.project_version.project_id);
      }
    }

    const documentProjectRefById = new Map<string, { projectId: string; versionLabel: string | null }>();
    for (const document of documents) {
      const projectRef = this.extractProjectReference(document.domain_entity_type, document.domain_entity_id, document.node.path_cache);
      if (projectRef) {
        documentProjectRefById.set(document.id, projectRef);
        if (!projectNameById.has(projectRef.projectId)) {
          missingProjectIds.add(projectRef.projectId);
        }
      }
    }

    if (missingProjectIds.size > 0) {
      const missingProjects = await prisma.project.findMany({
        where: {
          workspace_id: params.workspaceId,
          id: {
            in: [...missingProjectIds],
          },
        },
        select: {
          id: true,
          name: true,
        },
      });
      for (const project of missingProjects) {
        projectNameById.set(project.id, project.name);
      }
    }

    const allItems: ArchivedItemDto[] = [];
    for (const project of projects) {
      allItems.push({
        id: `project:${project.id}`,
        entityType: "project",
        entityId: project.id,
        archivedAt: project.deleted_at?.toISOString() ?? new Date(0).toISOString(),
        title: project.name,
        description: "Progetto archiviato",
        projectId: project.id,
        projectName: project.name,
        versionLabel: null,
        shipmentCode: null,
        fileName: null,
        scope: null,
      });
    }

    for (const version of versions) {
      const versionLabel = version.version_label.trim().toUpperCase();
      allItems.push({
        id: `project_version:${version.id}`,
        entityType: "project_version",
        entityId: String(version.id),
        archivedAt: version.deleted_at?.toISOString() ?? new Date(0).toISOString(),
        title: `Versione ${versionLabel}`,
        description: `Versionamento ${versionLabel} archiviato`,
        projectId: version.project_id,
        projectName: version.project.name,
        versionLabel: version.version_label,
        shipmentCode: null,
        fileName: null,
        scope: null,
      });
    }

    for (const shipment of shipments) {
      const versionLabel = shipment.project_version.version_label.trim().toUpperCase();
      allItems.push({
        id: `shipment:${shipment.id}`,
        entityType: "shipment",
        entityId: shipment.id,
        archivedAt: shipment.deleted_at?.toISOString() ?? new Date(0).toISOString(),
        title: `Spedizione ${shipment.code}`,
        description: `Spedizione archiviata della versione ${versionLabel}`,
        projectId: shipment.project_version.project_id,
        projectName: shipment.project_version.project.name,
        versionLabel: shipment.project_version.version_label,
        shipmentCode: shipment.code,
        fileName: null,
        scope: null,
      });
    }

    for (const document of documents) {
      const projectRef = documentProjectRefById.get(document.id) ?? null;
      const projectName = projectRef ? projectNameById.get(projectRef.projectId) ?? null : null;
      allItems.push({
        id: `document:${document.id}`,
        entityType: "document",
        entityId: document.id,
        archivedAt: document.deleted_at?.toISOString() ?? new Date(0).toISOString(),
        title: document.filename?.trim() || "Documento senza nome",
        description: this.describeArchivedDocument(document.scope, document.size_bytes),
        projectId: projectRef?.projectId ?? null,
        projectName,
        versionLabel: projectRef?.versionLabel ?? null,
        shipmentCode: null,
        fileName: document.filename?.trim() || null,
        scope: document.scope,
      });
    }

    allItems.sort((left, right) => {
      const leftTime = Date.parse(left.archivedAt);
      const rightTime = Date.parse(right.archivedAt);
      return rightTime - leftTime;
    });

    const projectItems = allItems.filter((item) => item.projectId !== null);
    const filteredItems = params.packageKey === "projects" ? projectItems : allItems;

    return {
      selectedPackage: params.packageKey,
      packages: [
        {
          key: "complete",
          label: "Completo",
          description: "Tutti gli elementi archiviati",
          count: allItems.length,
        },
        {
          key: "projects",
          label: "Progetti",
          description: "Archivio riferito ai progetti",
          count: projectItems.length,
        },
      ],
      items: filteredItems,
    };
  }

  public async restoreArchivedItem(params: {
    workspaceId: string;
    entityType: ArchivedItemDto["entityType"];
    entityId: string;
  }): Promise<void> {
    switch (params.entityType) {
      case "project":
        await this.restoreProject(params.workspaceId, params.entityId);
        return;
      case "project_version":
        await this.restoreProjectVersion(params.workspaceId, params.entityId);
        return;
      case "shipment":
        await this.restoreShipment(params.workspaceId, params.entityId);
        return;
      case "document":
        await this.restoreDocument(params.workspaceId, params.entityId);
        return;
      default:
        throw new AppError("Tipo archivio non supportato.", "ARCHIVE_ENTITY_TYPE_INVALID", 400);
    }
  }

  public async permanentlyDeleteArchivedItem(params: {
    workspaceId: string;
    entityType: ArchivedItemDto["entityType"];
    entityId: string;
  }): Promise<void> {
    switch (params.entityType) {
      case "project":
        await this.permanentlyDeleteProject(params.workspaceId, params.entityId);
        return;
      case "project_version":
        await this.permanentlyDeleteProjectVersion(params.workspaceId, params.entityId);
        return;
      case "shipment":
        await this.permanentlyDeleteShipment(params.workspaceId, params.entityId);
        return;
      case "document":
        await this.permanentlyDeleteDocument(params.workspaceId, params.entityId);
        return;
      default:
        throw new AppError("Tipo archivio non supportato.", "ARCHIVE_ENTITY_TYPE_INVALID", 400);
    }
  }

  public async emptyTrash(workspaceId: string): Promise<void> {
    const archived = await this.listArchivedItems({ workspaceId, packageKey: "complete" });
    const priority: Record<ArchivedItemDto["entityType"], number> = {
      project: 0,
      project_version: 1,
      shipment: 2,
      document: 3,
    };
    const items = [...archived.items].sort((left, right) => priority[left.entityType] - priority[right.entityType]);

    for (const item of items) {
      try {
        await this.permanentlyDeleteArchivedItem({
          workspaceId,
          entityType: item.entityType,
          entityId: item.entityId,
        });
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "ARCHIVE_ITEM_NOT_FOUND") {
          throw error;
        }
      }
    }
  }

  private extractProjectReference(
    domainEntityType: string | null,
    domainEntityId: string | null,
    pathCache: string,
  ): { projectId: string; versionLabel: string | null } | null {
    if (domainEntityType === "Project" && domainEntityId) {
      const parsed = this.readProjectVersionFromPath(pathCache);
      return {
        projectId: domainEntityId,
        versionLabel: parsed?.versionLabel ?? null,
      };
    }

    const parsed = this.readProjectVersionFromPath(pathCache);
    if (!parsed) {
      return null;
    }

    return {
      projectId: parsed.projectId,
      versionLabel: parsed.versionLabel,
    };
  }

  private readProjectVersionFromPath(pathCache: string): { projectId: string; versionLabel: string | null } | null {
    const match = pathCache.match(/^\/documents\/([^/]+)\/([^/]+)\//);
    if (!match) {
      return null;
    }

    return {
      projectId: match[1],
      versionLabel: match[2] ?? null,
    };
  }

  private describeArchivedDocument(scope: string, sizeBytes: bigint | null): string {
    const scopeLabel = scope.replace(/_/g, " ").toLowerCase();
    const size = sizeBytes !== null ? `${this.toNumber(sizeBytes)} B` : "dimensione sconosciuta";
    return `Documento ${scopeLabel}, ${size}`;
  }

  private toNumber(value: bigint): number {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return asNumber;
    }

    return 0;
  }

  private async restoreProject(workspaceId: string, projectId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();

    const project = await prisma.project.findFirst({
      where: {
        workspace_id: workspaceId,
        id: projectId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });
    if (!project) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: {
          id: projectId,
        },
        data: {
          deleted_at: null,
        },
      });

      await tx.projectClient.updateMany({
        where: {
          workspace_id: workspaceId,
          project_id: projectId,
          deleted_at: {
            not: null,
          },
        },
        data: {
          deleted_at: null,
        },
      });

      await tx.projectVersion.updateMany({
        where: {
          workspace_id: workspaceId,
          project_id: projectId,
          deleted_at: {
            not: null,
          },
        },
        data: {
          deleted_at: null,
        },
      });

      await tx.shipment.updateMany({
        where: {
          workspace_id: workspaceId,
          project_version: {
            workspace_id: workspaceId,
            project_id: projectId,
          },
          deleted_at: {
            not: null,
          },
        },
        data: {
          deleted_at: null,
        },
      });
    });
  }

  private async restoreProjectVersion(workspaceId: string, entityId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const versionId = this.parseNumericId(entityId, "ARCHIVE_ENTITY_ID_INVALID");

    const version = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: workspaceId,
        id: versionId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
        project_id: true,
      },
    });
    if (!version) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.updateMany({
        where: {
          workspace_id: workspaceId,
          id: version.project_id,
        },
        data: {
          deleted_at: null,
        },
      });

      await tx.projectVersion.update({
        where: {
          id: versionId,
        },
        data: {
          deleted_at: null,
        },
      });

      await tx.shipment.updateMany({
        where: {
          workspace_id: workspaceId,
          project_version_id: versionId,
          deleted_at: {
            not: null,
          },
        },
        data: {
          deleted_at: null,
        },
      });
    });
  }

  private async restoreShipment(workspaceId: string, shipmentId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const shipment = await prisma.shipment.findFirst({
      where: {
        workspace_id: workspaceId,
        id: shipmentId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
        project_version_id: true,
        project_version: {
          select: {
            project_id: true,
          },
        },
      },
    });
    if (!shipment) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.updateMany({
        where: {
          workspace_id: workspaceId,
          id: shipment.project_version.project_id,
        },
        data: {
          deleted_at: null,
        },
      });
      await tx.projectVersion.updateMany({
        where: {
          workspace_id: workspaceId,
          id: shipment.project_version_id,
        },
        data: {
          deleted_at: null,
        },
      });
      await tx.shipment.update({
        where: {
          id: shipment.id,
        },
        data: {
          deleted_at: null,
        },
      });
    });
  }

  private async restoreDocument(workspaceId: string, documentId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const document = await prisma.document.findFirst({
      where: {
        workspace_id: workspaceId,
        id: documentId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
        filename: true,
        scope: true,
      },
    });
    if (!document) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      if (document.scope === "DDT") {
        const ddt = await tx.ddtDocument.findUnique({
          where: {
            document_id: document.id,
          },
          select: {
            id: true,
          },
        });

        if (!ddt) {
          const created = await tx.ddtDocument.create({
            data: {
              workspace_id: workspaceId,
              document_id: document.id,
              status: "UPLOADED",
              original_filename: document.filename ?? "document.pdf",
            },
            select: {
              id: true,
            },
          });

          await tx.document.update({
            where: {
              id: document.id,
            },
            data: {
              domain_entity_type: "DdtDocument",
              domain_entity_id: created.id,
              deleted_at: null,
            },
          });
          return;
        }
      }

      await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          deleted_at: null,
        },
      });
    });
  }

  private async permanentlyDeleteProject(workspaceId: string, projectId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const project = await prisma.project.findFirst({
      where: {
        workspace_id: workspaceId,
        id: projectId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });
    if (!project) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    const versionRows = await prisma.projectVersion.findMany({
      where: {
        workspace_id: workspaceId,
        project_id: projectId,
      },
      select: {
        id: true,
      },
    });
    const versionIds = versionRows.map((item) => item.id);

    const shipmentRows = versionIds.length > 0
      ? await prisma.shipment.findMany({
        where: {
          workspace_id: workspaceId,
          project_version_id: {
            in: versionIds,
          },
        },
        select: {
          id: true,
        },
      })
      : [];
    const shipmentIds = shipmentRows.map((item) => item.id);

    const projectDocuments = await prisma.document.findMany({
      where: {
        workspace_id: workspaceId,
        OR: [
          {
            domain_entity_type: "Project",
            domain_entity_id: projectId,
          },
          {
            node: {
              workspace_id: workspaceId,
              path_cache: {
                startsWith: `/documents/${projectId}/`,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        storage_path: true,
      },
    });
    const documentIds = projectDocuments.map((item) => item.id);
    const storagePaths = projectDocuments.map((item) => item.storage_path);

    await prisma.$transaction(async (tx) => {
      if (documentIds.length > 0) {
        await this.deleteAssistantSessionDocuments(tx, workspaceId, documentIds);
        await this.deleteKnowledgeForDocuments(tx, workspaceId, documentIds);
        await this.deleteDdtRelationsByDocumentIds(tx, workspaceId, documentIds);
        await tx.document.deleteMany({
          where: {
            workspace_id: workspaceId,
            id: {
              in: documentIds,
            },
          },
        });
      }

      if (shipmentIds.length > 0) {
        await tx.shipment.deleteMany({
          where: {
            workspace_id: workspaceId,
            id: {
              in: shipmentIds,
            },
          },
        });
      }

      if (versionIds.length > 0) {
        await tx.projectVersion.deleteMany({
          where: {
            workspace_id: workspaceId,
            id: {
              in: versionIds,
            },
          },
        });
      }

      await tx.projectClient.deleteMany({
        where: {
          workspace_id: workspaceId,
          project_id: projectId,
        },
      });

      await tx.project.delete({
        where: {
          id: projectId,
        },
      });
    });

    await this.removeStoragePaths(storagePaths);
  }

  private async permanentlyDeleteProjectVersion(workspaceId: string, entityId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const versionId = this.parseNumericId(entityId, "ARCHIVE_ENTITY_ID_INVALID");
    const version = await prisma.projectVersion.findFirst({
      where: {
        workspace_id: workspaceId,
        id: versionId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
        project_id: true,
        version_label: true,
      },
    });
    if (!version) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    const shipmentRows = await prisma.shipment.findMany({
      where: {
        workspace_id: workspaceId,
        project_version_id: versionId,
      },
      select: {
        id: true,
      },
    });
    const shipmentIds = shipmentRows.map((item) => item.id);

    const docs = await prisma.document.findMany({
      where: {
        workspace_id: workspaceId,
        node: {
          workspace_id: workspaceId,
          path_cache: {
            startsWith: `/documents/${version.project_id}/${version.version_label.toLowerCase()}/`,
          },
        },
      },
      select: {
        id: true,
        storage_path: true,
      },
    });
    const documentIds = docs.map((item) => item.id);
    const storagePaths = docs.map((item) => item.storage_path);

    await prisma.$transaction(async (tx) => {
      if (documentIds.length > 0) {
        await this.deleteAssistantSessionDocuments(tx, workspaceId, documentIds);
        await this.deleteKnowledgeForDocuments(tx, workspaceId, documentIds);
        await this.deleteDdtRelationsByDocumentIds(tx, workspaceId, documentIds);
        await tx.document.deleteMany({
          where: {
            workspace_id: workspaceId,
            id: {
              in: documentIds,
            },
          },
        });
      }

      if (shipmentIds.length > 0) {
        await tx.shipment.deleteMany({
          where: {
            workspace_id: workspaceId,
            id: {
              in: shipmentIds,
            },
          },
        });
      }

      await tx.projectVersion.delete({
        where: {
          id: versionId,
        },
      });
    });

    await this.removeStoragePaths(storagePaths);
  }

  private async permanentlyDeleteShipment(workspaceId: string, shipmentId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const shipment = await prisma.shipment.findFirst({
      where: {
        workspace_id: workspaceId,
        id: shipmentId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });
    if (!shipment) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.shipment.delete({
        where: {
          id: shipmentId,
        },
      });
    });
  }

  private async permanentlyDeleteDocument(workspaceId: string, documentId: string): Promise<void> {
    const prisma = PrismaClientManager.getClient();
    const document = await prisma.document.findFirst({
      where: {
        workspace_id: workspaceId,
        id: documentId,
        deleted_at: {
          not: null,
        },
      },
      select: {
        id: true,
        storage_path: true,
      },
    });
    if (!document) {
      throw new AppError("Elemento archivio non trovato.", "ARCHIVE_ITEM_NOT_FOUND", 404);
    }

    await prisma.$transaction(async (tx) => {
      await this.deleteAssistantSessionDocuments(tx, workspaceId, [document.id]);
      await this.deleteKnowledgeForDocuments(tx, workspaceId, [document.id]);
      await this.deleteDdtRelationsByDocumentIds(tx, workspaceId, [document.id]);
      await tx.document.delete({
        where: {
          id: document.id,
        },
      });
    });

    await this.removeStoragePaths([document.storage_path]);
  }

  private parseNumericId(value: string, code: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError("Identificativo non valido.", code, 400);
    }

    return parsed;
  }

  private async removeStoragePaths(storagePaths: string[]): Promise<void> {
    const uniquePaths = [...new Set(storagePaths.filter((item) => item.startsWith("garage://")))];
    for (const storagePath of uniquePaths) {
      try {
        const parsed = GaragePath.parse(storagePath);
        await this.objectStorage.deleteObject(parsed.bucket, parsed.objectKey);
      } catch {
        // best effort cleanup
      }
    }
  }

  private async deleteDdtRelationsByDocumentIds(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    documentIds: string[],
  ): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    const ddtRows = await tx.ddtDocument.findMany({
      where: {
        workspace_id: workspaceId,
        document_id: {
          in: documentIds,
        },
      },
      select: {
        id: true,
      },
    });
    if (ddtRows.length === 0) {
      return;
    }

    const ddtIds = ddtRows.map((item) => item.id);
    await tx.ddtDocument.deleteMany({
      where: {
        workspace_id: workspaceId,
        id: {
          in: ddtIds,
        },
      },
    });
  }

  private async deleteAssistantSessionDocuments(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    documentIds: string[],
  ): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    await tx.assistantSessionDocument.deleteMany({
      where: {
        workspace_id: workspaceId,
        document_id: {
          in: documentIds,
        },
      },
    });
  }

  private async deleteKnowledgeForDocuments(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    documentIds: string[],
  ): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    await tx.knowledgeDocument.deleteMany({
      where: {
        workspace_id: workspaceId,
        OR: [
          {
            document_id: {
              in: documentIds,
            },
          },
          {
            source_entity_type: "Document",
            source_entity_id: {
              in: documentIds,
            },
          },
        ],
      },
    });
  }

}
