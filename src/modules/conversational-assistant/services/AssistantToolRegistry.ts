import { z } from "zod";

import { PermissionKey } from "../../../core/authorization/PermissionKey.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { DocumentIntelligenceService } from "../../document-intelligence/services/DocumentIntelligenceService.js";
import { ProjectService } from "../../projects/services/ProjectService.js";
import { ShipmentService } from "../../shipping/services/ShipmentService.js";
import { AssistantToolDefinition, AssistantToolExecutionContext } from "../tools/AssistantToolDefinition.js";

export class AssistantToolRegistry {
  private readonly projectService: ProjectService;
  private readonly shipmentService: ShipmentService;
  private readonly documentIntelligenceService: DocumentIntelligenceService;
  private readonly tools: Map<string, AssistantToolDefinition>;

  public constructor(
    projectService: ProjectService,
    shipmentService: ShipmentService,
    documentIntelligenceService: DocumentIntelligenceService,
  ) {
    this.projectService = projectService;
    this.shipmentService = shipmentService;
    this.documentIntelligenceService = documentIntelligenceService;
    this.tools = new Map(this.buildTools().map((tool) => [tool.name, tool]));
  }

  public listDefinitions(): AssistantToolDefinition[] {
    return [...this.tools.values()];
  }

  public getTool(name: string): AssistantToolDefinition | null {
    return this.tools.get(name) ?? null;
  }

