import { Position, type Edge, type Node } from "@xyflow/react";
import {
  Bot,
  Braces,
  CheckCircle2,
  Clock,
  Database,
  FileOutput,
  FileSearch,
  FileSignature,
  FileText,
  Inbox,
  Mail,
  MessageCircle,
  PenLine,
  Send,
  Sparkles,
  Square,
  Type,
  Wrench,
} from "lucide-react";

import type { WorkflowAgent, WorkflowDetail, WorkflowEdgeDto, WorkflowNodeKind, WorkflowSummary, WorkflowTool } from "./types";

export type WorkflowScreen = "modules" | "canvas";
export type PaletteKind = "AGENT" | "TOOL";
export type FlowNodeType =
  | "input-text"
  | "input-file"
  | "input-knowledge"
  | "document-set-ai"
  | "ocr"
  | "llm"
  | "structure-data"
  | "generate-document"
  | "check-mailbox"
  | "quotation-docx"
  | "compose-email"
  | "send-email"
  | "send-telegram"
  | "send-whatsapp"
  | "schedule"
  | "output";

export type PaletteDragPayload = {
  kind: PaletteKind | "FLOW";
  id: string;
};

export type DraftNode = {
  clientId: string;
  id?: string;
  nodeKey: string;
  nodeKind: WorkflowNodeKind;
  label: string;
  positionX: number;
  positionY: number;
  moduleAgentId?: string | null;
  moduleToolId?: string | null;
  inputKind?: string | null;
  outputKind?: string | null;
  configuration: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  isEnabled: boolean;
  isRequired: boolean;
};

export type DraftEdge = {
  clientId: string;
  id?: string;
  sourceClientId: string;
  targetClientId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
  orderNo: number;
  isEnabled: boolean;
};

export type UploadedWorkflowFile = {
  fileName: string;
  contentType: string;
  fileBase64: string;
  sizeBytes: number;
};

export type Snapshot = {
  nodes: DraftNode[];
  edges: DraftEdge[];
};

export type CanvasNodeData = {
  nodeId: string;
  label: string;
  kind: WorkflowNodeKind;
  type: FlowNodeType;
  required: boolean;
  enabled: boolean;
  subtitle: string;
  paletteKind: PaletteKind | "INPUT" | "OUTPUT";
  configuration: Record<string, unknown>;
  hasInputSource: boolean;
  uploadedFileName?: string;
  onConfigChange?: (patch: Record<string, unknown>) => void;
  onFileChange?: (file: File) => void;
};

export type ModuleCard = {
  cardKey: string;
  moduleKey: string;
  title: string;
  description: string;
  workflow: WorkflowSummary | null;
  agentsCount: number;
  toolsCount: number;
  isPlayground: boolean;
};

export const PLAYGROUND_KEY = "workflow_playground";
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
export const MAX_WORKFLOW_UPLOAD_BYTES = 15 * 1024 * 1024;

export const moduleLabels: Record<string, string> = {
  project_management: "Preventivi",
  ddt_processing: "DDT",
  measure_report: "Measure Report",
  workflow_management: "Workflow",
  document_intelligence: "Document intelligence",
};

export const moduleDescriptions: Record<string, string> = {
  project_management: "OCR, strutturazione preventivo, generazione DOCX e invio.",
  ddt_processing: "OCR, analisi DDT e indicizzazione del risultato.",
  measure_report: "Analisi AI dei report misurazioni e persistenza righe fuori tolleranza.",
  workflow_management: "Area libera per provare combinazioni di agent e tool.",
  document_intelligence: "OCR, knowledge refresh e ricerca sui documenti indicizzati.",
};

export const nodeKindIcon: Record<WorkflowNodeKind, typeof Square> = {
  INPUT: Database,
  AGENT: Bot,
  TOOL: Wrench,
  OUTPUT: Square,
};

export const NODE_KIND_ICONS: Record<FlowNodeType, typeof Type> = {
  "input-text": Type,
  "input-file": FileText,
  "input-knowledge": Database,
  "document-set-ai": FileSearch,
  ocr: FileSearch,
  llm: Sparkles,
  "structure-data": Braces,
  "generate-document": FileOutput,
  "check-mailbox": Inbox,
  "quotation-docx": FileSignature,
  "send-email": Mail,
  "send-telegram": Send,
  "send-whatsapp": MessageCircle,
  schedule: Clock,
  "compose-email": PenLine,
  output: CheckCircle2,
};

