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
  ShieldCheck,
  UserRoundCheck,
  Send,
  Sparkles,
  Square,
  Type,
  Wrench,
} from "lucide-react";

import type { UiLanguage } from "@/lib/language";

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
  | "format-text-ai"
  | "format-text-template"
  | "verify-route"
  | "human-review"
  | "request-decision"
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
  conditionPayload?: Record<string, unknown> | null;
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
  paletteKind: PaletteKind | "INPUT" | "OUTPUT" | "REPORT" | "BRAINYWARE";
  configuration: Record<string, unknown>;
  incomingTargetHandles: string[];
  incomingFieldLabels: Record<string, string>;
  uploadedFileName?: string;
  onConfigChange?: (patch: Record<string, unknown>) => void;
  onFileChange?: (file: File) => void;
  onOutputPreview?: () => void;
};

export type ModuleCard = {
  cardKey: string;
  moduleKey: string;
  title: string;
  description: string;
  workflow: WorkflowSummary | null;
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

const moduleLabelsEn: Record<string, string> = {
  project_management: "Quotations",
  ddt_processing: "DDT",
  measure_report: "Measure report",
  workflow_management: "Workflows",
  document_intelligence: "Document intelligence",
};

const moduleDescriptionsEn: Record<string, string> = {
  project_management: "OCR, quotation structuring, document generation, and delivery.",
  ddt_processing: "OCR, DDT analysis, and result indexing.",
  measure_report: "AI analysis of measurement reports and persistence of out-of-tolerance rows.",
  workflow_management: "A free area to test agent and tool combinations.",
  document_intelligence: "OCR, knowledge refresh, and search across indexed documents.",
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
  "quotation-docx": FileSignature,
  "check-mailbox": Inbox,
  "send-email": Mail,
  "send-telegram": Send,
  "send-whatsapp": MessageCircle,
  schedule: Clock,
  "compose-email": PenLine,
  "format-text-ai": PenLine,
  "format-text-template": FileText,
  "verify-route": ShieldCheck,
  "human-review": UserRoundCheck,
  "request-decision": UserRoundCheck,
  output: CheckCircle2,
};

export const NODE_KIND_LABELS: Record<FlowNodeType, string> = {
  "input-text": "Inserisci testo",
  "input-file": "Carica file",
  "input-knowledge": "Knowledge workspace",
  "document-set-ai": "Analizza documenti",
  ocr: "Text Recognition",
  llm: "Analizza con AI",
  "structure-data": "Struttura testo",
  "generate-document": "Genera documento",
  "quotation-docx": "Genera preventivo",
  "check-mailbox": "Controlla casella email",
  "send-email": "Invia email",
  "send-telegram": "Invia Telegram",
  "send-whatsapp": "Invia WhatsApp",
  schedule: "Pianifica",
  "compose-email": "Formatta email",
  "format-text-ai": "Formatta con AI",
  "format-text-template": "Applica template",
  "verify-route": "Verifica e instrada",
  "human-review": "Crea revisione umana",
  "request-decision": "Richiedi decisione",
  output: "Risultato",
};

const NODE_KIND_LABELS_EN: Record<FlowNodeType, string> = {
  "input-text": "Enter text",
  "input-file": "Upload file",
  "input-knowledge": "Workspace knowledge",
  "document-set-ai": "Analyze documents",
  ocr: "Text recognition",
  llm: "Analyze with AI",
  "structure-data": "Structure text",
  "generate-document": "Generate document",
  "quotation-docx": "Generate quotation",
  "check-mailbox": "Check mailbox",
  "send-email": "Send email",
  "send-telegram": "Send Telegram",
  "send-whatsapp": "Send WhatsApp",
  schedule: "Schedule",
  "compose-email": "Format email",
  "format-text-ai": "Format with AI",
  "format-text-template": "Apply template",
  "verify-route": "Verify and route",
  "human-review": "Create human review",
  "request-decision": "Request decision",
  output: "Result",
};

const NODE_KIND_DESCRIPTIONS: Record<FlowNodeType, Record<UiLanguage, string>> = {
  "input-text": { it: "Inserisce testo manuale nel flusso.", en: "Adds manual text to the flow." },
  "input-file": { it: "Carica un file da usare nel flusso.", en: "Uploads a file for the flow." },
  "input-knowledge": { it: "Cerca nella knowledge del workspace.", en: "Searches workspace knowledge." },
  "document-set-ai": { it: "Analizza uno o più documenti selezionati.", en: "Analyzes one or more selected documents." },
  ocr: { it: "Estrae testo da documenti e immagini.", en: "Extracts text from documents and images." },
  llm: { it: "Genera una risposta con l'agente AI.", en: "Generates an answer with the AI agent." },
  "structure-data": { it: "Trasforma il testo in dati strutturati.", en: "Transforms text into structured data." },
  "generate-document": { it: "Crea un documento scaricabile.", en: "Creates a downloadable document." },
  "quotation-docx": { it: "Genera un preventivo in formato documento.", en: "Generates a quotation document." },
  "check-mailbox": { it: "Legge nuovi messaggi dalla casella email.", en: "Reads new messages from the mailbox." },
  "send-email": { it: "Invia un messaggio email.", en: "Sends an email message." },
  "send-telegram": { it: "Invia un messaggio Telegram.", en: "Sends a Telegram message." },
  "send-whatsapp": { it: "Invia un messaggio WhatsApp.", en: "Sends a WhatsApp message." },
  schedule: { it: "Avvia un invio programmato.", en: "Starts a scheduled delivery." },
  "compose-email": { it: "Prepara una bozza email con AI senza inviarla.", en: "Prepares an AI email draft without sending it." },
  "format-text-ai": { it: "Riformatta un contenuto seguendo un template documento con AI.", en: "Reformats content with AI following a document template." },
  "format-text-template": { it: "Applica placeholder di un template documento senza usare AI.", en: "Applies document-template placeholders without AI." },
  "verify-route": { it: "Controlla dati con regole deterministiche e segnala le violazioni.", en: "Checks data with deterministic rules and reports violations." },
  "human-review": { it: "Crea una richiesta persistente di attenzione nel workspace.", en: "Creates a persistent workspace attention request." },
  "request-decision": { it: "Mette la run in attesa finche una persona decide.", en: "Pauses the run until a person decides." },
  output: { it: "Mostra il risultato ricevuto.", en: "Shows the received result." },
};

export function flowNodeLabel(kind: FlowNodeType, language: UiLanguage): string {
  return language === "en" ? NODE_KIND_LABELS_EN[kind] : NODE_KIND_LABELS[kind];
}

export function localizedFlowNodeLabel(label: string, kind: FlowNodeType, language: UiLanguage): string {
  return label === NODE_KIND_LABELS[kind] || label === NODE_KIND_LABELS_EN[kind] ? flowNodeLabel(kind, language) : label;
}

export const TOOLBAR_ORDER: FlowNodeType[] = [
  "input-text",
  "input-file",
  "input-knowledge",
  "document-set-ai",
  "ocr",
  "llm",
  "structure-data",
  "generate-document",
  "send-email",
  "send-telegram",
  "send-whatsapp",
  "schedule",
  "compose-email",
  "verify-route",
  "human-review",
  "request-decision",
  "output",
];

export const TOOLBAR_GROUPS: Array<{ id: string; title: string; titleEn: string; category: CanvasNodeData["paletteKind"]; items: FlowNodeType[] }> = [
  { id: "input", title: "Input", titleEn: "Input", category: "INPUT", items: ["input-text", "input-file"] },
  { id: "output", title: "Output", titleEn: "Output", category: "OUTPUT", items: ["output"] },
  { id: "agents", title: "Agenti", titleEn: "Agents", category: "AGENT", items: ["llm", "structure-data", "compose-email", "format-text-ai"] },
  { id: "tools", title: "Strumenti", titleEn: "Tools", category: "TOOL", items: ["ocr", "document-set-ai", "generate-document", "format-text-template", "verify-route", "request-decision"] },
  { id: "report", title: "Resoconto", titleEn: "Report", category: "REPORT", items: ["schedule", "send-email", "send-telegram", "send-whatsapp"] },
  { id: "brainyware", title: "Brainyware", titleEn: "Brainyware", category: "BRAINYWARE", items: [] },
];

export const NODE_CATEGORY_BORDER: Record<CanvasNodeData["paletteKind"], string> = {
  INPUT: "border-status-info-text",
  AGENT: "border-status-progress-text",
  TOOL: "border-status-warn-text",
  OUTPUT: "border-status-success-text",
  REPORT: "border-status-danger-text",
  BRAINYWARE: "border-fuchsia-500",
};

export const NODE_CATEGORY_TAB_ACTIVE: Record<CanvasNodeData["paletteKind"], string> = {
  INPUT: "border-status-info-text bg-status-info-bg text-status-info-text",
  OUTPUT: "border-status-success-text bg-status-success-bg text-status-success-text",
  AGENT: "border-status-progress-text bg-status-progress-bg text-status-progress-text",
  TOOL: "border-status-warn-text bg-status-warn-bg text-status-warn-text",
  REPORT: "border-status-danger-text bg-status-danger-bg text-status-danger-text",
  BRAINYWARE: "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
};

export const NODE_CATEGORY_BADGE_TONE: Record<CanvasNodeData["paletteKind"], "info" | "success" | "warn" | "progress" | "danger"> = {
  INPUT: "info",
  OUTPUT: "success",
  AGENT: "progress",
  TOOL: "warn",
  REPORT: "danger",
  BRAINYWARE: "progress",
};

export const textareaClassName = "min-h-32 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary";

export function buildModuleCards(
  workflows: WorkflowSummary[],
  tools: WorkflowTool[],
  agents: WorkflowAgent[],
  enabledModuleKeys?: string[],
  language: UiLanguage = "it",
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
      title: (language === "en" ? moduleLabelsEn : moduleLabels)[moduleKey] ?? moduleKey.replace(/_/g, " "),
      description: (language === "en" ? moduleDescriptionsEn : moduleDescriptions)[moduleKey]
        ?? (language === "en" ? "Configurable modular workflow." : "Workflow modulare configurabile."),
      workflow,
      isPlayground: false,
    };
  });
}

