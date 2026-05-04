export interface ModuleActionExecuteRequest {
  kind: "module_action";
  module: string;
  action: string;
  input: Record<string, unknown>;
}

export interface WorkflowExecuteRequest {
  kind: "workflow";
  workflow: "ddt_analysis_from_storage";
  input: {
    storagePath: string;
    fileName: string;
    maxPages?: number;
  };
}

export type OrchestratorExecuteRequest = ModuleActionExecuteRequest | WorkflowExecuteRequest;

export interface PythonModulesExecuteResult {
  ok: boolean;
  module: string;
  action: string;
  output: Record<string, unknown>;
}

export interface DdtWorkflowResult {
  movement_type: string;
  movement_scope: string;
  main_warehouse_action: string;
  bolla_number: string;
  commessa_reference: string;
  transfer_note: string;
  article_count: number;
  article_items: Array<{ article_type: string; quantity: number; unit: string }>;
  analysis_summary: string;
  raw_response: Record<string, unknown>;
}