export const NODE_KIND_LABELS: Record<FlowNodeType, string> = {
  "input-text": "Inserisci testo",
  "input-file": "Carica file",
  "input-knowledge": "Knowledge workspace",
  "document-set-ai": "Analizza documenti",
  ocr: "OCR PDF",
  llm: "Analizza con AI",
  "structure-data": "Struttura testo",
  "generate-document": "Genera documento",
  "check-mailbox": "Check Mailbox",
  "quotation-docx": "Genera preventivo",
  "send-email": "Invia email",
  "send-telegram": "Invia Telegram",
  "send-whatsapp": "Invia WhatsApp",
  schedule: "Pianifica",
  "compose-email": "Componi email",
  output: "Risultato",
};

export const TOOLBAR_ORDER: FlowNodeType[] = [
  "input-text",
  "input-file",
  "input-knowledge",
  "document-set-ai",
  "ocr",
  "llm",
  "structure-data",
  "generate-document",
  "quotation-docx",
  "send-email",
  "send-telegram",
  "send-whatsapp",
  "schedule",
  "compose-email",
  "output",
];

export const TOOLBAR_GROUPS: Array<{ title: string; items: FlowNodeType[] }> = [
  { title: "Input", items: ["input-text", "input-file"] },
  { title: "Output", items: ["output"] },
  { title: "Agent", items: ["llm", "structure-data", "compose-email"] },
  { title: "Tool", items: ["ocr", "document-set-ai", "generate-document", "quotation-docx"] },
  { title: "Resoconto", items: ["schedule", "send-email", "send-telegram", "send-whatsapp"] },
];

export const NODE_KIND_BORDER: Record<FlowNodeType, string> = {
  "input-text": "border-status-info-text",
  "input-file": "border-status-warn-text",
  "input-knowledge": "border-brand-accent",
  "document-set-ai": "border-brand-accent",
  ocr: "border-status-warn-text",
  llm: "border-status-success-text",
  "structure-data": "border-status-warn-text",
  "generate-document": "border-status-warn-text",
  "check-mailbox": "border-status-danger-text",
  "quotation-docx": "border-status-warn-text",
  "send-email": "border-status-danger-text",
  "send-telegram": "border-status-info-text",
  "send-whatsapp": "border-status-success-text",
  schedule: "border-status-info-text",
  "compose-email": "border-status-info-text",
  output: "border-brand-primary",
};

export const textareaClassName = "min-h-32 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary";

export function buildModuleCards(
  workflows: WorkflowSummary[],
  tools: WorkflowTool[],
  agents: WorkflowAgent[],
  enabledModuleKeys?: string[],
): ModuleCard[] {
  const visibleModuleKeys = enabledModuleKeys ? new Set(enabledModuleKeys) : null;
  const nonPlaygroundWorkflows = workflows.filter((workflow) => workflow.key !== PLAYGROUND_KEY);
  const moduleKeys = Array.from(new Set([
    ...nonPlaygroundWorkflows.map((workflow) => workflow.moduleKey),
    ...agents.map((agent) => agent.moduleKey),
    ...tools.map((tool) => tool.moduleKey),
  ])).filter((key) =>
    key !== "document_archive"
    && key !== "document_intelligence"
    && key !== "workflow_management"
    && (!visibleModuleKeys || visibleModuleKeys.has(key)),
  ).sort();

  return moduleKeys.map((moduleKey) => {
    const workflow = nonPlaygroundWorkflows.find((item) => item.moduleKey === moduleKey && item.isDefault)
      ?? nonPlaygroundWorkflows.find((item) => item.moduleKey === moduleKey)
      ?? null;
    return {
      cardKey: `module:${moduleKey}`,
      moduleKey,
      title: moduleLabels[moduleKey] ?? moduleKey.replace(/_/g, " "),
      description: moduleDescriptions[moduleKey] ?? "Workflow modulare configurabile.",
      workflow,
      agentsCount: agents.filter((agent) => agent.moduleKey === moduleKey).length,
      toolsCount: tools.filter((tool) => tool.moduleKey === moduleKey).length,
      isPlayground: false,
    };
  });
}

export function isLangChainTool(tool: WorkflowTool): boolean {
  return tool.handlerKey.startsWith("langchain_orchestrator.");
}

export function isAgentTool(tool: WorkflowTool): boolean {
  return tool.handlerKey === "langchain_orchestrator.structure_text" || tool.handlerKey === "langchain_orchestrator.compose_email";
}

export function isAdvancedLangChainTool(tool: WorkflowTool): boolean {
  return tool.handlerKey === "langchain_orchestrator.chat" || tool.handlerKey === "langchain_orchestrator.pipeline_execute";
}

export function isAiRequestFlowNodeType(kind: FlowNodeType): boolean {
  return kind === "llm" || kind === "structure-data" || kind === "compose-email" || kind === "document-set-ai";
}