export function isLangChainTool(tool: WorkflowTool): boolean {
  return tool.handlerKey.startsWith("langchain_orchestrator.");
}

export function isAgentTool(tool: WorkflowTool): boolean {
  return tool.handlerKey === "langchain_orchestrator.structure_text" || tool.handlerKey === "langchain_orchestrator.compose_email" || tool.handlerKey === "langchain_orchestrator.format_text";
}

export function isAdvancedLangChainTool(tool: WorkflowTool): boolean {
  return tool.handlerKey === "langchain_orchestrator.chat" || tool.handlerKey === "langchain_orchestrator.pipeline_execute";
}

export function isAiRequestFlowNodeType(kind: FlowNodeType): boolean {
  return kind === "llm" || kind === "structure-data" || kind === "compose-email" || kind === "format-text-ai" || kind === "document-set-ai";
}

export function currentPromptFromConfiguration(configuration: Record<string, unknown>): string {
  return firstConfiguredString(configuration.currentPrompt, configuration.instructions, configuration.prompt, configuration.extra_instructions);
}

export function defaultPromptFromConfiguration(configuration: Record<string, unknown>): string {
  return firstConfiguredString(configuration.defaultPrompt, configuration.default_prompt, configuration.originalPrompt);
}

function firstConfiguredString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
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
  if (kind === "format-text-ai") {
    return "langchain_orchestrator.format_text";
  }
  if (kind === "format-text-template") {
    return "workflow_text.format_template";
  }
  if (kind === "verify-route") {
    return "workflow_logic.verify_and_route";
  }
  if (kind === "human-review") {
    return "workflow_attention.create_human_review";
  }
  if (kind === "request-decision") {
    return "workflow_attention.request_decision";
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
  if (tool?.handlerKey === "langchain_orchestrator.chat") {
    return "llm";
  }
  if (tool?.handlerKey === "langchain_orchestrator.structure_text") {
    return "structure-data";
  }
  if (tool?.handlerKey === "langchain_orchestrator.compose_email") {
    return "compose-email";
  }
  if (tool?.handlerKey === "langchain_orchestrator.format_text") {
    return "format-text-ai";
  }
  if (node.nodeKind === "AGENT") {
    return "llm";
  }
  if (tool?.handlerKey === "workflow_text.format_template") {
    return "format-text-template";
  }
  if (tool?.handlerKey === "workflow_logic.verify_and_route") {
    return "verify-route";
  }
  if (tool?.handlerKey === "workflow_attention.create_human_review") {
    return "human-review";
  }
  if (tool?.handlerKey === "workflow_attention.request_decision") {
    return "request-decision";
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
    conditionPayload: toRecordOrNull(item.conditionPayload),
    orderNo: item.orderNo,
    isEnabled: item.isEnabled,
  };
}

