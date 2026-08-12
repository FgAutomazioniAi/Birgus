import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { ModuleAgentService } from "../../agents/services/ModuleAgentService.js";
import { QuotationAnalysisResult, QuotationStructuredData, QUOTATION_FIELD_KEYS } from "../domain/QuotationStructuredData.js";
import { LocalLmOrchestrator } from "../../orchestration/services/LocalLmOrchestrator.js";

interface WorkflowResponsePayload {
  structured_data?: Record<string, unknown>;
  raw_response?: Record<string, unknown>;
}

export class NextOrchestratorQuotationAnalyzer {
  public static readonly QUOTATION_PROMPT_AGENT_KEY = "quotation_structuring_prompt";

  private readonly moduleAgentService: ModuleAgentService;
  private readonly orchestrator: LocalLmOrchestrator;

  public constructor(moduleAgentService: ModuleAgentService, orchestrator?: LocalLmOrchestrator) {
    this.moduleAgentService = moduleAgentService;
    this.orchestrator = orchestrator ?? new LocalLmOrchestrator();
  }

  public async analyze(params: {
    workspaceId: string;
    projectId: string;
    storagePath: string;
    fileName: string;
  }): Promise<QuotationAnalysisResult> {
    const systemPrompt = await this.moduleAgentService.resolveActivePrompt({
      workspaceId: params.workspaceId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      agentKey: NextOrchestratorQuotationAnalyzer.QUOTATION_PROMPT_AGENT_KEY,
    });

    const payload = await this.orchestrator.analyzeQuotationFromStorage({
      storagePath: params.storagePath,
      fileName: params.fileName,
      systemPrompt: systemPrompt ?? undefined,
    });

    return {
      structuredData: this.normalizeStructuredData(payload.structured_data ?? {}),
      rawResponse: payload.raw_response ?? {},
    };
  }

  private normalizeStructuredData(input: Record<string, unknown>): QuotationStructuredData {
    return Object.fromEntries(
      QUOTATION_FIELD_KEYS.map((key) => [key, this.toNullableString(input[key])]),
    ) as QuotationStructuredData;
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