export function currentPromptFromConfiguration(configuration: Record<string, unknown>): string {
  return firstPreviewString(configuration.currentPrompt, configuration.instructions, configuration.prompt, configuration.extra_instructions);
}

export function defaultPromptFromConfiguration(configuration: Record<string, unknown>): string {
  return firstPreviewString(configuration.defaultPrompt, configuration.default_prompt, configuration.originalPrompt);
}

export function normalizeAiPromptConfiguration(
  configuration: Record<string, unknown>,
  fallbackCurrentPrompt = "",
  fallbackDefaultPrompt = "",
): Record<string, unknown> {
  const currentPrompt = currentPromptFromConfiguration(configuration) || fallbackCurrentPrompt;
  const defaultPrompt = defaultPromptFromConfiguration(configuration) || fallbackDefaultPrompt || currentPrompt;
  return {
    ...configuration,
    ...(currentPrompt ? { instructions: currentPrompt, currentPrompt } : {}),
    ...(defaultPrompt ? { defaultPrompt } : {}),
  };
}

export function findToolForFlowNodeType(kind: FlowNodeType, tools: WorkflowTool[]): WorkflowTool | null {
  const handlerKey = flowNodeHandlerKey(kind);
  if (!handlerKey) {
    return null;
  }
  return tools.find((tool) => tool.handlerKey === handlerKey) ?? null;
}

export function flowNodeHandlerKey(kind: FlowNodeType): string | null {
  if (kind === "ocr") {
    return "ocr_engine.extract_text_from_pdf_storage";
  }
  if (kind === "input-knowledge") {
    return "document_intelligence.search_workspace_knowledge";
  }
  if (kind === "document-set-ai") {
    return "document_intelligence.analyze_document_set";
  }
  if (kind === "llm") {
    return "langchain_orchestrator.chat";
  }
  if (kind === "structure-data") {
    return "langchain_orchestrator.structure_text";
  }
  if (kind === "compose-email") {
    return "langchain_orchestrator.compose_email";
  }
  if (kind === "generate-document") {
    return "docx_engine.generate_document";
  }
  if (kind === "quotation-docx") {
    return "docx_engine.build_quotation_docx";
  }
  if (kind === "send-email") {
    return "mail_engine.send_email";
  }
  if (kind === "send-telegram") {
    return "messaging_engine.send_telegram";
  }
  if (kind === "send-whatsapp") {
    return "messaging_engine.send_whatsapp";
  }
  if (kind === "schedule") {
    return "workflow_scheduler.schedule_report_delivery";
  }
  return null;
}

export function inferFlowNodeType(node: DraftNode, tool: WorkflowTool | null): FlowNodeType {
  if (node.nodeKind === "OUTPUT") {
    return "output";
  }
  if (node.nodeKind === "INPUT") {
    return node.inputKind === "document" || node.inputKind === "file" ? "input-file" : "input-text";
  }
  if (tool?.handlerKey === "document_intelligence.search_workspace_knowledge") {
    return "input-knowledge";
  }
  if (tool?.handlerKey === "document_intelligence.analyze_document_set") {
    return "document-set-ai";
  }
  if (tool?.handlerKey === "ocr_engine.extract_text_from_pdf_storage") {
    return "ocr";
  }
  if (tool?.handlerKey === "langchain_orchestrator.chat" || node.nodeKind === "AGENT") {
    return "llm";
  }
  if (tool?.handlerKey === "langchain_orchestrator.structure_text") {
    return "structure-data";
  }
  if (tool?.handlerKey === "langchain_orchestrator.compose_email") {
    return "compose-email";
  }
  if (tool?.handlerKey === "docx_engine.generate_document") {
    return "generate-document";
  }
  if (tool?.handlerKey === "docx_engine.build_quotation_docx") {
    return "quotation-docx";
  }
  if (tool?.handlerKey === "mail_engine.send_email" || tool?.handlerKey === "mail_engine.send_quotation_email") {
    return "send-email";
  }
  if (tool?.handlerKey === "messaging_engine.send_telegram") {
    return "send-telegram";
  }
  if (tool?.handlerKey === "messaging_engine.send_whatsapp") {
    return "send-whatsapp";
  }
  if (tool?.handlerKey === "workflow_scheduler.schedule_report_delivery") {
    return "schedule";
  }
  return "llm";
}