  public async executeTool(name: string, context: AssistantToolExecutionContext, args: unknown): Promise<Record<string, unknown>> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool non registrato: ${name}`);
    }

    const parsed = tool.parametersSchema.parse(args);
    return tool.execute(context, parsed);
  }

  private buildTools(): AssistantToolDefinition[] {
    const searchProjectsSchema = z.object({
      projectName: z.string().min(2),
    });
    const projectVersionsSchema = z.object({
      projectId: z.string().uuid(),
    });
    const projectVersionSchema = z.object({
      projectId: z.string().uuid(),
      versionLabel: z.string().min(1),
    });
    const semanticSearchSchema = z.object({
      query: z.string().min(2),
      topK: z.number().int().positive().max(10).optional(),
      sourceEntityType: z.string().min(1).optional(),
      sourceEntityId: z.string().min(1).optional(),
    });
    const linkedDocumentSearchSchema = z.object({
      query: z.string().min(2),
      topK: z.number().int().positive().max(10).optional(),
    });
    const sessionDocumentsSearchSchema = z.object({
      query: z.string().min(2),
      topK: z.number().int().positive().max(10).optional(),
    });
    const targetedSearchSchema = z.object({
      query: z.string().min(2),
      topK: z.number().int().positive().max(10).optional(),
      sourceEntityType: z.string().min(1).optional(),
      sourceEntityId: z.string().min(1).optional(),
    });
    type SearchProjectsArgs = z.infer<typeof searchProjectsSchema>;
    type ProjectVersionsArgs = z.infer<typeof projectVersionsSchema>;
    type ProjectVersionArgs = z.infer<typeof projectVersionSchema>;
    type SemanticSearchArgs = z.infer<typeof semanticSearchSchema>;
    type TargetedSearchArgs = z.infer<typeof targetedSearchSchema>;
    type LinkedDocumentSearchArgs = z.infer<typeof linkedDocumentSearchSchema>;
    type SessionDocumentsSearchArgs = z.infer<typeof sessionDocumentsSearchSchema>;

    return [
      {
        name: "search_projects_by_name",
        description: "Cerca progetti nel workspace per nome o parte del nome.",
        moduleKeys: [ModuleKey.PROJECT_MANAGEMENT],
        permissionKeys: [PermissionKey.PROJECTS_READ],
        parametersSchema: searchProjectsSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            projectName: { type: "string" },
          },
          required: ["projectName"],
        },
        execute: async (context, args: SearchProjectsArgs) => {
          const prisma = PrismaClientManager.getClient();
          const rows = await prisma.project.findMany({
            where: {
              workspace_id: context.workspaceId,
              deleted_at: null,
              name: {
                contains: args.projectName,
                mode: "insensitive",
              },
            },
            include: {
              status: { select: { key: true, label: true } },
              project_versions: {
                where: { deleted_at: null },
                select: { version_label: true, is_default: true },
                orderBy: { id: "asc" },
              },
            },
            take: 5,
            orderBy: { created_at: "desc" },
          });

          return {
            matches: rows.map((row) => ({
              projectId: row.id,
              projectName: row.name,
              statusKey: row.status.key,
              statusLabel: row.status.label,
              versions: row.project_versions.map((version) => ({
                versionLabel: version.version_label,
                isDefault: version.is_default,
              })),
            })),
          };
        },
      },
      {
        name: "get_project_summary",
        description: "Restituisce una sintesi strutturata del progetto e del suo stato.",
        moduleKeys: [ModuleKey.PROJECT_MANAGEMENT],
        permissionKeys: [PermissionKey.PROJECTS_READ],
        parametersSchema: projectVersionsSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
        execute: async (context, args: ProjectVersionsArgs) => {
          const project = await this.projectService.getProject(context.workspaceId, args.projectId);
          const versions = await this.projectService.listProjectVersions(context.workspaceId, args.projectId);
          return {
            projectId: project.id,
            projectName: project.name,
            statusKey: project.statusKey,
            clientId: project.clientId,
            versionsCount: project.versionsCount,
            versions: versions.map((version) => ({
              versionId: version.id,
              versionLabel: version.versionLabel,
              description: version.description,
              statusKey: version.statusKey,
              isDefault: version.isDefault,
              shipmentId: version.shipmentId,
              shipmentCode: version.shipmentCode,
              shipmentStatusKey: version.shipmentStatusKey,
            })),
          };
        },
      },
      {
        name: "list_project_versions",
        description: "Elenca tutte le versioni del progetto.",
        moduleKeys: [ModuleKey.PROJECT_MANAGEMENT],
        permissionKeys: [PermissionKey.PROJECTS_READ],
        parametersSchema: projectVersionsSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            projectId: { type: "string" },
          },
          required: ["projectId"],
        },
        execute: async (context, args: ProjectVersionsArgs) => {
          const versions = await this.projectService.listProjectVersions(context.workspaceId, args.projectId);
          return {
            versions: versions.map((version) => ({
              versionId: version.id,
              versionLabel: version.versionLabel,
              description: version.description,
              clientId: version.clientId,
              clientName: version.clientName,
              statusKey: version.statusKey,
              shipmentId: version.shipmentId,
              shipmentCode: version.shipmentCode,
              shipmentStatusKey: version.shipmentStatusKey,
              isDefault: version.isDefault,
              createdAt: version.createdAt.toISOString(),
            })),
          };
        },
      },
      {
        name: "get_project_version_shipment",
        description: "Recupera la spedizione associata a una specifica versione progetto.",
        moduleKeys: [ModuleKey.PROJECT_MANAGEMENT, ModuleKey.SHIPMENT_MANAGEMENT],
        permissionKeys: [PermissionKey.PROJECTS_READ, PermissionKey.SHIPMENTS_READ],
        parametersSchema: projectVersionSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            projectId: { type: "string" },
            versionLabel: { type: "string" },
          },
          required: ["projectId", "versionLabel"],
        },
        execute: async (context, args: ProjectVersionArgs) => {
          const versions = await this.projectService.listProjectVersions(context.workspaceId, args.projectId);
          const version = versions.find((item) => item.versionLabel.toLowerCase() === args.versionLabel.trim().toLowerCase());
          if (!version) {
            return { found: false, reason: "PROJECT_VERSION_NOT_FOUND" };
          }
          if (!version.shipmentId) {
            return { found: false, reason: "SHIPMENT_NOT_LINKED", versionId: version.id, versionLabel: version.versionLabel };
          }

          const shipment = await this.shipmentService.getShipment(context.workspaceId, version.shipmentId);
          return {
            found: true,
            shipment: {
              id: shipment.id,
              code: shipment.code,
              clientId: shipment.clientId,
              clientName: shipment.clientName,
              statusKey: shipment.statusKey,
              notes: shipment.notes,
              specificationUpdatedAt: shipment.specificationUpdatedAt?.toISOString() ?? null,
              createdAt: shipment.createdAt.toISOString(),
            },
          };
        },
      },
      {
        name: "get_project_version_quotation_context",
        description: "Legge il preventivo PDF della versione progetto, lo indicizza se necessario e restituisce contesto testuale utile.",
        moduleKeys: [ModuleKey.PROJECT_MANAGEMENT, ModuleKey.DOCUMENT_ARCHIVE, ModuleKey.DOCUMENT_INTELLIGENCE],
        permissionKeys: [PermissionKey.PROJECTS_READ, PermissionKey.DOCUMENTS_READ, PermissionKey.KNOWLEDGE_READ],
        parametersSchema: projectVersionSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            projectId: { type: "string" },
            versionLabel: { type: "string" },
          },
          required: ["projectId", "versionLabel"],
        },
        execute: async (context, args: ProjectVersionArgs) => {
          return this.documentIntelligenceService.getProjectVersionQuotationContext({
            workspaceId: context.workspaceId,
            projectId: args.projectId,
            versionLabel: args.versionLabel,
          });
        },
      },
      {
        name: "search_linked_document_knowledge",
        description: "Cerca informazioni solo nel documento collegato alla sessione chat corrente, senza allargare la ricerca al resto del workspace.",
        moduleKeys: [ModuleKey.CONVERSATIONAL_ASSISTANT, ModuleKey.DOCUMENT_INTELLIGENCE],
        permissionKeys: [PermissionKey.ASSISTANT_READ, PermissionKey.KNOWLEDGE_READ],
        parametersSchema: linkedDocumentSearchSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: "string" },
            topK: { type: "integer" },
          },
          required: ["query"],
        },
        execute: async (context, args: LinkedDocumentSearchArgs) => {
          const prisma = PrismaClientManager.getClient();
          const session = await prisma.assistantSession.findFirst({
            where: {
              id: context.sessionId,
              workspace_id: context.workspaceId,
              deleted_at: null,
            },
            select: {
              document_id: true,
              ddt_document_id: true,
            },
          });

          if (!session) {
            return { found: false, reason: "ASSISTANT_SESSION_NOT_FOUND" };
          }

          if (session.ddt_document_id) {
            await this.documentIntelligenceService.getDdtDocumentChatContext({
              workspaceId: context.workspaceId,
              ddtDocumentId: session.ddt_document_id,
            });

            const hits = await this.documentIntelligenceService.searchWorkspaceKnowledge({
              workspaceId: context.workspaceId,
              query: args.query,
              topK: args.topK,
              sourceEntityType: "DdtDocument",
              sourceEntityId: session.ddt_document_id,
            });

            return {
              found: true,
              scope: "ddt_document",
              sourceEntityType: "DdtDocument",
              sourceEntityId: session.ddt_document_id,
              hits: hits.map((hit) => ({
                chunkId: hit.chunkId,
                knowledgeDocumentId: hit.knowledgeDocumentId,
                documentId: hit.documentId,
                sourceEntityType: hit.sourceEntityType,
                sourceEntityId: hit.sourceEntityId,
                title: hit.title,
                sourceLabel: hit.sourceLabel,
                chunkIndex: hit.chunkIndex,
                contentText: hit.contentText,
                distance: hit.distance,
              })),
            };
          }

          if (session.document_id) {
            const documentContext = await this.documentIntelligenceService.getDocumentChatContext({
              workspaceId: context.workspaceId,
              documentId: session.document_id,
            });

            const hits = await this.documentIntelligenceService.searchWorkspaceKnowledge({
              workspaceId: context.workspaceId,
              query: args.query,
              topK: args.topK,
              sourceEntityType: documentContext.sourceEntityType,
              sourceEntityId: documentContext.sourceEntityId,
            });

            return {
              found: true,
              scope: "document",
              sourceEntityType: documentContext.sourceEntityType,
              sourceEntityId: documentContext.sourceEntityId,
              hits: hits.map((hit) => ({
                chunkId: hit.chunkId,
                knowledgeDocumentId: hit.knowledgeDocumentId,
                documentId: hit.documentId,
                sourceEntityType: hit.sourceEntityType,
                sourceEntityId: hit.sourceEntityId,
                title: hit.title,
                sourceLabel: hit.sourceLabel,
                chunkIndex: hit.chunkIndex,
                contentText: hit.contentText,
                distance: hit.distance,
              })),
            };
          }

          return {
            found: false,
            reason: "SESSION_DOCUMENT_NOT_LINKED",
          };
        },
      },
      {
        name: "search_session_documents_knowledge",
        description: "Cerca informazioni solo nei documenti allegati alla sessione assistente corrente.",
        moduleKeys: [ModuleKey.CONVERSATIONAL_ASSISTANT, ModuleKey.DOCUMENT_INTELLIGENCE],
        permissionKeys: [PermissionKey.ASSISTANT_READ, PermissionKey.KNOWLEDGE_READ],
        parametersSchema: sessionDocumentsSearchSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: "string" },
            topK: { type: "integer" },
          },
          required: ["query"],
        },
        execute: async (context, args: SessionDocumentsSearchArgs) => {
          const prisma = PrismaClientManager.getClient();
          const links = await prisma.assistantSessionDocument.findMany({
            where: {
              workspace_id: context.workspaceId,
              session_id: context.sessionId,
              deleted_at: null,
            },
            select: {
              id: true,
              document_id: true,
              display_name: true,
            },
            orderBy: {
              created_at: "asc",
            },
            take: 20,
          });

          if (links.length === 0) {
            return { found: false, reason: "SESSION_DOCUMENTS_EMPTY" };
          }

          const topK = Math.min(args.topK ?? 5, 10);
          const hits = [];
          for (const link of links) {
            const documentContext = await this.documentIntelligenceService.getDocumentChatContext({
              workspaceId: context.workspaceId,
              documentId: link.document_id,
            });
            const documentHits = await this.documentIntelligenceService.searchWorkspaceKnowledge({
              workspaceId: context.workspaceId,
              query: args.query,
              topK,
              sourceEntityType: documentContext.sourceEntityType,
              sourceEntityId: documentContext.sourceEntityId,
            });

            hits.push(...documentHits.map((hit) => ({
              sessionDocumentId: link.id,
              sessionDocumentName: link.display_name ?? documentContext.title,
              chunkId: hit.chunkId,
              knowledgeDocumentId: hit.knowledgeDocumentId,
              documentId: hit.documentId,
              sourceEntityType: hit.sourceEntityType,
              sourceEntityId: hit.sourceEntityId,
              title: hit.title,
              sourceLabel: hit.sourceLabel,
              chunkIndex: hit.chunkIndex,
              contentText: hit.contentText,
              distance: hit.distance,
            })));
          }

          hits.sort((left, right) => left.distance - right.distance);
          return {
            found: hits.length > 0,
            scope: "assistant_session_documents",
            documents: links.map((link) => ({
              sessionDocumentId: link.id,
              documentId: link.document_id,
              fileName: link.display_name,
            })),
            hits: hits.slice(0, topK),
          };
        },
      },
      {
        name: "search_workspace_knowledge",
        description: "Esegue una ricerca semantica sui contenuti documentali indicizzati del workspace.",
        moduleKeys: [ModuleKey.DOCUMENT_INTELLIGENCE],
        permissionKeys: [PermissionKey.KNOWLEDGE_READ],
        parametersSchema: semanticSearchSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: "string" },
            topK: { type: "integer" },
            sourceEntityType: { type: "string" },
            sourceEntityId: { type: "string" },
          },
          required: ["query"],
        },
        execute: async (context, args: SemanticSearchArgs) => {
          const hits = await this.documentIntelligenceService.searchWorkspaceKnowledge({
            workspaceId: context.workspaceId,
            query: args.query,
            topK: args.topK,
            sourceEntityType: args.sourceEntityType ?? null,
            sourceEntityId: args.sourceEntityId ?? null,
          });
          return {
            mode: "semantic",
            hits: hits.map((hit) => ({
              chunkId: hit.chunkId,
              knowledgeDocumentId: hit.knowledgeDocumentId,
              documentId: hit.documentId,
              sourceEntityType: hit.sourceEntityType,
              sourceEntityId: hit.sourceEntityId,
              title: hit.title,
              sourceLabel: hit.sourceLabel,
              chunkIndex: hit.chunkIndex,
              contentText: hit.contentText,
              distance: hit.distance,
            })),
          };
        },
      },
      {
        name: "search_workspace_knowledge_targeted",
        description: "Esegue una ricerca mirata (keyword/exact match) sui contenuti indicizzati; piu adatta a verifiche puntuali.",
        moduleKeys: [ModuleKey.DOCUMENT_INTELLIGENCE],
        permissionKeys: [PermissionKey.KNOWLEDGE_READ],
        parametersSchema: targetedSearchSchema,
        parametersJsonSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: "string" },
            topK: { type: "integer" },
            sourceEntityType: { type: "string" },
            sourceEntityId: { type: "string" },
          },
          required: ["query"],
        },
        execute: async (context, args: TargetedSearchArgs) => {
          const hits = await this.documentIntelligenceService.searchWorkspaceKnowledgeByKeyword({
            workspaceId: context.workspaceId,
            query: args.query,
            topK: args.topK,
            sourceEntityType: args.sourceEntityType ?? null,
            sourceEntityId: args.sourceEntityId ?? null,
          });
          return {
            mode: "targeted",
            hits: hits.map((hit) => ({
              chunkId: hit.chunkId,
              knowledgeDocumentId: hit.knowledgeDocumentId,
              documentId: hit.documentId,
              sourceEntityType: hit.sourceEntityType,
              sourceEntityId: hit.sourceEntityId,
              title: hit.title,
              sourceLabel: hit.sourceLabel,
              chunkIndex: hit.chunkIndex,
              contentText: hit.contentText,
              distance: hit.distance,
            })),
          };
        },
      },
    ];
  }
}
