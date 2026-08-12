import { PrismaClientManager } from "../../../database/PrismaClientManager.js";
import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { ModuleAgentService } from "../../agents/services/ModuleAgentService.js";
import { DdtAnalysisInput } from "../repositories/DdtProcessingRepository.js";
import { DdtAnalyzer } from "./DdtAnalyzer.js";
import { LocalLmOrchestrator } from "../../orchestration/services/LocalLmOrchestrator.js";

interface WorkflowResponseItem {
  article_type?: unknown;
  quantity?: unknown;
  unit?: unknown;
}

interface WorkflowResponsePayload {
  movement_type?: unknown;
  movement_scope?: unknown;
  main_warehouse_action?: unknown;
  bolla_number?: unknown;
  commessa_reference?: unknown;
  transfer_note?: unknown;
  article_count?: unknown;
  analysis_summary?: unknown;
  article_items?: WorkflowResponseItem[];
  raw_response?: Record<string, unknown>;
}

export class NextOrchestratorDdtAnalyzer implements DdtAnalyzer {
  public static readonly DDT_PROMPT_AGENT_KEY = "ddt_analysis_prompt";

  private readonly moduleAgentService: ModuleAgentService;
  private readonly orchestrator: LocalLmOrchestrator;

  public constructor(moduleAgentService: ModuleAgentService, orchestrator?: LocalLmOrchestrator) {
    this.moduleAgentService = moduleAgentService;
    this.orchestrator = orchestrator ?? new LocalLmOrchestrator();
  }

  public async analyze(ddtDocumentId: string): Promise<DdtAnalysisInput> {
    const row = await this.loadDdtDocument(ddtDocumentId);
    const systemPrompt = await this.moduleAgentService.resolveActivePrompt({
      workspaceId: row.workspace_id,
      moduleKey: ModuleKey.DDT_PROCESSING,
      agentKey: NextOrchestratorDdtAnalyzer.DDT_PROMPT_AGENT_KEY,
    });
    const workflow = await this.orchestrator.analyzeFromStorage({
      storagePath: row.storage_path,
      fileName: row.original_filename ?? row.filename ?? "document.pdf",
      systemPrompt: systemPrompt ?? undefined,
    });

    return this.normalizeResponse(workflow, ddtDocumentId);
  }

  private async loadDdtDocument(ddtDocumentId: string): Promise<{
    workspace_id: string;
    filename: string | null;
    original_filename: string | null;
    storage_path: string;
  }> {
    const prisma = PrismaClientManager.getClient();
    const row = await prisma.ddtDocument.findUnique({
      where: { id: ddtDocumentId },
      select: {
        workspace_id: true,
        original_filename: true,
        document: {
          select: {
            filename: true,
            storage_path: true,
          },
        },
      },
    });

    if (!row?.document?.storage_path) {
      throw new Error(`Documento DDT ${ddtDocumentId} non trovato o senza storage_path.`);
    }

    return {
      workspace_id: row.workspace_id,
      filename: row.document.filename,
      original_filename: row.original_filename,
      storage_path: row.document.storage_path,
    };
  }

  private normalizeResponse(payload: WorkflowResponsePayload, ddtDocumentId: string): DdtAnalysisInput {
    const articleItems = Array.isArray(payload.article_items)
      ? payload.article_items.map((item) => ({
          articleType: this.toStringOrDefault(item.article_type, "sconosciuto"),
          quantity: this.toNumber(item.quantity),
          unit: this.toStringOrDefault(item.unit, "N/D"),
        }))
      : [];

    return {
      movementType: this.toNullableString(payload.movement_type),
      movementScope: this.toNullableString(payload.movement_scope),
      mainWarehouseAction: this.toNullableString(payload.main_warehouse_action),
      bollaNumber: this.toNullableString(payload.bolla_number),
      commessaReference: this.toNullableString(payload.commessa_reference),
      transferNote: this.toNullableString(payload.transfer_note),
      articleCount: Number.isFinite(Number(payload.article_count)) ? Number(payload.article_count) : articleItems.length,
      warehouseDelta: this.computeWarehouseDelta(this.toNullableString(payload.main_warehouse_action), this.toNumber(payload.article_count)),
      summary: this.toNullableString(payload.analysis_summary),
      rawResponse: {
        provider: "next-orchestrator",
        documentId: ddtDocumentId,
        response: payload.raw_response ?? null,
      },
      articleItems,
    };
  }

  private computeWarehouseDelta(mainAction: string | null, articleCount: number): number {
    if (mainAction === "aggiunta_principale") {
      return articleCount;
    }
    if (mainAction === "rimozione_principale") {
      return -articleCount;
    }
    return 0;
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toStringOrDefault(value: unknown, fallback: string): string {
    const normalized = this.toNullableString(value);
    return normalized ?? fallback;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