export function toolIcon(tool: WorkflowTool) {
  if (tool.handlerKey.includes("telegram")) {
    return <Send className="h-4 w-4" />;
  }
  if (tool.handlerKey.includes("whatsapp")) {
    return <MessageCircle className="h-4 w-4" />;
  }
  if (tool.handlerKey.includes("schedule")) {
    return <Clock className="h-4 w-4" />;
  }
  if (tool.handlerKey.includes("mail")) {
    return <Mail className="h-4 w-4" />;
  }
  if (tool.handlerKey.includes("docx") || tool.handlerKey.includes("document")) {
    return <FileText className="h-4 w-4" />;
  }
  return <Wrench className="h-4 w-4" />;
}

export function toolSubtitle(tool: WorkflowTool): string {
  if (tool.handlerKey.includes("ocr")) {
    return "OCR";
  }
  if (tool.handlerKey.includes("mail")) {
    return "Email";
  }
  if (tool.handlerKey.includes("telegram")) {
    return "Telegram";
  }
  if (tool.handlerKey.includes("whatsapp")) {
    return "WhatsApp";
  }
  if (tool.handlerKey.includes("schedule")) {
    return "Scheduler";
  }
  if (tool.handlerKey.includes("docx") || tool.handlerKey.includes("document")) {
    return "Documento";
  }
  if (tool.handlerKey.includes("knowledge")) {
    return "Knowledge";
  }
  return "Tool";
}

export function cleanWorkflowLabel(label: string): string {
  return label
    .replace(/\bMeasure Report\s+/gi, "")
    .replace(/\breport misurazioni\b/gi, "misurazioni")
    .replace(/\bpreventivo\b/gi, "")
    .replace(/\bDDT\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.:;])/g, "$1")
    .trim()
    .replace(/^OCR$/i, "OCR")
    .replace(/^Prompt\s+$/i, "Prompt");
}

export function baseInputNode(positionX: number, positionY: number) {
  return {
    nodeKey: "input",
    nodeKind: "INPUT" as const,
    label: "Input",
    positionX,
    positionY,
    inputKind: "json",
    configuration: {},
    isEnabled: true,
    isRequired: true,
  };
}

export function baseOutputNode(positionX: number, positionY: number) {
  return {
    nodeKey: "output",
    nodeKind: "OUTPUT" as const,
    label: "Output",
    positionX,
    positionY,
    outputKind: "generic_result",
    configuration: {},
    isEnabled: true,
    isRequired: true,
  };
}

export function toDraftNode(item: WorkflowDetail["nodes"][number]): DraftNode {
  return {
    clientId: item.id,
    id: item.id,
    nodeKey: item.nodeKey,
    nodeKind: item.nodeKind,
    label: item.label,
    positionX: item.positionX,
    positionY: item.positionY,
    moduleAgentId: item.moduleAgentId,
    moduleToolId: item.moduleToolId,
    inputKind: item.inputKind,
    outputKind: item.outputKind,
    configuration: toRecord(item.configuration),
    inputSchema: toRecordOrNull(item.inputSchema),
    outputSchema: toRecordOrNull(item.outputSchema),
    isEnabled: item.isEnabled,
    isRequired: item.isRequired,
  };
}

export function toDraftEdge(item: WorkflowEdgeDto, idToClientId: Map<string, string>): DraftEdge {
  return {
    clientId: item.id,
    id: item.id,
    sourceClientId: idToClientId.get(item.sourceNodeId) ?? item.sourceNodeId,
    targetClientId: idToClientId.get(item.targetNodeId) ?? item.targetNodeId,
    sourceHandle: item.sourceHandle,
    targetHandle: item.targetHandle,
    label: item.label,
    orderNo: item.orderNo,
    isEnabled: item.isEnabled,
  };
}

export function toFlowNode(
  item: DraftNode,
  tools: Map<string, WorkflowTool>,
  agents: Map<string, WorkflowAgent>,
  uploadedFiles: Record<string, UploadedWorkflowFile>,
  hasInputSource: boolean,
  onConfigChange: (clientId: string, patch: Record<string, unknown>) => void,
  onFileChange: (clientId: string, file: File) => void,
): Node<CanvasNodeData> {
  const tool = item.moduleToolId ? tools.get(item.moduleToolId) ?? null : null;
  const agent = item.moduleAgentId ? agents.get(item.moduleAgentId) ?? null : null;
  const paletteKind = item.nodeKind === "AGENT" || (tool && isLangChainTool(tool)) ? "AGENT" : item.nodeKind === "TOOL" ? "TOOL" : item.nodeKind;
  const flowType = inferFlowNodeType(item, tool);

  return {
    id: item.clientId,
    type: "workflowNode",
    position: { x: item.positionX, y: item.positionY },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      nodeId: item.clientId,
      label: cleanWorkflowLabel(item.label),
      kind: item.nodeKind,
      type: flowType,
      required: item.isRequired,
      enabled: item.isEnabled,
      subtitle: agent ? "Prompt" : tool ? toolSubtitle(tool) : item.inputKind ?? item.outputKind ?? item.nodeKind,
      paletteKind,
      configuration: item.configuration,
      hasInputSource,
      uploadedFileName: uploadedFiles[item.clientId]?.fileName,
      onConfigChange: (patch) => onConfigChange(item.clientId, patch),
      onFileChange: (file) => onFileChange(item.clientId, file),
    },
  };
}