export function toFlowNode(
  item: DraftNode,
  tools: Map<string, WorkflowTool>,
  agents: Map<string, WorkflowAgent>,
  uploadedFiles: Record<string, UploadedWorkflowFile>,
  incomingTargetHandles: string[],
  incomingFieldLabels: Record<string, string>,
  onConfigChange: (clientId: string, patch: Record<string, unknown>) => void,
  onFileChange: (clientId: string, file: File) => void,
  onOutputPreview: (clientId: string) => void,
): Node<CanvasNodeData> {
  const tool = item.moduleToolId ? tools.get(item.moduleToolId) ?? null : null;
  const agent = item.moduleAgentId ? agents.get(item.moduleAgentId) ?? null : null;
  const flowType = inferFlowNodeType(item, tool);
  const isReportNode = flowType === "schedule" || flowType === "send-email" || flowType === "send-telegram" || flowType === "send-whatsapp";
  const paletteKind = isReportNode
    ? "REPORT"
    : item.nodeKind === "AGENT" || (tool && isLangChainTool(tool)) ? "AGENT" : item.nodeKind === "TOOL" ? "TOOL" : item.nodeKind;

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
      incomingTargetHandles,
      incomingFieldLabels,
      uploadedFileName: uploadedFiles[item.clientId]?.fileName,
      onConfigChange: (patch) => onConfigChange(item.clientId, patch),
      onFileChange: (file) => onFileChange(item.clientId, file),
      onOutputPreview: () => onOutputPreview(item.clientId),
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

export function flowNodeDescription(kind: FlowNodeType, language: UiLanguage = "it"): string {
  return NODE_KIND_DESCRIPTIONS[kind][language];
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
  const publishedOutputs = Array.isArray(record.published_outputs) ? record.published_outputs : [];
  const firstPublished = publishedOutputs[0] && typeof publishedOutputs[0] === "object" && publishedOutputs[0] !== null
    ? publishedOutputs[0] as Record<string, unknown>
    : null;
  if (firstPublished) {
    const publishedValue = firstPublished.value;
    const publishedText = typeof publishedValue === "string" ? publishedValue.trim() : "";
    if (publishedText) return publishedText;
    if (typeof firstPublished.label === "string" && firstPublished.label.trim()) return firstPublished.label.trim();
  }
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
