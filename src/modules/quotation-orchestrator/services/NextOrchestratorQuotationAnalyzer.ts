import { ModuleKey } from "../../../core/module-access/ModuleKey.js";
import { ProjectAgentService } from "../../agents/services/ProjectAgentService.js";
import { QuotationAnalysisResult, QuotationStructuredData, QUOTATION_FIELD_KEYS } from "../domain/QuotationStructuredData.js";

interface WorkflowResponsePayload {
  structured_data?: Record<string, unknown>;
  raw_response?: Record<string, unknown>;
}

export class NextOrchestratorQuotationAnalyzer {
  public static readonly QUOTATION_PROMPT_AGENT_KEY = "quotation_structuring_prompt";

  private readonly baseUrl: string;
  private readonly executePath: string;
  private readonly timeoutMs: number;
  private readonly token: string;
  private readonly projectAgentService: ProjectAgentService;

  public constructor(projectAgentService: ProjectAgentService) {
    this.projectAgentService = projectAgentService;
    this.baseUrl = (process.env.NEXT_ORCHESTRATOR_BASE_URL ?? process.env.DDT_READER_ORCHESTRATOR_BASE_URL ?? "").replace(/\/+$/, "");
    this.executePath = this.normalizePath(
      process.env.NEXT_ORCHESTRATOR_EXECUTE_PATH
        ?? process.env.DDT_READER_ORCHESTRATOR_EXECUTE_PATH
        ?? "/api/orchestrator/modules/execute",
    );
    this.timeoutMs = this.toPositiveInt(
      process.env.NEXT_ORCHESTRATOR_TIMEOUT_MS ?? process.env.DDT_READER_ORCHESTRATOR_TIMEOUT_MS,
      600000,
    );
    this.token = (process.env.ORCHESTRATOR_INTERNAL_TOKEN ?? "").trim();
  }

  public async analyze(params: {
    workspaceId: string;
    projectId: string;
    storagePath: string;
    fileName: string;
  }): Promise<QuotationAnalysisResult> {
    if (!this.baseUrl) {
      throw new Error("NEXT_ORCHESTRATOR_BASE_URL mancante.");
    }

    const systemPrompt = await this.projectAgentService.resolveActivePrompt({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      moduleKey: ModuleKey.PROJECT_MANAGEMENT,
      agentKey: NextOrchestratorQuotationAnalyzer.QUOTATION_PROMPT_AGENT_KEY,
    });

    const payload = await this.callWorkflow({
      storagePath: params.storagePath,
      fileName: params.fileName,
      systemPrompt,
    });

    return {
      structuredData: this.normalizeStructuredData(payload.structured_data ?? {}),
      rawResponse: payload.raw_response ?? {},
    };
  }

  private async callWorkflow(input: {
    storagePath: string;
    fileName: string;
    systemPrompt?: string | null;
  }): Promise<WorkflowResponsePayload> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.token) {
      headers["x-orchestrator-token"] = this.token;
    }

    const response = await fetch(`${this.baseUrl}${this.executePath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: "workflow",
        workflow: "quotation_analysis_from_storage",
        input: {
          storagePath: input.storagePath,
          fileName: input.fileName,
          systemPrompt: input.systemPrompt ?? undefined,
        },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const message = typeof payload.message === "string" ? payload.message : `Orchestrator HTTP ${response.status}`;
      throw new Error(message);
    }

    return (await response.json().catch(() => ({}))) as WorkflowResponsePayload;
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

  private normalizePath(path: string): string {
    return path.startsWith("/") ? path : `/${path}`;
  }

  private toPositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