export function toFlowEdge(item: DraftEdge): Edge {
  return {
    id: item.clientId,
    source: item.sourceClientId,
    target: item.targetClientId,
    sourceHandle: item.sourceHandle ?? undefined,
    targetHandle: item.targetHandle ?? undefined,
    label: item.label ?? undefined,
    animated: item.isEnabled,
    hidden: !item.isEnabled,
  };
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  const record = toRecord(value);
  return Object.keys(record).length > 0 ? record : null;
}

export function uniqueNodeKey(nodes: DraftNode[], base: string): string {
  const normalizedBase = sanitizeNodeKey(base) || "node";
  const existing = new Set(nodes.map((node) => node.nodeKey));
  if (!existing.has(normalizedBase)) {
    return normalizedBase;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalizedBase}_${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `${normalizedBase}_${Date.now()}`;
}

export function sanitizeNodeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

export function parsePaletteDragPayload(value: string): PaletteDragPayload | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<PaletteDragPayload>;
    if ((parsed.kind === "AGENT" || parsed.kind === "TOOL" || parsed.kind === "FLOW") && typeof parsed.id === "string") {
      return { kind: parsed.kind, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}

export function flowNodeDescription(kind: FlowNodeType): string {
  if (kind === "input-text") {
    return "Testo o istruzioni iniziali per il workflow.";
  }
  if (kind === "input-file") {
    return "Documento PDF o immagine da elaborare.";
  }
  if (kind === "input-knowledge") {
    return "Ricerca contenuti indicizzati nel workspace.";
  }
  if (kind === "document-set-ai") {
    return "Riassume o interroga documenti gia' caricati.";
  }
  if (kind === "ocr") {
    return "Estrae testo da documenti caricati.";
  }
  if (kind === "llm") {
    return "Esegue una richiesta tramite modello locale.";
  }
  if (kind === "structure-data") {
    return "Trasforma testo in dati strutturati.";
  }
  if (kind === "compose-email") {
    return "Prepara una bozza email professionale.";
  }
  if (kind === "generate-document") {
    return "Crea un documento dalla configurazione.";
  }
  if (kind === "quotation-docx") {
    return "Genera un DOCX offerta.";
  }
  if (kind === "check-mailbox") {
    return "Legge una casella email configurata.";
  }
  if (kind === "send-email") {
    return "Invia email e allegati.";
  }
  if (kind === "send-telegram") {
    return "Invia un messaggio Telegram.";
  }
  if (kind === "send-whatsapp") {
    return "Invia un messaggio WhatsApp Business.";
  }
  if (kind === "schedule") {
    return "Pianifica l'invio dei nodi Resoconto collegati.";
  }
  return "Raccoglie il risultato finale.";
}

export function parseRunInput(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Input run deve essere un oggetto JSON.");
  }
  return parsed as Record<string, unknown>;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Lettura file non riuscita."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
    };
    reader.readAsDataURL(file);
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "run corrente";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatPayload(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatResultPreview(value: unknown): string {
  if (value === undefined || value === null) {
    return "Nessun output";
  }
  if (typeof value === "string") {
    return value.trim() || "Nessun output";
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return String(value);
  }

  const record = value as Record<string, unknown>;
  const output = toRecord(record.output);
  const candidate = firstPreviewString(
    record.reply,
    record.text,
    record.subject,
    record.raw_output,
    record.extracted_text,
    record.error,
    output.reply,
    output.text,
    output.subject,
    output.raw_output,
    output.extracted_text,
  );
  if (candidate) {
    return candidate;
  }

  const structured = record.structured_data ?? output.structured_data;
  if (structured && typeof structured === "object") {
    return "Dati strutturati generati";
  }
  const rawResponse = record.raw_response ?? output.raw_response;
  if (rawResponse && typeof rawResponse === "object") {
    return "Risposta AI ricevuta";
  }
  const keys = Object.keys(record).filter((key) => key !== "raw_response").slice(0, 5);
  return keys.length > 0 ? `Output: ${keys.join(", ")}` : "Output disponibile";
}

export function firstPreviewString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
