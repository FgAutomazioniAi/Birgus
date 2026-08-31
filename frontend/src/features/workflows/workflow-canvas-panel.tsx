"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  ArrowLeft,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  Copy,
  GitBranch,
  LayoutGrid,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import { Badge, Button, Card, Text } from "@/components/atoms";
import { PageHelpHint } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { useModuleAccess } from "@/lib/module-access";
import { cn } from "@/lib/cn";
import type {
  WorkflowAgent,
  WorkflowDetail,
  WorkflowKnowledgeMode,
  WorkflowRun,
  WorkflowSummary,
  WorkflowTool,
} from "./types";
import {
  baseInputNode,
  baseOutputNode,
  buildModuleCards,
  cleanWorkflowLabel,
  currentPromptFromConfiguration,
  defaultPromptFromConfiguration,
  findToolForFlowNodeType,
  flowNodeDescription,
  flowNodeLabel,
  formatDateTime,
  isAiRequestFlowNodeType,
  isAdvancedLangChainTool,
  isAgentTool,
  isLangChainTool,
  inferFlowNodeType,
  MAX_WORKFLOW_UPLOAD_BYTES,
  NODE_CATEGORY_BORDER,
  NODE_CATEGORY_BADGE_TONE,
  NODE_CATEGORY_TAB_ACTIVE,
  NODE_KIND_ICONS,
  localizedFlowNodeLabel,
  normalizeAiPromptConfiguration,
  nodeKindIcon,
  parsePaletteDragPayload,
  parseRunInput,
  PLAYGROUND_KEY,
  readFileAsBase64,
  toDraftEdge,
  toDraftNode,
  toFlowEdge,
  toFlowNode,
  toRecord,
  toRecordOrNull,
  toolIcon,
  TOOLBAR_GROUPS,
  uniqueNodeKey,
  uuidPattern,
  type CanvasNodeData,
  type DraftEdge,
  type DraftNode,
  type FlowNodeType,
  type ModuleCard,
  type Snapshot,
  type UploadedWorkflowFile,
  type WorkflowScreen,
} from "./workflow-model";
import { PaletteButton, PaletteSection, RunResultsPanel, TelegramChannelField, ToolConfigurationForm, WorkflowCheckbox, WorkflowOutputDialog } from "./workflow-components";

function resolveWorkflowKnowledgeMode(configuration: unknown): WorkflowKnowledgeMode {
  const config = toRecord(configuration);
  const contextPolicy = toRecord(config.contextPolicy);
  const value = config.knowledgeMode ?? config.knowledge_mode ?? contextPolicy.knowledgeMode ?? contextPolicy.knowledge_mode;
  if (value === "saved") {
    return "hybrid";
  }
  return value === "hybrid" || value === "on_demand" ? value : "on_demand";
}

function normalizeNodeConfigurationForSave(node: DraftNode): Record<string, unknown> {
  const configuration = { ...node.configuration };
  const isAiNode = node.nodeKind === "AGENT"
    || currentPromptFromConfiguration(configuration).trim().length > 0
    || defaultPromptFromConfiguration(configuration).trim().length > 0;
  if (!isAiNode) {
    return configuration;
  }
  return normalizeAiPromptConfiguration(configuration);
}

function isAiRequestTool(tool: WorkflowTool | null): boolean {
  if (!tool) {
    return false;
  }
  return tool.handlerKey.startsWith("langchain_orchestrator.")
    || tool.handlerKey === "document_intelligence.analyze_document_set";
}

function defaultPromptForTool(tool: WorkflowTool | null): string {
  if (!tool) {
    return "";
  }
  if (tool.handlerKey === "langchain_orchestrator.structure_text") {
    return "Estrai dal testo ricevuto solo i dati richiesti, mantenendo una struttura chiara e verificabile.";
  }
  if (tool.handlerKey === "langchain_orchestrator.compose_email") {
    return "Componi una bozza email professionale, sintetica e coerente con il contesto ricevuto.";
  }
  if (tool.handlerKey === "langchain_orchestrator.format_text") {
    return "Applica il template al contenuto senza omettere dati o aggiungere informazioni non presenti.";
  }
  if (tool.handlerKey === "document_intelligence.analyze_document_set") {
    return "Analizza i documenti collegati e produci una risposta chiara, citando gli elementi rilevanti.";
  }
  if (tool.handlerKey === "langchain_orchestrator.chat") {
    return "Rispondi in modo chiaro, operativo e coerente con l'input ricevuto dal workflow.";
  }
  return "";
}

type PublicOutputOption = { key: string; label: string };

function verificationFieldLabel(rule: Record<string, unknown>, index: number): string {
  const label = typeof rule.label === "string" ? rule.label.trim() : "";
  return label || `Valore ${index + 1}`;
}

function publicOutputOptions(source: DraftNode | undefined, sourceType: FlowNodeType | null): PublicOutputOption[] {
  if (!source) return [];
  if (sourceType === "verify-route") {
    const rules = Array.isArray(source.configuration.rules) ? source.configuration.rules : [];
    return [
      { key: "text", label: "Tutti i dati verificati" },
      { key: "bundle", label: "Raccolta dati verificati" },
      ...rules.map((rule, index) => ({ key: `field_${index + 1}`, label: verificationFieldLabel(toRecord(rule), index) })),
    ];
  }

  const defaults: Partial<Record<FlowNodeType, PublicOutputOption[]>> = {
    "input-text": [{ key: "text", label: "Testo inserito" }],
    ocr: [{ key: "text", label: "Testo estratto" }],
    llm: [{ key: "text", label: "Risposta IA" }],
    "structure-data": [{ key: "structured_data", label: "Dati estratti" }, { key: "text", label: "Testo elaborato" }],
    "document-set-ai": [{ key: "text", label: "Risposta IA" }],
    "format-text-ai": [{ key: "text", label: "Testo formattato" }],
    "format-text-template": [{ key: "text", label: "Testo formattato" }],
    "compose-email": [{ key: "subject", label: "Oggetto email" }, { key: "text", label: "Corpo email" }],
  };
  const defaultOutputs = defaults[sourceType ?? "output"];
  if (defaultOutputs) return defaultOutputs;

  const properties = toRecord(toRecord(source.outputSchema).properties);
  const fromSchema = Object.entries(properties).map(([key, schema]) => {
    const label = typeof toRecord(schema).title === "string" ? String(toRecord(schema).title) : "";
    return { key, label: label || key.replace(/_/g, " ").replace(/^./, (character) => character.toUpperCase()) };
  });
  if (fromSchema.length > 0) return fromSchema;

  return [];
}

function FlowNodeCard({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const { language, t } = useLanguage();
  const [isDefaultPromptOpen, setIsDefaultPromptOpen] = useState(false);
  const [defaultPromptDraft, setDefaultPromptDraft] = useState("");
  const [isConfirmingDefaultPrompt, setIsConfirmingDefaultPrompt] = useState(false);
  const Icon = NODE_KIND_ICONS[data.type] ?? (data.paletteKind === "AGENT" ? Bot : data.paletteKind === "TOOL" ? Wrench : nodeKindIcon[data.kind]);
  const hasFieldTargets = data.type === "llm" || data.type === "generate-document" || ["format-text-ai", "format-text-template", "send-email", "send-telegram", "send-whatsapp", "verify-route"].includes(data.type);
  const hasTarget = data.type !== "input-text" && data.type !== "schedule" && !hasFieldTargets;
  const hasSource = data.type !== "output";
  const config = data.configuration;
  const isAiRequestNode = isAiRequestFlowNodeType(data.type);
  const currentPrompt = currentPromptFromConfiguration(config);
  const defaultPrompt = defaultPromptFromConfiguration(config);
  const manualInputDisabled = data.incomingTargetHandles.length > 0;
  const scheduleRepeatEnabled = config.scheduleRepeatEnabled === undefined
    ? typeof config.scheduleRepeatValue === "string" && config.scheduleRepeatValue.trim().length > 0
    : config.scheduleRepeatEnabled === true;
  const isFieldConnected = (field: string) => data.incomingTargetHandles.includes(`field:${field}`) || data.incomingTargetHandles.includes("__default__");
  const fieldInputClassName = (field: string) => cn(
    "w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary",
    isFieldConnected(field) ? "cursor-not-allowed bg-bg-muted text-text-muted" : "",
  );
  const dataHandleClassName = "!left-0 !h-3 !w-3 !border-2 !border-status-info-text !bg-status-info-text";
  // I connettori dei campi vivono nel contenuto imbottito del nodo: -12px li riallinea al bordo esterno.
  const textHandleClassName = "!left-[-12px] !h-3 !w-3 !border-2 !border-status-info-text !bg-status-info-text";
  const scheduleHandleClassName = "!left-[-12px] !h-3 !w-3 !border-2 !border-status-danger-text !bg-status-danger-text";
  const fileHandleClassName = "!left-[-12px] !h-3 !w-3 !border-2 !border-status-success-text !bg-status-success-text";
  const sourceHandleClassName = data.type === "schedule"
    ? scheduleHandleClassName.replace("!left-[-12px] ", "")
    : data.type === "generate-document" || data.type === "input-file"
      ? fileHandleClassName.replace("!left-[-12px] ", "")
      : ["send-email", "send-telegram", "send-whatsapp"].includes(data.type)
        ? dataHandleClassName.replace("!left-0 ", "")
        : textHandleClassName.replace("!left-[-12px] ", "");
  const fieldId = (name: string) => `workflow-${data.nodeId}-${name}`;
  const stringConfig = (key: string) => typeof config[key] === "string" ? String(config[key]) : "";
  const boolConfig = (key: string) => config[key] === true;
  const patchConfig = (key: string, value: string) => data.onConfigChange?.({ [key]: value });
  const patchCurrentPrompt = (value: string) => data.onConfigChange?.({ instructions: value, currentPrompt: value });
  const isDefaultPromptDirty = defaultPromptDraft !== defaultPrompt;
  const confirmDefaultPromptChange = () => {
    data.onConfigChange?.({ defaultPrompt: defaultPromptDraft });
    setIsConfirmingDefaultPrompt(false);
  };
  const inputClassName = cn(
    "w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary",
    manualInputDisabled ? "cursor-not-allowed bg-bg-muted text-text-muted" : "",
  );
  const configuredRules = Array.isArray(config.rules)
    ? config.rules.map((rule) => toRecord(rule)).filter((rule) => Object.keys(rule).length > 0)
    : [];
  const updateRule = (index: number, patch: Record<string, unknown>) => {
    const nextRules = configuredRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule);
    data.onConfigChange?.({ rules: nextRules });
  };
  const ruleIsConnected = (index: number) => isFieldConnected(`rule_${index}`);
  const ruleNeedsComparisonValue = (operator: unknown) => !["not_empty", "exists"].includes(typeof operator === "string" ? operator : "not_empty");
  const connectedFieldCount = (field: string) => data.incomingTargetHandles.filter((handle) => handle === `field:${field}`).length;

  useEffect(() => {
    setDefaultPromptDraft(defaultPrompt);
    setIsConfirmingDefaultPrompt(false);
  }, [data.nodeId, defaultPrompt]);

  return (
    <div
      className={cn(
        "relative w-64 rounded-lg border-2 bg-bg-surface p-3 shadow-card",
        NODE_CATEGORY_BORDER[data.paletteKind],
        selected ? "ring-2 ring-ring-primary" : "",
      )}
    >
      {hasTarget ? <Handle type="target" position={Position.Left} className={dataHandleClassName} /> : null}
      <div className="relative mb-2 flex items-center gap-2">
        {["send-email", "send-telegram", "send-whatsapp"].includes(data.type) ? <Handle type="target" id="control:schedule" position={Position.Left} className={scheduleHandleClassName} title="Collega Pianifica" /> : null}
        <Icon className="h-4 w-4 text-text-primary" />
        <span className="text-sm font-medium text-text-primary">{localizedFlowNodeLabel(data.label, data.type, language)}</span>
      </div>

      {data.type === "input-text" ? (
        <textarea
          id={fieldId("promptText")}
          name={fieldId("promptText")}
          value={stringConfig("promptText")}
          onChange={(event) => patchConfig("promptText", event.target.value)}
          placeholder={t("workflow.inputText")}
          rows={3}
          className="nodrag w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
        />
      ) : null}

      {data.type === "input-file" ? (
        <div className="nodrag flex flex-col gap-1">
          <label
            htmlFor={fieldId("file")}
            className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-default bg-bg-page px-2 py-2 text-xs font-medium text-text-secondary hover:border-brand-primary hover:text-brand-primary"
          >
            <Upload className="h-3.5 w-3.5" />
            {data.uploadedFileName || "Carica documento"}
          </label>
          <input
            id={fieldId("file")}
            name={fieldId("file")}
            type="file"
            accept="application/pdf,.pdf,image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                data.onFileChange?.(file);
              }
            }}
            className="sr-only"
          />
        </div>
      ) : null}

      {data.type === "input-knowledge" ? (
        <div className="nodrag flex flex-col gap-1">
          <input
            id={fieldId("query")}
            name={fieldId("query")}
            type="text"
            value={stringConfig("query")}
            onChange={(event) => patchConfig("query", event.target.value)}
            placeholder={t("workflow.searchKnowledge")}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          <select
            id={fieldId("category")}
            name={fieldId("category")}
            value={stringConfig("category")}
            onChange={(event) => patchConfig("category", event.target.value)}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          >
            <option value="">{t("workflow.allCategories")}</option>
            <option value="contract">{t("workflow.contract")}</option>
            <option value="quotation">{t("workflow.quotation")}</option>
            <option value="other">{t("workflow.other")}</option>
          </select>
        </div>
      ) : null}

      {data.type === "document-set-ai" ? (
        <div className="nodrag flex flex-col gap-1">
          <textarea
            id={fieldId("documentIds")}
            name={fieldId("documentIds")}
            value={stringConfig("documentIds")}
            onChange={(event) => patchConfig("documentIds", event.target.value)}
            placeholder={t("workflow.documentIds")}
            rows={3}
            disabled={manualInputDisabled}
            className={inputClassName}
          />
          <textarea
            id={fieldId("prompt")}
            name={fieldId("prompt")}
            value={currentPrompt}
            onChange={(event) => patchCurrentPrompt(event.target.value)}
            placeholder={t("workflow.request")}
            rows={2}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          <WorkflowCheckbox
            checked={boolConfig("use_deep_reasoning")}
            label="Self-Discover"
            help="Aggiunge una fase di ragionamento strutturato prima della risposta. Di solito migliora analisi complesse, ma impiega piu tempo."
            onChange={(checked) => data.onConfigChange?.({ use_deep_reasoning: checked })}
          />
        </div>
      ) : null}

      {data.type === "llm" ? (
        <div className="nodrag flex flex-col gap-2">
          <div className="relative">
            <Handle type="target" id="field:input_text" position={Position.Left} className={textHandleClassName} title="Collega contenuti da analizzare" />
            <label className="mb-1 block text-xs font-medium text-text-secondary">Contenuti da analizzare{connectedFieldCount("input_text") > 0 ? ` (${connectedFieldCount("input_text")})` : ""}</label>
            <textarea
              id={fieldId("input_text")}
              name={fieldId("input_text")}
              value={stringConfig("input_text")}
              onChange={(event) => patchConfig("input_text", event.target.value)}
              placeholder={isFieldConnected("input_text") ? "Contenuti collegati: verranno analizzati insieme" : "Testo da analizzare"}
              rows={2}
              disabled={isFieldConnected("input_text")}
              className={fieldInputClassName("input_text")}
            />
          </div>
          <textarea
            id={fieldId("instructions")}
            name={fieldId("instructions")}
            value={currentPrompt}
            onChange={(event) => patchCurrentPrompt(event.target.value)}
            placeholder={t("workflow.instructions")}
            rows={3}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          <WorkflowCheckbox
            checked={boolConfig("use_deep_reasoning")}
            label="Self-Discover"
            help="Aggiunge una fase di ragionamento strutturato prima della risposta. Di solito migliora analisi complesse, ma impiega piu tempo."
            onChange={(checked) => data.onConfigChange?.({ use_deep_reasoning: checked })}
          />
        </div>
      ) : null}

      {data.type === "structure-data" ? (
        <div className="nodrag flex flex-col gap-2">
          <textarea
            id={fieldId("structure-input")}
            name={fieldId("structure-input")}
            value={stringConfig("input_text")}
            onChange={(event) => patchConfig("input_text", event.target.value)}
            placeholder={manualInputDisabled ? t("workflow.connectedInput") : t("workflow.previousOutput")}
            rows={2}
            disabled={manualInputDisabled}
            className={inputClassName}
          />
          <textarea
            id={fieldId("structure-instructions")}
            name={fieldId("structure-instructions")}
            value={currentPrompt}
            onChange={(event) => patchCurrentPrompt(event.target.value)}
            placeholder={t("workflow.requiredInstructions")}
            rows={3}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
        </div>
      ) : null}

      {data.type === "generate-document" || data.type === "quotation-docx" ? (
        <div className="nodrag flex flex-col gap-2">
          <div className="relative">
            {data.type === "generate-document" ? <Handle type="target" id="field:content" position={Position.Left} className={textHandleClassName} title="Collega contenuto" /> : null}
            <textarea
              id={fieldId(data.type === "quotation-docx" ? "quotationDataJson" : "content")}
              name={fieldId(data.type === "quotation-docx" ? "quotationDataJson" : "content")}
              value={stringConfig(data.type === "quotation-docx" ? "quotationDataJson" : "content")}
              onChange={(event) => patchConfig(data.type === "quotation-docx" ? "quotationDataJson" : "content", event.target.value)}
              placeholder={data.type === "generate-document" && isFieldConnected("content") ? t("workflow.connectedContent") : data.type === "quotation-docx" ? "Quotation JSON data" : t("workflow.documentContent")}
              rows={3}
              disabled={data.type === "generate-document" ? isFieldConnected("content") : manualInputDisabled}
              className={data.type === "generate-document" ? fieldInputClassName("content") : inputClassName}
            />
          </div>
          <div className="relative">
            {data.type === "generate-document" ? <Handle type="target" id="field:file_name" position={Position.Left} className={textHandleClassName} title="Collega nome file" /> : null}
          <input id={fieldId("file_name")} name={fieldId("file_name")} type="text" value={stringConfig("file_name")} onChange={(event) => patchConfig("file_name", event.target.value)} placeholder={data.type === "generate-document" && isFieldConnected("file_name") ? t("workflow.connectedFileName") : t("workflow.fileName")} disabled={data.type === "generate-document" && isFieldConnected("file_name")} className={data.type === "generate-document" ? fieldInputClassName("file_name") : "w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"} />
          </div>
          {data.type === "generate-document" ? <>
            <select
              id={fieldId("format")}
              name={fieldId("format")}
              value={stringConfig("format") || "docx"}
              onChange={(event) => patchConfig("format", event.target.value)}
              className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
            >
              <option value="docx">Word (.docx)</option>
              <option value="pdf">PDF (.pdf)</option>
              <option value="md">Markdown (.md)</option>
            </select>
            <WorkflowCheckbox
              checked={boolConfig("save_to_archive")}
              label="Salva nell'archivio e knowledge"
              help="Il file viene archiviato nel workspace, indicizzato e resta disponibile alla ricerca AI. Se disattivato, resta comunque scaricabile dal risultato dell'esecuzione."
              onChange={(checked) => data.onConfigChange?.({ save_to_archive: checked })}
            />
          </> : null}
        </div>
      ) : null}

      {data.type === "send-email" ? (
        <div className="nodrag flex flex-col gap-1">
          <input id={fieldId("to")} name={fieldId("to")} type="email" value={stringConfig("to")} onChange={(event) => patchConfig("to", event.target.value)} placeholder={t("workflow.emailRecipient")} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <input id={fieldId("subject")} name={fieldId("subject")} type="text" value={stringConfig("subject")} onChange={(event) => patchConfig("subject", event.target.value)} placeholder={t("workflow.subject")} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <div className="relative"><Handle type="target" id="field:text" position={Position.Left} className={textHandleClassName} title={t("workflow.connectContent")} /><textarea id={fieldId("text")} name={fieldId("text")} value={stringConfig("text")} onChange={(event) => patchConfig("text", event.target.value)} placeholder={isFieldConnected("text") ? t("workflow.connectedContent") : t("workflow.emailBody")} rows={3} disabled={isFieldConnected("text")} className={fieldInputClassName("text")} /></div>
        </div>
      ) : null}

      {data.type === "send-telegram" ? (
        <div className="nodrag flex flex-col gap-1">
          <TelegramChannelField
            value={stringConfig("telegram_channel_id")}
            manualChatId={stringConfig("chat_id")}
            idPrefix={fieldId("telegram")}
            onChange={(channelId) => data.onConfigChange?.({ telegram_channel_id: channelId, chat_id: channelId ? "" : stringConfig("chat_id") })}
            onManualChatIdChange={(chatId) => patchConfig("chat_id", chatId)}
          />
          <div className="relative"><Handle type="target" id="field:text" position={Position.Left} className={textHandleClassName} title="Collega contenuto" /><textarea id={fieldId("text")} name={fieldId("text")} value={stringConfig("text")} onChange={(event) => patchConfig("text", event.target.value)} placeholder={isFieldConnected("text") ? "Contenuto dal nodo collegato" : "Messaggio"} rows={3} disabled={isFieldConnected("text")} className={fieldInputClassName("text")} /></div>
        </div>
      ) : null}

      {data.type === "send-whatsapp" ? (
        <div className="nodrag flex flex-col gap-1">
          <input id={fieldId("to")} name={fieldId("to")} type="tel" value={stringConfig("to")} onChange={(event) => patchConfig("to", event.target.value)} placeholder="Numero WhatsApp, es. 393..." className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <div className="relative"><Handle type="target" id="field:text" position={Position.Left} className={textHandleClassName} title="Collega contenuto" /><textarea id={fieldId("text")} name={fieldId("text")} value={stringConfig("text")} onChange={(event) => patchConfig("text", event.target.value)} placeholder={isFieldConnected("text") ? "Contenuto dal nodo collegato" : "Messaggio"} rows={3} disabled={isFieldConnected("text")} className={fieldInputClassName("text")} /></div>
        </div>
      ) : null}

      {data.type === "schedule" ? (
        <div className="nodrag flex flex-col gap-1">
          <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Quando
            <input
              id={fieldId("scheduleWhen")}
              name={fieldId("scheduleWhen")}
              type="datetime-local"
              value={stringConfig("scheduleWhen")}
              onChange={(event) => patchConfig("scheduleWhen", event.target.value)}
              className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs normal-case tracking-normal text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Ripeti ogni
              <div className="flex gap-1">
              <input
                id={fieldId("scheduleRepeatValue")}
                name={fieldId("scheduleRepeatValue")}
                type="number"
                min={1}
                value={stringConfig("scheduleRepeatValue")}
                onChange={(event) => patchConfig("scheduleRepeatValue", event.target.value)}
                placeholder="7"
                disabled={!scheduleRepeatEnabled}
                className="w-1/2 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs normal-case tracking-normal text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
              />
              <select
                id={fieldId("scheduleRepeatUnit")}
                name={fieldId("scheduleRepeatUnit")}
                value={stringConfig("scheduleRepeatUnit") || "days"}
                onChange={(event) => patchConfig("scheduleRepeatUnit", event.target.value)}
                disabled={!scheduleRepeatEnabled}
                className="w-1/2 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs normal-case tracking-normal text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
              >
                <option value="hours">ore</option>
                <option value="days">giorni</option>
              </select>
              </div>
            </label>
            <WorkflowCheckbox checked={scheduleRepeatEnabled} label="Ripeti" onChange={(checked) => data.onConfigChange?.({ scheduleRepeatEnabled: checked })} />
          </div>
        </div>
      ) : null}

      {data.type === "compose-email" ? (
        <div className="nodrag flex flex-col gap-1">
          <textarea id={fieldId("context")} name={fieldId("context")} value={stringConfig("context")} onChange={(event) => patchConfig("context", event.target.value)} placeholder={manualInputDisabled ? "Input dal nodo collegato" : "Di cosa deve parlare l'email?"} rows={2} disabled={manualInputDisabled} className={inputClassName} />
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary" htmlFor={fieldId("tone")}>
            Personalita
          <select id={fieldId("tone")} name={fieldId("tone")} value={stringConfig("tone") || "professionale"} onChange={(event) => {
            const tone = event.target.value;
            const prompts: Record<string, string> = {
              professionale: "Scrivi in modo chiaro, cortese e operativo, senza risultare rigido.",
              formale: "Usa un registro formale e rispettoso, con formule di apertura e chiusura appropriate.",
              informale: "Scrivi in modo cordiale e diretto, adatto a una relazione di lavoro confidenziale.",
              breve: "Scrivi un messaggio molto breve e concreto, senza preamboli superflui.",
            };
            data.onConfigChange?.({ tone, instructions: prompts[tone] ?? prompts.professionale, currentPrompt: prompts[tone] ?? prompts.professionale });
          }} className="min-w-0 flex-1 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary">
            <option value="professionale">Professionale</option>
            <option value="formale">Formale</option>
            <option value="informale">Informale</option>
            <option value="breve">Breve</option>
          </select>
          </label>
          <textarea id={fieldId("extra_instructions")} name={fieldId("extra_instructions")} value={currentPrompt} onChange={(event) => patchCurrentPrompt(event.target.value)} placeholder="Istruzioni aggiuntive" rows={2} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
        </div>
      ) : null}

      {data.type === "format-text-ai" || data.type === "format-text-template" ? (
        <div className="nodrag flex flex-col gap-2">
          <div className="relative">
            <Handle type="target" id="field:content" position={Position.Left} className={textHandleClassName} title="Collega contenuto" />
            <textarea id={fieldId("content")} name={fieldId("content")} value={stringConfig("content")} onChange={(event) => patchConfig("content", event.target.value)} placeholder={isFieldConnected("content") ? "Contenuto dal nodo collegato" : "Contenuto da formattare"} rows={2} disabled={isFieldConnected("content")} className={fieldInputClassName("content")} />
          </div>
          <div className="relative">
            <Handle type="target" id="field:template" position={Position.Left} className={textHandleClassName} title="Collega template documento" />
            <textarea id={fieldId("template")} name={fieldId("template")} value={stringConfig("template")} onChange={(event) => patchConfig("template", event.target.value)} placeholder={isFieldConnected("template") ? "Template dal nodo collegato" : data.type === "format-text-template" ? "Template con {{content}} o {{fields...}}" : "Template documento"} rows={3} disabled={isFieldConnected("template")} className={fieldInputClassName("template")} />
          </div>
          {data.type === "format-text-ai" ? <textarea id={fieldId("format-instructions")} name={fieldId("format-instructions")} value={currentPrompt} onChange={(event) => patchCurrentPrompt(event.target.value)} placeholder="Istruzioni aggiuntive" rows={2} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" /> : null}
        </div>
      ) : null}

      {data.type === "verify-route" ? (
        <div className="nodrag flex flex-col gap-2">
          {configuredRules.map((rule, index) => (
            <div key={`${data.nodeId}-rule-${index}`} className="relative rounded-md border border-border-subtle bg-bg-muted p-1.5">
              <Handle type="target" id={`field:rule_${index}`} position={Position.Left} className={textHandleClassName} title={`Collega valore alla regola ${index + 1}`} />
              <div className={cn("mb-1 flex min-h-7 items-center rounded-md border px-2 text-xs font-medium", ruleIsConnected(index) ? "border-border-default bg-bg-page text-text-primary" : "border-dashed border-border-default bg-bg-muted text-text-muted")}>
                {ruleIsConnected(index) ? `Controlla: ${data.incomingFieldLabels[`rule_${index}`] ?? "Output collegato"}` : "Collega un valore in ingresso"}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_24px] gap-1">
                <select value={typeof rule.operator === "string" ? rule.operator : "not_empty"} onChange={(event) => updateRule(index, { operator: event.target.value })} className="min-w-0 rounded-md border border-border-default bg-bg-page px-1 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary">
                  <option value="not_empty">Non vuoto</option><option value="exists">Esiste</option><option value="equals">Uguale</option><option value="contains">Contiene</option><option value="greater_than">Maggiore di</option><option value="less_than">Minore di</option><option value="between">Compreso tra</option>
                </select>
                <button type="button" className="rounded-md px-1 text-text-muted hover:bg-bg-page hover:text-status-danger-text" title="Rimuovi regola" onClick={() => data.onConfigChange?.({ rules: configuredRules.filter((_, ruleIndex) => ruleIndex !== index) })}><X size={14} /></button>
              </div>
              {ruleNeedsComparisonValue(rule.operator) ? (typeof rule.operator === "string" && rule.operator === "between" ? <div className="mt-1 grid grid-cols-2 gap-1"><input value={typeof rule.min === "string" || typeof rule.min === "number" ? String(rule.min) : ""} onChange={(event) => updateRule(index, { min: event.target.value })} placeholder="Minimo" className="min-w-0 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" /><input value={typeof rule.max === "string" || typeof rule.max === "number" ? String(rule.max) : ""} onChange={(event) => updateRule(index, { max: event.target.value })} placeholder="Massimo" className="min-w-0 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" /></div> : <input value={typeof rule.value === "string" || typeof rule.value === "number" ? String(rule.value) : ""} onChange={(event) => updateRule(index, { value: event.target.value })} placeholder={typeof rule.operator === "string" && rule.operator === "contains" ? "Testo da cercare" : "Valore di confronto"} className="mt-1 w-full min-w-0 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />) : null}
            </div>
          ))}
          <div className="relative flex min-h-8 items-center justify-center">
            <button type="button" className="w-36 rounded-md border border-border-default px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-muted" onClick={() => data.onConfigChange?.({ rules: [...configuredRules, { label: `Valore ${configuredRules.length + 1}`, operator: "not_empty", value: "" }] })}>Aggiungi regola</button>
            <span className="pointer-events-none absolute right-3 top-0.5 text-[10px] font-bold text-text-primary">{language === "en" ? "T" : "V"}</span>
            <span className="pointer-events-none absolute right-3 bottom-0.5 text-[10px] font-bold text-text-primary">F</span>
          </div>
        </div>
      ) : null}

      {data.type === "verify-route" ? <>
        <Handle type="source" id="valid" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-white" style={{ top: "auto", bottom: "23px" }} title={language === "en" ? "Route when true" : "Instrada se valido"} />
        <Handle type="source" id="invalid" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-black" style={{ top: "auto", bottom: "7px" }} title={language === "en" ? "Route when false" : "Instrada se non valido"} />
      </> : null}

      {data.type === "human-review" || data.type === "request-decision" ? (
        <div className="nodrag flex flex-col gap-1">
          <input id={fieldId("title")} name={fieldId("title")} value={stringConfig("title")} onChange={(event) => patchConfig("title", event.target.value)} placeholder={data.type === "request-decision" ? "Decisione richiesta" : "Titolo revisione"} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <textarea id={fieldId("message")} name={fieldId("message")} value={stringConfig("message")} onChange={(event) => patchConfig("message", event.target.value)} placeholder={data.type === "request-decision" ? "Cosa deve decidere l'utente?" : "Motivo della revisione"} rows={2} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          {data.type === "request-decision" ? <select id={fieldId("priority")} name={fieldId("priority")} value={stringConfig("priority") || "normal"} onChange={(event) => patchConfig("priority", event.target.value)} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"><option value="low">Priorita bassa</option><option value="normal">Priorita normale</option><option value="high">Priorita alta</option><option value="urgent">Urgente</option></select> : null}
          <input id={fieldId("assigneeUserId")} name={fieldId("assigneeUserId")} value={stringConfig("assigneeUserId")} onChange={(event) => patchConfig("assigneeUserId", event.target.value)} placeholder="ID utente assegnatario (facoltativo)" className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
        </div>
      ) : null}

      {data.type === "check-mailbox" ? (
        <p className="text-xs text-text-muted">{t("workflow.mailboxHint")}</p>
      ) : null}

      {data.type === "output" ? (
        <button
          type="button"
          className="nodrag mt-1 flex w-full items-center justify-center rounded-md border border-brand-primary bg-bg-page px-3 py-2 text-sm font-semibold text-brand-primary transition-colors hover:bg-bg-subtle"
          onClick={(event) => {
            event.stopPropagation();
            data.onOutputPreview?.();
          }}
        >
          Visualizza
        </button>
      ) : null}

      {isAiRequestNode ? (
        <div className="nodrag relative mt-2 border-t border-border-subtle pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-semibold text-text-muted hover:bg-bg-muted hover:text-text-primary"
            onClick={() => setIsDefaultPromptOpen((current) => !current)}
            aria-expanded={isDefaultPromptOpen}
          >
            <span>{t("workflow.defaultPrompt")}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isDefaultPromptOpen ? "rotate-180" : "")} />
          </button>
          {isDefaultPromptOpen ? (
            <textarea
              id={fieldId("defaultPrompt")}
              name={fieldId("defaultPrompt")}
              value={defaultPromptDraft}
              onChange={(event) => setDefaultPromptDraft(event.target.value)}
              placeholder="Template di default del nodo"
              rows={3}
              className="mt-1 w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
            />
          ) : null}
          {isDefaultPromptOpen && isDefaultPromptDirty ? (
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                className="rounded-md border border-border-default px-2 py-1 text-xs font-semibold text-text-secondary hover:border-brand-primary/50 hover:bg-bg-muted"
                onClick={() => setIsConfirmingDefaultPrompt(true)}
              >
                Salva default
              </button>
            </div>
          ) : null}
          {isConfirmingDefaultPrompt ? (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-md border border-border-default bg-bg-surface p-3 shadow-elevated">
              <p className="text-xs font-semibold text-text-primary">{t("workflow.updateDefaultPrompt")}</p>
              <p className="mt-1 text-xs text-text-muted">{t("workflow.updateDefaultPromptHint")}</p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:bg-bg-muted" onClick={() => setIsConfirmingDefaultPrompt(false)}>
                  Annulla
                </button>
                <button type="button" className="rounded-md bg-brand-primary px-2 py-1 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover" onClick={confirmDefaultPromptChange}>
                  Conferma
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasSource && data.type !== "verify-route" ? <Handle type="source" position={Position.Right} className={sourceHandleClassName} /> : null}
    </div>
  );
}

const nodeTypes = { workflowNode: FlowNodeCard };

export function WorkflowCanvasPanel() {
  const searchParams = useSearchParams();
  const { enabledModuleKeys } = useModuleAccess();
  const { language, t } = useLanguage();
  const [screen, setScreen] = useState<WorkflowScreen>("modules");
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [tools, setTools] = useState<WorkflowTool[]>([]);
  const [agents, setAgents] = useState<WorkflowAgent[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [draftNodes, setDraftNodes] = useState<DraftNode[]>([]);
  const [draftEdges, setDraftEdges] = useState<DraftEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<WorkflowKnowledgeMode>("on_demand");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPlayground, setIsCreatingPlayground] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
  const [isCreateWorkflowOpen, setIsCreateWorkflowOpen] = useState(false);
  const [newWorkflowLabel, setNewWorkflowLabel] = useState("Nuovo workflow");
  const [latestRun, setLatestRun] = useState<WorkflowRun | null>(null);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isOutputFocused, setIsOutputFocused] = useState(false);
  const [isRunsPanelCollapsed, setIsRunsPanelCollapsed] = useState(false);
  const [outputPreviewNodeId, setOutputPreviewNodeId] = useState<string | null>(null);
  const [expandedResultCard, setExpandedResultCard] = useState<string | null>(null);
  const [openToolbarGroup, setOpenToolbarGroup] = useState<string>(TOOLBAR_GROUPS[0].id);
  const [nodePickerGroupId, setNodePickerGroupId] = useState<string | null>(null);
  const [nodePickerQuery, setNodePickerQuery] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [runInputText, setRunInputText] = useState("{}");
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedWorkflowFile>>({});
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<Node<CanvasNodeData>, Edge> | null>(null);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<CanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const openedRunReference = useRef<string | null>(null);

  const selectedNode = useMemo(
    () => draftNodes.find((item) => item.clientId === selectedNodeId) ?? null,
    [draftNodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => draftEdges.find((item) => item.clientId === selectedEdgeId) ?? null,
    [draftEdges, selectedEdgeId],
  );
  const toolById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const selectedAgent = selectedNode?.moduleAgentId ? agentById.get(selectedNode.moduleAgentId) ?? null : null;
  const selectedTool = selectedNode?.moduleToolId ? toolById.get(selectedNode.moduleToolId) ?? null : null;
  const activeToolbarGroup = TOOLBAR_GROUPS.find((group) => group.id === openToolbarGroup) ?? TOOLBAR_GROUPS[0];
  const nodePickerGroup = TOOLBAR_GROUPS.find((group) => group.id === nodePickerGroupId) ?? null;
  const featuredToolbarItems = activeToolbarGroup.items.slice(0, 4);
  const hasMoreToolbarItems = activeToolbarGroup.items.length > featuredToolbarItems.length;
  const nodePickerItems = (nodePickerGroup?.items ?? []).filter((kind) => {
    const query = nodePickerQuery.trim().toLowerCase();
    return !query || flowNodeLabel(kind, language).toLowerCase().includes(query) || flowNodeDescription(kind, language).toLowerCase().includes(query);
  });
  const moduleCards = useMemo(
    () => buildModuleCards(workflows, tools, agents, enabledModuleKeys, language),
    [agents, enabledModuleKeys, language, tools, workflows],
  );
  const playgroundCard = useMemo<ModuleCard>(() => {
    const playground = workflows.find((item) => item.key === PLAYGROUND_KEY) ?? null;
    return {
      cardKey: "playground",
      moduleKey: "workflow_management",
      title: language === "en" ? "Playground" : "Playground",
      description: language === "en"
        ? "A free area to build and test workflows without adding workflows to modules."
        : "Area libera per costruire e provare workflow senza aumentare i workflow dei moduli.",
      workflow: playground,
      agentsCount: agents.length + tools.filter(isAgentTool).length,
      toolsCount: tools.filter((tool) => !isAgentTool(tool)).length,
      isPlayground: true,
    };
  }, [agents.length, language, tools, workflows]);
  const nodeLabelByKey = useMemo(() => new Map(draftNodes.map((node) => [node.nodeKey, cleanWorkflowLabel(node.label)])), [draftNodes]);
  const incomingHandlesByTargetId = useMemo(() => {
    const handles = new Map<string, string[]>();
    for (const edge of draftEdges.filter((item) => item.isEnabled)) {
      const current = handles.get(edge.targetClientId) ?? [];
      current.push(edge.targetHandle ?? "__default__");
      handles.set(edge.targetClientId, current);
    }
    return handles;
  // Configurazioni testuali non cambiano i collegamenti: mantenere stabile questa mappa evita di ricreare
  // i nodi React Flow a ogni battuta e preserva correttamente la posizione del cursore.
  }, [draftEdges]);
  const incomingFieldLabelsByTargetId = useMemo(() => {
    const labels = new Map<string, Record<string, string>>();
    for (const edge of draftEdges.filter((item) => item.isEnabled && /^field:rule_\d+$/.test(item.targetHandle ?? ""))) {
      const source = draftNodes.find((node) => node.clientId === edge.sourceClientId);
      const sourceType = source ? inferFlowNodeType(source, source.moduleToolId ? toolById.get(source.moduleToolId) ?? null : null) : null;
      const options = publicOutputOptions(source, sourceType);
      const condition = toRecord(edge.conditionPayload);
      const selectedOutputKey = typeof condition.selected_output_key === "string" ? String(condition.selected_output_key) : "";
      const selected = options.find((option) => option.key === selectedOutputKey) ?? options[0];
      const targetLabels = labels.get(edge.targetClientId) ?? {};
      targetLabels[(edge.targetHandle ?? "").replace("field:", "")] = typeof condition.input_label === "string" && condition.input_label.trim() ? condition.input_label.trim() : selected?.label ?? "Output collegato";
      labels.set(edge.targetClientId, targetLabels);
    }
    return labels;
  }, [draftEdges, draftNodes, toolById]);
  const draftNodeStructureKey = useMemo(
    () => JSON.stringify(draftNodes.map((node) => ({
      clientId: node.clientId,
      nodeKey: node.nodeKey,
      nodeKind: node.nodeKind,
      label: node.label,
      positionX: node.positionX,
      positionY: node.positionY,
      moduleAgentId: node.moduleAgentId ?? null,
      moduleToolId: node.moduleToolId ?? null,
      inputKind: node.inputKind ?? null,
      outputKind: node.outputKind ?? null,
      isEnabled: node.isEnabled,
      isRequired: node.isRequired,
    }))),
    [draftNodes],
  );
  const latestRunReference = latestRun
    ? `${workflow?.label ?? latestRun.workflowKey ?? "Workflow"} - ${formatDateTime(latestRun.startedAt ?? latestRun.queuedAt ?? latestRun.completedAt)}`
    : "";

  const isPlaygroundWorkflow = workflow?.moduleKey === "workflow_management";
  const personalWorkflows = useMemo(
    () => workflows.filter((item) => item.moduleKey === "workflow_management" && item.key !== PLAYGROUND_KEY),
    [workflows],
  );
  const availableAgents: WorkflowAgent[] = [];
  const agentTools = useMemo(() => tools.filter(isAgentTool), [tools]);
  const advancedLangChainTools = useMemo(() => tools.filter(isAdvancedLangChainTool), [tools]);
  const actionTools = useMemo(() => {
    if (!workflow || isPlaygroundWorkflow) {
      return tools.filter((tool) => !isLangChainTool(tool) && tool.handlerKey !== "document_intelligence.search_workspace_knowledge");
    }
    return tools.filter((tool) => (
      !isLangChainTool(tool)
      && tool.handlerKey !== "document_intelligence.search_workspace_knowledge"
      && (tool.moduleKey === workflow.moduleKey || tool.moduleKey === "document_intelligence")
    ));
  }, [isPlaygroundWorkflow, tools, workflow]);
  const canEditSelectedAgentPrompt = Boolean(selectedAgent && workflow && !isPlaygroundWorkflow && selectedAgent.moduleKey === workflow.moduleKey);

  useEffect(() => {
    setExpandedResultCard(null);
  }, [latestRun?.id]);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const [workflowsResponse, toolsResponse, agentsResponse] = await Promise.all([
        fetch("/api/workflows", { cache: "no-store" }),
        fetch("/api/workflows/tools", { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
      ]);
      if (!workflowsResponse.ok || !toolsResponse.ok || !agentsResponse.ok) {
        throw new Error("Impossibile caricare il workspace workflow.");
      }
      const workflowsPayload = (await workflowsResponse.json()) as { workflows?: WorkflowSummary[] };
      const toolsPayload = (await toolsResponse.json()) as { tools?: WorkflowTool[] };
      const agentsPayload = (await agentsResponse.json()) as { agents?: WorkflowAgent[] };
      setWorkflows(workflowsPayload.workflows ?? []);
      setTools(toolsPayload.tools ?? []);
      setAgents(agentsPayload.agents ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore caricamento workflow.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectWorkflowRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/workflow-runs/${runId}`, { cache: "no-store" });
    if (!response.ok) {
      toast.error("Impossibile caricare questa esecuzione.");
      return;
    }
    setLatestRun((await response.json()) as WorkflowRun);
  }, []);

  const loadWorkflowRuns = useCallback(async (workflowId: string) => {
    if (!workflowId) {
      setWorkflowRuns([]);
      return;
    }
    setIsLoadingRuns(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/runs`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Impossibile caricare le esecuzioni del workflow.");
      }
      const payload = (await response.json()) as { runs?: WorkflowRun[] };
      setWorkflowRuns(payload.runs ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore caricamento esecuzioni.");
    } finally {
      setIsLoadingRuns(false);
    }
  }, []);

  const loadWorkflow = useCallback(async (workflowId: string) => {
    if (!workflowId) {
      setWorkflow(null);
      setDraftNodes([]);
      setDraftEdges([]);
      setNodes([]);
      setEdges([]);
      setFlowInstance(null);
      setUploadedFiles({});
      return;
    }
    const response = await fetch(`/api/workflows/${workflowId}`, { cache: "no-store" });
    if (!response.ok) {
      toast.error("Impossibile caricare il workflow selezionato.");
      return;
    }
    const detail = (await response.json()) as WorkflowDetail;
    const nextDraftNodes = detail.nodes.map((item) => {
      const node = toDraftNode(item);
      const agent = node.moduleAgentId ? agents.find((candidate) => candidate.id === node.moduleAgentId) ?? null : null;
      const tool = node.moduleToolId ? tools.find((candidate) => candidate.id === node.moduleToolId) ?? null : null;
      const flowType = inferFlowNodeType(node, tool);
      if (!isAiRequestFlowNodeType(flowType)) {
        return node;
      }
      return {
        ...node,
        configuration: normalizeAiPromptConfiguration(
          node.configuration,
          agent?.activePrompt || currentPromptFromConfiguration(toRecord(tool?.configuration)) || defaultPromptForTool(tool),
          agent?.originalPrompt ?? defaultPromptForTool(tool),
        ),
      };
    });
    const idToClientId = new Map(nextDraftNodes.map((node) => [node.id ?? node.nodeKey, node.clientId]));
    const nextDraftEdges = detail.edges.map((edge) => toDraftEdge(edge, idToClientId));
    setWorkflow(detail);
    setSelectedWorkflowId(detail.id);
    setLabel(detail.label || detail.name);
    setDescription(detail.description ?? "");
    setKnowledgeMode(resolveWorkflowKnowledgeMode(detail.configuration));
    setLatestRun(null);
    setWorkflowRuns([]);
    setIsOutputFocused(false);
    setOutputPreviewNodeId(null);
    setFlowInstance(null);
    setUploadedFiles({});
    setDraftNodes(nextDraftNodes);
    setDraftEdges(nextDraftEdges);
    setPast([]);
    setFuture([]);
    setSelectedNodeId(nextDraftNodes[0]?.clientId ?? null);
    setScreen("canvas");
    void loadWorkflowRuns(detail.id);
  }, [agents, loadWorkflowRuns, setEdges, setNodes, tools]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const workflowId = searchParams.get("workflowId");
    const runId = searchParams.get("runId");
    if (!workflowId || !runId) {
      openedRunReference.current = null;
      return;
    }
    const reference = `${workflowId}:${runId}`;
    if (openedRunReference.current === reference) return;
    openedRunReference.current = reference;
    void (async () => {
      await loadWorkflow(workflowId);
      await selectWorkflowRun(runId);
    })();
  }, [loadWorkflow, searchParams, selectWorkflowRun]);

  const commitHistory = useCallback(() => {
    setPast((current) => [...current, { nodes: draftNodes, edges: draftEdges }]);
    setFuture([]);
  }, [draftEdges, draftNodes]);

  const patchNodeConfiguration = useCallback((clientId: string, patch: Record<string, unknown>) => {
    setDraftNodes((current) =>
      current.map((node) =>
        node.clientId === clientId
          ? { ...node, configuration: { ...node.configuration, ...patch } }
          : node,
      ),
    );
    setNodes((current) =>
      current.map((node) =>
        node.id === clientId
          ? {
              ...node,
              data: {
                ...node.data,
                configuration: {
                  ...node.data.configuration,
                  ...patch,
                },
              },
            }
          : node,
      ),
    );
  }, [setNodes]);

  const patchEdgeCondition = useCallback((clientId: string, conditionPayload: Record<string, unknown> | null) => {
    setDraftEdges((current) => current.map((edge) => edge.clientId === clientId ? { ...edge, conditionPayload } : edge));
  }, []);

  const selectFieldOutput = useCallback((edge: DraftEdge, outputKey: string, outputLabel: string) => {
    const existingInputLabel = typeof toRecord(edge.conditionPayload).input_label === "string" ? String(toRecord(edge.conditionPayload).input_label).trim() : "";
    setDraftEdges((current) => current.map((item) => {
      if (item.clientId !== edge.clientId) return item;
      const condition = toRecord(item.conditionPayload);
      if (outputKey) condition.selected_output_key = outputKey;
      else delete condition.selected_output_key;
      return { ...item, conditionPayload: condition };
    }));

    const match = /^field:rule_(\d+)$/.exec(edge.targetHandle ?? "");
    if (!match) return;
    const ruleIndex = Number(match[1]);
    setDraftNodes((current) => current.map((node) => {
      if (node.clientId !== edge.targetClientId) return node;
      const rules = Array.isArray(node.configuration.rules) ? node.configuration.rules.map(toRecord) : [];
      if (!rules[ruleIndex]) return node;
      rules[ruleIndex] = { ...rules[ruleIndex], label: existingInputLabel || outputLabel };
      return { ...node, configuration: { ...node.configuration, rules } };
    }));
  }, []);

  const setFieldInputLabel = useCallback((edge: DraftEdge, inputLabel: string, fallbackLabel: string) => {
    const normalized = inputLabel.trim();
    setDraftEdges((current) => current.map((item) => {
      if (item.clientId !== edge.clientId) return item;
      const condition = toRecord(item.conditionPayload);
      if (normalized) condition.input_label = normalized;
      else delete condition.input_label;
      return { ...item, conditionPayload: condition };
    }));

    const match = /^field:rule_(\d+)$/.exec(edge.targetHandle ?? "");
    if (!match) return;
    const ruleIndex = Number(match[1]);
    setDraftNodes((current) => current.map((node) => {
      if (node.clientId !== edge.targetClientId) return node;
      const rules = Array.isArray(node.configuration.rules) ? node.configuration.rules.map(toRecord) : [];
      if (!rules[ruleIndex]) return node;
      rules[ruleIndex] = { ...rules[ruleIndex], label: normalized || fallbackLabel };
      return { ...node, configuration: { ...node.configuration, rules } };
    }));
  }, []);

  const handleNodeFileChange = useCallback(async (clientId: string, file: File) => {
    if (file.size > MAX_WORKFLOW_UPLOAD_BYTES) {
      toast.error("File troppo grande per il Playground workflow. Limite: 15 MB.");
      return;
    }
    const fileBase64 = await readFileAsBase64(file);
    setUploadedFiles((current) => ({
      ...current,
      [clientId]: {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileBase64,
        sizeBytes: file.size,
      },
    }));
    setDraftNodes((current) =>
      current.map((node) =>
        node.clientId === clientId
          ? {
              ...node,
              configuration: {
                ...node.configuration,
                file_name: file.name,
                content_type: file.type || "application/octet-stream",
                size_bytes: file.size,
              },
            }
          : node,
      ),
    );
  }, []);

  useEffect(() => {
    setNodes(draftNodes.map((item) => toFlowNode(
      item,
      toolById,
      agentById,
      uploadedFiles,
      incomingHandlesByTargetId.get(item.clientId) ?? [],
      incomingFieldLabelsByTargetId.get(item.clientId) ?? {},
      patchNodeConfiguration,
      handleNodeFileChange,
      (clientId) => setOutputPreviewNodeId(clientId),
    )));
    setEdges(draftEdges.map(toFlowEdge));
  }, [agentById, draftEdges, draftNodeStructureKey, handleNodeFileChange, incomingFieldLabelsByTargetId, incomingHandlesByTargetId, patchNodeConfiguration, setEdges, setNodes, toolById, uploadedFiles]);

  useEffect(() => {
    setPromptDraft(selectedAgent?.activePrompt ?? "");
  }, [selectedAgent]);

  useEffect(() => {
    if (screen !== "canvas" || !flowInstance || nodes.length === 0) {
      return;
    }
    const frameId = requestAnimationFrame(() => {
      void flowInstance.fitView({ padding: 0.2 });
    });
    return () => cancelAnimationFrame(frameId);
  }, [flowInstance, nodes.length, screen]);

  const openModule = async (card: ModuleCard) => {
    if (card.isPlayground) {
      if (card.workflow) {
        await loadWorkflow(card.workflow.id);
        return;
      }
      await createPlayground();
      return;
    }
    if (card.workflow) {
      await loadWorkflow(card.workflow.id);
      return;
    }
    toast.info("Nessun workflow configurato per questo modulo.");
  };

  const createPlayground = async () => {
    const existingPlayground = workflows.find((item) => item.key === PLAYGROUND_KEY);
    if (existingPlayground) {
      await loadWorkflow(existingPlayground.id);
      return;
    }

    setIsCreatingPlayground(true);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleKey: "workflow_management",
          key: PLAYGROUND_KEY,
          name: PLAYGROUND_KEY,
          label: "Playground",
          description: "Workflow libero per testare combinazioni di agent e tool.",
          isEnabled: true,
          isDefault: false,
          nodes: [
            baseInputNode(80, 180),
            baseOutputNode(760, 180),
          ],
          edges: [{ sourceNodeKey: "input", targetNodeKey: "output", orderNo: 1, isEnabled: true }],
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.message === "string" ? payload.message : "Creazione Playground non riuscita.");
      }
      const created = (await response.json()) as WorkflowDetail;
      await loadCatalog();
      await loadWorkflow(created.id);
      toast.success("Playground creato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore creazione Playground.");
    } finally {
      setIsCreatingPlayground(false);
    }
  };

  const createPersonalWorkflow = async () => {
    const nextLabel = newWorkflowLabel.trim() || "Nuovo workflow";
    const key = `playground_${Date.now().toString(36)}`;
    setIsCreatingWorkflow(true);
    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleKey: "workflow_management",
          key,
          name: key,
          label: nextLabel,
          description: "Workflow libero creato dal playground.",
          isEnabled: true,
          isDefault: false,
          nodes: [baseInputNode(80, 180), baseOutputNode(760, 180)],
          edges: [{ sourceNodeKey: "input", targetNodeKey: "output", orderNo: 1, isEnabled: true }],
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.message === "string" ? payload.message : "Creazione workflow non riuscita.");
      }
      const created = (await response.json()) as WorkflowDetail;
      setIsCreateWorkflowOpen(false);
      setNewWorkflowLabel("Nuovo workflow");
      await loadCatalog();
      await loadWorkflow(created.id);
      toast.success("Nuovo workflow creato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore creazione workflow.");
    } finally {
      setIsCreatingWorkflow(false);
    }
  };

  const copyPersonalWorkflow = async (source: WorkflowSummary) => {
    try {
      const detailResponse = await fetch(`/api/workflows/${source.id}`, { cache: "no-store" });
      if (!detailResponse.ok) throw new Error("Impossibile leggere il workflow da copiare.");
      const detail = await detailResponse.json() as WorkflowDetail;
      const nodeKeyById = new Map(detail.nodes.map((node) => [node.id, node.nodeKey]));
      const key = `playground_${Date.now().toString(36)}`;
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          moduleKey: "workflow_management",
          key,
          name: key,
          label: `${detail.label} - copia`,
          description: detail.description,
          configuration: detail.configuration,
          isEnabled: true,
          isDefault: false,
          nodes: detail.nodes.map((node) => ({
            nodeKey: node.nodeKey,
            nodeKind: node.nodeKind,
            label: node.label,
            positionX: node.positionX + 32,
            positionY: node.positionY + 32,
            moduleAgentId: node.moduleAgentId ?? null,
            moduleToolId: node.moduleToolId ?? null,
            inputKind: node.inputKind ?? null,
            outputKind: node.outputKind ?? null,
            configuration: node.configuration ?? {},
            inputSchema: node.inputSchema ?? null,
            outputSchema: node.outputSchema ?? null,
            isEnabled: node.isEnabled,
            isRequired: node.isRequired,
          })),
          edges: detail.edges.map((edge) => ({
            sourceNodeKey: nodeKeyById.get(edge.sourceNodeId) ?? edge.sourceNodeId,
            targetNodeKey: nodeKeyById.get(edge.targetNodeId) ?? edge.targetNodeId,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null,
            label: edge.label ?? null,
            conditionPayload: edge.conditionPayload ?? null,
            orderNo: edge.orderNo,
            isEnabled: edge.isEnabled,
          })),
        }),
      });
      if (!response.ok) throw new Error("Copia workflow non riuscita.");
      const copied = await response.json() as WorkflowDetail;
      await loadCatalog();
      await loadWorkflow(copied.id);
      toast.success(t("workflow.copySuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copia workflow non riuscita.");
    }
  };

  const deletePersonalWorkflow = async (item: WorkflowSummary) => {
    if (!window.confirm(t("workflow.deleteConfirm"))) return;
    try {
      const response = await fetch(`/api/workflows/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Eliminazione workflow non riuscita.");
      await loadCatalog();
      toast.success(t("workflow.deleteSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eliminazione workflow non riuscita.");
    }
  };

  const addAgentNode = (agent: WorkflowAgent, position?: { x: number; y: number }) => {
    commitHistory();
    const nextIndex = draftNodes.filter((item) => item.nodeKind === "AGENT").length + 1;
    const nodeKey = uniqueNodeKey(draftNodes, `${agent.key}_${nextIndex}`);
    const node: DraftNode = {
      clientId: `node_${Date.now()}_${nextIndex}`,
      nodeKey,
      nodeKind: "AGENT",
      label: cleanWorkflowLabel(agent.label),
      positionX: position?.x ?? 320 + nextIndex * 44,
      positionY: position?.y ?? 130 + nextIndex * 44,
      moduleAgentId: agent.id,
      configuration: normalizeAiPromptConfiguration({ purpose: agent.key }, agent.activePrompt, agent.originalPrompt),
      isEnabled: true,
      isRequired: false,
    };
    setDraftNodes((current) => [...current, node]);
    setSelectedNodeId(node.clientId);
  };

  const addToolNode = (tool: WorkflowTool, position?: { x: number; y: number }) => {
    commitHistory();
    const nextIndex = draftNodes.filter((item) => item.nodeKind === "TOOL").length + 1;
    const nodeKey = uniqueNodeKey(draftNodes, `${tool.key}_${nextIndex}`);
    const node: DraftNode = {
      clientId: `node_${Date.now()}_${nextIndex}`,
      nodeKey,
      nodeKind: "TOOL",
      label: cleanWorkflowLabel(tool.label),
      positionX: position?.x ?? 340 + nextIndex * 44,
      positionY: position?.y ?? 160 + nextIndex * 44,
      moduleToolId: tool.id,
      configuration: isAiRequestTool(tool)
        ? normalizeAiPromptConfiguration(toRecord(tool.configuration), defaultPromptForTool(tool), defaultPromptForTool(tool))
        : toRecord(tool.configuration),
      inputSchema: toRecordOrNull(tool.inputSchema),
      outputSchema: toRecordOrNull(tool.outputSchema),
      isEnabled: true,
      isRequired: false,
    };
    setDraftNodes((current) => [...current, node]);
    setSelectedNodeId(node.clientId);
  };

  const addFlowNode = (kind: FlowNodeType, dropPosition?: { x: number; y: number }) => {
    const nextIndex = draftNodes.length + 1;
    const position = dropPosition ?? { x: 100 + nextIndex * 40, y: 100 + nextIndex * 40 };

    if (kind === "input-text" || kind === "input-file") {
      commitHistory();
      const nodeKey = uniqueNodeKey(draftNodes, `${kind}_${nextIndex}`);
      const node: DraftNode = {
        clientId: `node_${Date.now()}_${nextIndex}`,
        nodeKey,
        nodeKind: "INPUT",
        label: flowNodeLabel(kind, language),
        positionX: position.x,
        positionY: position.y,
        inputKind: kind === "input-file" ? "document" : "text",
        configuration: kind === "input-text" ? { promptText: "" } : { documentUrl: "" },
        isEnabled: true,
        isRequired: false,
      };
      setDraftNodes((current) => [...current, node]);
      setSelectedNodeId(node.clientId);
      return;
    }

    if (kind === "output") {
      commitHistory();
      const nodeKey = uniqueNodeKey(draftNodes, `output_${nextIndex}`);
      const node: DraftNode = {
        clientId: `node_${Date.now()}_${nextIndex}`,
        nodeKey,
        nodeKind: "OUTPUT",
        label: flowNodeLabel(kind, language),
        positionX: position.x,
        positionY: position.y,
        outputKind: "generic_result",
        configuration: {},
        isEnabled: true,
        isRequired: false,
      };
      setDraftNodes((current) => [...current, node]);
      setSelectedNodeId(node.clientId);
      return;
    }

    const tool = findToolForFlowNodeType(kind, tools);
    if (!tool) {
      toast.info(language === "en" ? `Backend tool is not configured for ${flowNodeLabel(kind, language)}.` : `Tool backend non configurato per ${flowNodeLabel(kind, language)}.`);
      return;
    }
    addToolNode(tool, position);
  };

  const handleDeleteSelected = () => {
    const selectedNodeIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    const selectedEdgeIds = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id));
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) {
      return;
    }
    commitHistory();
    setDraftNodes((current) => current.filter((node) => !selectedNodeIds.has(node.clientId)));
    setDraftEdges((current) =>
      current.filter((edge) =>
        !selectedEdgeIds.has(edge.clientId)
        && !selectedNodeIds.has(edge.sourceClientId)
        && !selectedNodeIds.has(edge.targetClientId),
      ),
    );
    setSelectedNodeId(null);
  };

  const handleUndo = () => {
    const previous = past[past.length - 1];
    if (!previous) {
      return;
    }
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [{ nodes: draftNodes, edges: draftEdges }, ...current]);
    setDraftNodes(previous.nodes);
    setDraftEdges(previous.edges);
    setSelectedNodeId(null);
  };

  const handleRedo = () => {
    const next = future[0];
    if (!next) {
      return;
    }
    setFuture((current) => current.slice(1));
    setPast((current) => [...current, { nodes: draftNodes, edges: draftEdges }]);
    setDraftNodes(next.nodes);
    setDraftEdges(next.edges);
    setSelectedNodeId(null);
  };

  const patchSelectedNode = (patch: Partial<DraftNode>) => {
    if (!selectedNode) {
      return;
    }
    setDraftNodes((current) => current.map((item) => item.clientId === selectedNode.clientId ? { ...item, ...patch } : item));
  };

  const patchSelectedConfig = (patch: Record<string, unknown>) => {
    if (!selectedNode) {
      return;
    }
    patchNodeConfiguration(selectedNode.clientId, patch);
  };

  const savePrompt = async () => {
    if (!selectedAgent) {
      return;
    }
    setIsSavingPrompt(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activePrompt: promptDraft }),
      });
      if (!response.ok) {
        throw new Error("Salvataggio prompt non riuscito.");
      }
      await loadCatalog();
      toast.success("Prompt aggiornato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio prompt.");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const resetPrompt = async () => {
    if (!selectedAgent) {
      return;
    }
    setIsSavingPrompt(true);
    try {
      const response = await fetch(`/api/agents/${selectedAgent.id}/reset-prompt`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Reset prompt non riuscito.");
      }
      const payload = (await response.json()) as { activePrompt?: string };
      setPromptDraft(payload.activePrompt ?? selectedAgent.originalPrompt);
      await loadCatalog();
      toast.success("Prompt ripristinato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore reset prompt.");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const saveWorkflow = async (options?: { quiet?: boolean }): Promise<WorkflowDetail | null> => {
    if (!workflow) {
      return null;
    }
    setIsSaving(true);
    try {
      const payloadNodes = draftNodes.map((node) => ({
        ...(node.id && uuidPattern.test(node.id) ? { id: node.id } : {}),
        nodeKey: node.nodeKey,
        nodeKind: node.nodeKind,
        label: node.label,
        positionX: node.positionX,
        positionY: node.positionY,
        moduleAgentId: node.moduleAgentId ?? null,
        moduleToolId: node.moduleToolId ?? null,
        inputKind: node.inputKind ?? null,
        outputKind: node.outputKind ?? null,
        configuration: normalizeNodeConfigurationForSave(node),
        inputSchema: node.inputSchema ?? null,
        outputSchema: node.outputSchema ?? null,
        isEnabled: node.isEnabled,
        isRequired: false,
      }));
      const nodeKeyByClientId = new Map(draftNodes.map((node) => [node.clientId, node.nodeKey]));
      const payloadEdges = draftEdges.map((edge, index) => ({
        ...(edge.id && uuidPattern.test(edge.id) ? { id: edge.id } : {}),
        sourceNodeKey: nodeKeyByClientId.get(edge.sourceClientId) ?? edge.sourceClientId,
        targetNodeKey: nodeKeyByClientId.get(edge.targetClientId) ?? edge.targetClientId,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        label: edge.label ?? null,
        conditionPayload: edge.conditionPayload ?? null,
        orderNo: index + 1,
        isEnabled: edge.isEnabled,
      }));
      const semanticNode = (node: typeof payloadNodes[number]) => JSON.stringify({
        nodeKey: node.nodeKey,
        nodeKind: node.nodeKind,
        label: node.label,
        moduleAgentId: node.moduleAgentId,
        moduleToolId: node.moduleToolId,
        inputKind: node.inputKind,
        outputKind: node.outputKind,
        configuration: node.configuration,
        inputSchema: node.inputSchema,
        outputSchema: node.outputSchema,
        isEnabled: node.isEnabled,
      });
      const storedNodeByKey = new Map(workflow.nodes.map((node) => [node.nodeKey, node]));
      const hasNodeChanges = payloadNodes.length !== workflow.nodes.length || payloadNodes.some((node) => {
        const stored = storedNodeByKey.get(node.nodeKey);
        if (!stored) return true;
        return semanticNode(node) !== JSON.stringify({
          nodeKey: stored.nodeKey,
          nodeKind: stored.nodeKind,
          label: stored.label,
          moduleAgentId: stored.moduleAgentId ?? null,
          moduleToolId: stored.moduleToolId ?? null,
          inputKind: stored.inputKind ?? null,
          outputKind: stored.outputKind ?? null,
          configuration: stored.configuration ?? {},
          inputSchema: stored.inputSchema ?? null,
          outputSchema: stored.outputSchema ?? null,
          isEnabled: stored.isEnabled,
        });
      });
      const storedEdges = workflow.edges.map((edge) => ({
        sourceNodeKey: workflow.nodes.find((node) => node.id === edge.sourceNodeId)?.nodeKey ?? edge.sourceNodeId,
        targetNodeKey: workflow.nodes.find((node) => node.id === edge.targetNodeId)?.nodeKey ?? edge.targetNodeId,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        label: edge.label ?? null,
        conditionPayload: edge.conditionPayload ?? null,
        orderNo: edge.orderNo,
        isEnabled: edge.isEnabled,
      }));
      const hasEdgeChanges = JSON.stringify(payloadEdges.map(({ id: _id, ...edge }) => edge)) !== JSON.stringify(storedEdges);

      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || workflow.label,
          description: description.trim() || null,
          configuration: {
            ...toRecord(workflow.configuration),
            contextPolicy: {
              ...toRecord(toRecord(workflow.configuration).contextPolicy),
              knowledgeMode,
            },
          },
          name: workflow.name,
          moduleKey: workflow.moduleKey,
          key: workflow.key,
          incrementVersion: hasNodeChanges || hasEdgeChanges,
          nodes: payloadNodes,
          edges: payloadEdges,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.message === "string" ? payload.message : "Salvataggio workflow non riuscito.");
      }
      const saved = (await response.json()) as WorkflowDetail;
      if (!options?.quiet) {
        toast.success("Workflow salvato.");
      }
      await loadWorkflow(workflow.id);
      await loadCatalog();
      return saved;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio workflow.");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const runWorkflow = async () => {
    if (!workflow) {
      return;
    }
    setIsRunning(true);
    try {
      const savedWorkflow = await saveWorkflow({ quiet: true });
      if (!savedWorkflow) {
        return;
      }
      const parsedInput = parseRunInput(runInputText);
      const workflowFiles = Object.fromEntries(
        draftNodes
          .map((node) => {
            const uploaded = uploadedFiles[node.clientId];
            return uploaded ? [node.nodeKey, uploaded] : null;
          })
          .filter((item): item is [string, UploadedWorkflowFile] => Boolean(item)),
      );
      const inputPayload = Object.keys(workflowFiles).length > 0
        ? { ...parsedInput, knowledgeMode, workflow_files: workflowFiles }
        : { ...parsedInput, knowledgeMode };
      const response = await fetch(`/api/workflows/${savedWorkflow.id}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triggerSource: "workflow_canvas", inputPayload }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(typeof payload?.message === "string" ? payload.message : "Avvio run non riuscito.");
      }
      const run = (await response.json()) as WorkflowRun;
      setLatestRun(run);
      setWorkflowRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setIsOutputFocused(false);
      toast.success("Run accodata.");
      await pollRun(run.id);
      await loadWorkflowRuns(savedWorkflow.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore avvio run.");
    } finally {
      setIsRunning(false);
    }
  };

  const pollRun = async (runId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const response = await fetch(`/api/workflow-runs/${runId}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const run = (await response.json()) as WorkflowRun;
      setLatestRun(run);
      if (run.status === "WAITING_FOR_DECISION") {
        toast.info("Il workflow e in attesa di una decisione nella dashboard.");
        return;
      }
      if (["COMPLETED", "FAILED", "CANCELED"].includes(run.status)) {
        if (run.status === "FAILED") {
          toast.error(run.errorMessage || "L'esecuzione del workflow non e' riuscita.");
        } else if (run.status === "CANCELED") {
          toast.warning("L'esecuzione del workflow e' stata annullata.");
        }
        return;
      }
    }
    toast.warning("L'esecuzione e' ancora in corso: controlla i risultati tra qualche istante.");
  };

  const onNodesChange = useCallback((changes: NodeChange<Node<CanvasNodeData>>[]) => {
    onNodesChangeBase(changes);
    const removedIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removedIds.size > 0) {
      setDraftNodes((current) => current.filter((draft) => !removedIds.has(draft.clientId)));
      setDraftEdges((current) => current.filter((edge) => !removedIds.has(edge.sourceClientId) && !removedIds.has(edge.targetClientId)));
      setSelectedNodeId((current) => current && removedIds.has(current) ? null : current);
      return;
    }
  }, [onNodesChangeBase]);

  const onNodeDragStop = useCallback<OnNodeDrag<Node<CanvasNodeData>>>((_, node) => {
    commitHistory();
    setDraftNodes((current) =>
      current.map((draft) =>
        draft.clientId === node.id
          ? { ...draft, positionX: node.position.x, positionY: node.position.y }
          : draft,
      ),
    );
  }, [commitHistory]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }
    const source = draftNodes.find((node) => node.clientId === connection.source);
    const target = draftNodes.find((node) => node.clientId === connection.target);
    const sourceType = source ? inferFlowNodeType(source, source.moduleToolId ? toolById.get(source.moduleToolId) ?? null : null) : null;
    const targetType = target ? inferFlowNodeType(target, target.moduleToolId ? toolById.get(target.moduleToolId) ?? null : null) : null;
    if (sourceType === "schedule" && (!["send-email", "send-telegram", "send-whatsapp"].includes(targetType ?? "") || connection.targetHandle !== "control:schedule")) {
      toast.error("Pianifica va collegato al connettore di pianificazione dei nodi Resoconto.");
      return;
    }
    commitHistory();
    const edge: DraftEdge = {
      clientId: `edge_${Date.now()}`,
      sourceClientId: connection.source,
      targetClientId: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      conditionPayload: null,
      orderNo: draftEdges.length + 1,
      isEnabled: true,
    };
    if ((connection.targetHandle ?? "").startsWith("field:")) {
      const defaultOutput = publicOutputOptions(source, sourceType)[0];
      if (defaultOutput) {
        edge.conditionPayload = { selected_output_key: defaultOutput.key };
      }
    }
    if (targetType === "verify-route" && /^field:rule_\d+$/.test(connection.targetHandle ?? "")) {
      const defaultOutput = publicOutputOptions(source, sourceType)[0];
      if (defaultOutput) {
        const ruleIndex = Number((connection.targetHandle ?? "").replace("field:rule_", ""));
        setDraftNodes((current) => current.map((node) => {
          if (node.clientId !== connection.target) return node;
          const rules = Array.isArray(node.configuration.rules) ? node.configuration.rules.map(toRecord) : [];
          if (!rules[ruleIndex]) return node;
          rules[ruleIndex] = { ...rules[ruleIndex], label: defaultOutput.label };
          return { ...node, configuration: { ...node.configuration, rules } };
        }));
      }
    }
    setDraftEdges((current) => [...current, edge]);
    setEdges((current) => addEdge({ ...connection, id: edge.clientId, animated: true }, current));
  }, [commitHistory, draftEdges.length, setEdges, toolById]);

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!connection.source || !connection.target) return false;
    const source = draftNodes.find((node) => node.clientId === connection.source);
    const target = draftNodes.find((node) => node.clientId === connection.target);
    if (!source || !target || source.clientId === target.clientId) return false;
    const sourceType = inferFlowNodeType(source, source.moduleToolId ? toolById.get(source.moduleToolId) ?? null : null);
    const targetType = inferFlowNodeType(target, target.moduleToolId ? toolById.get(target.moduleToolId) ?? null : null);
    if (["send-email", "send-telegram", "send-whatsapp"].includes(targetType ?? "") && connection.targetHandle === "control:schedule") {
      return sourceType === "schedule";
    }
    if (sourceType !== "schedule") return true;
    return ["send-email", "send-telegram", "send-whatsapp"].includes(targetType) && connection.targetHandle === "control:schedule";
  }, [draftNodes, toolById]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    onEdgesChangeBase(changes);
    const removedIds = new Set(changes.filter((change) => change.type === "remove").map((change) => change.id));
    if (removedIds.size > 0) {
      setDraftEdges((current) => current.filter((edge) => !removedIds.has(edge.clientId)));
    }
  }, [onEdgesChangeBase]);

  const onPaletteDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!flowInstance) {
      return;
    }
    const payload = parsePaletteDragPayload(event.dataTransfer.getData("application/x-birgus-workflow-node"));
    if (!payload) {
      return;
    }
    const position = flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (payload.kind === "FLOW") {
      addFlowNode(payload.id as FlowNodeType, position);
      return;
    }
    if (payload.kind === "AGENT") {
      const agent = agents.find((item) => item.id === payload.id);
      if (agent) {
        addAgentNode(agent, position);
      }
      return;
    }
    const tool = tools.find((item) => item.id === payload.id);
    if (tool) {
      addToolNode(tool, position);
    }
  }, [addFlowNode, agents, flowInstance, tools]);

  const onPaletteDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  if (screen === "modules") {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Text as="h1" variant="h1">Workflow</Text><PageHelpHint text={t("workflow.help")} /></div>
            <Text variant="muted">{t("workflow.subtitle")}</Text>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <Text as="h2" variant="h2" className="text-lg">{t("workflow.modules")}</Text>
            <Text variant="caption">{t("workflow.activeModules", { count: moduleCards.length })}</Text>
          </div>
          {moduleCards.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {moduleCards.map((card) => (
                <button
                  key={card.cardKey}
                  className="min-h-44 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-5 text-left shadow-card transition hover:border-brand-primary hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border-default disabled:hover:bg-bg-surface"
                  onClick={() => void openModule(card)}
                  disabled={isLoading || !card.workflow}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-bg-muted text-brand-primary">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-bold text-text-primary">{card.title}</p>
                  <p className="mt-2 min-h-10 text-sm text-text-muted">{card.description}</p>
                  <div className="mt-4 flex gap-2 text-xs text-text-muted">
                    <span>{t("workflow.agentCount", { count: card.agentsCount })}</span>
                    <span>{t("workflow.toolCount", { count: card.toolsCount })}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-dashed border-border-default bg-bg-surface p-6 text-sm text-text-muted">
              {t("workflow.noModuleWorkflows")}
            </div>
          )}
        </section>

        <section className="border-t border-border-subtle pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Text as="h2" variant="h2" className="text-lg">Playground</Text>
              <Text variant="caption">{t("workflow.freeWorkflows", { count: personalWorkflows.length + (playgroundCard.workflow ? 1 : 0) })}</Text>
            </div>
            <Button onClick={() => setIsCreateWorkflowOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("workflow.new")}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="min-h-32 border border-border-default bg-bg-surface p-4 shadow-card transition hover:border-brand-primary">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void openModule(playgroundCard)}
                  disabled={isLoading || isCreatingPlayground}
                >
                  <Sparkles className="h-5 w-5 text-brand-primary" />
                  <p className="mt-4 truncate text-sm font-semibold text-text-primary">{playgroundCard.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{playgroundCard.description}</p>
                </button>
                {playgroundCard.workflow ? (
                  <div className="flex gap-1">
                    <button type="button" title={t("workflow.copy")} aria-label={t("workflow.copy")} onClick={() => void copyPersonalWorkflow(playgroundCard.workflow!)} className="p-1.5 text-text-muted hover:bg-bg-muted hover:text-brand-primary"><Copy className="h-4 w-4" /></button>
                    <button type="button" title={t("workflow.delete")} aria-label={t("workflow.delete")} onClick={() => void deletePersonalWorkflow(playgroundCard.workflow!)} className="p-1.5 text-text-muted hover:bg-bg-muted hover:text-status-danger-text"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ) : null}
              </div>
            </div>
            {personalWorkflows.map((item) => (
              <div key={item.id} className="min-h-32 border border-border-default bg-bg-surface p-4 shadow-card transition hover:border-brand-primary">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => void loadWorkflow(item.id)} className="min-w-0 flex-1 text-left">
                    <Sparkles className="h-5 w-5 text-brand-primary" />
                    <p className="mt-4 truncate text-sm font-semibold text-text-primary">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.description || "Workflow libero"}</p>
                  </button>
                  <div className="flex gap-1">
                    <button type="button" title={t("workflow.copy")} aria-label={t("workflow.copy")} onClick={() => void copyPersonalWorkflow(item)} className="p-1.5 text-text-muted hover:bg-bg-muted hover:text-brand-primary"><Copy className="h-4 w-4" /></button>
                    <button type="button" title={t("workflow.delete")} aria-label={t("workflow.delete")} onClick={() => void deletePersonalWorkflow(item)} className="p-1.5 text-text-muted hover:bg-bg-muted hover:text-status-danger-text"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        {isCreateWorkflowOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="create-workflow-title">
            <Card className="w-full max-w-md p-5 shadow-elevated">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Text as="h2" variant="h2" className="text-lg" id="create-workflow-title">{t("workflow.new")}</Text>
                  <Text variant="muted">{t("workflow.createHint")}</Text>
                </div>
                <button type="button" onClick={() => setIsCreateWorkflowOpen(false)} className="rounded-md p-1 text-text-muted hover:bg-bg-muted hover:text-text-primary" aria-label={t("common.close")}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="mt-5 block space-y-2" htmlFor="new-workflow-name">
                <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t("workflow.name")}</span>
                <input
                  id="new-workflow-name"
                  value={newWorkflowLabel}
                  onChange={(event) => setNewWorkflowLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createPersonalWorkflow();
                    }
                  }}
                  autoFocus
                  className="h-11 w-full rounded-md border border-border-default bg-bg-page px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateWorkflowOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => void createPersonalWorkflow()} disabled={isCreatingWorkflow}>
                  {isCreatingWorkflow ? t("workflow.creating") : t("workflow.create")}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[640px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-bg-surface px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen("modules")}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-bg-page px-3 text-sm font-medium text-text-secondary hover:bg-bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("workflow.back")}
          </button>
          <label className="sr-only" htmlFor="workflow-name">{t("workflow.name")}</label>
          <input
            id="workflow-name"
            name="workflow-name"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-text-primary hover:border-border-default focus:border-border-default focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs font-medium text-text-secondary">
            {t("workflow.context")}
            <select
              id="workflow-knowledge-mode"
              name="workflow-knowledge-mode"
              value={knowledgeMode}
              onChange={(event) => setKnowledgeMode(event.target.value as WorkflowKnowledgeMode)}
              className="rounded border border-border-default bg-bg-surface px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
            >
              <option value="on_demand">{t("workflow.uploadedDocuments")}</option>
              <option value="hybrid">{t("workflow.workspaceKnowledge")}</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleUndo}
            disabled={past.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-page px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-muted disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            {t("workflow.undo")}
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={future.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-page px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-muted disabled:opacity-40"
          >
            <RotateCw className="h-4 w-4" />
            {t("workflow.redo")}
          </button>
          <button
            type="button"
            onClick={runWorkflow}
            disabled={!workflow || isRunning || isSaving}
            className="flex items-center gap-1.5 rounded-md border border-status-success-text bg-status-success-bg px-3 py-1.5 text-sm font-medium text-status-success-text hover:opacity-80 disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {isRunning ? t("workflow.running") : t("workflow.saveAndRun")}
          </button>
          <button
            type="button"
            onClick={() => void saveWorkflow()}
            disabled={!workflow || isSaving}
            className="flex items-center gap-1.5 rounded-md border border-brand-primary bg-brand-primary px-3 py-1.5 text-sm font-medium text-text-inverse shadow-brand hover:bg-brand-primary-hover disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t("workflow.saving") : t("common.save")}
          </button>
        </div>
      </div>

      <div className="border-b border-border-default bg-bg-page px-6 pt-2">
        <div className="flex min-w-max items-end gap-1" role="tablist" aria-label={t("workflow.nodeCategories")}>
          {TOOLBAR_GROUPS.map((group) => {
            const isActive = activeToolbarGroup.id === group.id;
            const groupLabel = language === "en" ? group.titleEn : group.title;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setOpenToolbarGroup(group.id)}
                className={cn(
                  "flex h-9 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
                  isActive ? NODE_CATEGORY_TAB_ACTIVE[group.category] : "border-transparent text-text-muted hover:bg-bg-muted hover:text-text-primary",
                )}
              >
                <span>{groupLabel}</span>
                <Badge tone={NODE_CATEGORY_BADGE_TONE[group.category]}>{group.items.length}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-border-default bg-bg-surface px-6 py-3" role="tabpanel">
        <div className="flex h-[66px] items-stretch gap-2 overflow-hidden">
          {featuredToolbarItems.map((kind) => {
            const Icon = NODE_KIND_ICONS[kind];
            return (
              <PaletteButton
                key={kind}
                className="min-w-0 flex-1"
                icon={<Icon className="h-4 w-4" />}
                title={flowNodeLabel(kind, language)}
                subtitle={flowNodeDescription(kind, language)}
                dragPayload={{ kind: "FLOW", id: kind }}
                onClick={() => addFlowNode(kind)}
              />
            );
          })}
          {hasMoreToolbarItems ? (
            <button
              type="button"
              title={t("workflow.openAllNodes")}
              aria-label={t("workflow.openAllNodes")}
              onClick={() => {
                setNodePickerQuery("");
                setNodePickerGroupId(activeToolbarGroup.id);
              }}
              className="flex w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-border-default bg-bg-page text-text-muted transition hover:border-brand-primary hover:bg-bg-subtle hover:text-brand-primary"
            >
              <LayoutGrid className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      {selectedEdge ? (() => {
        const condition = toRecord(selectedEdge.conditionPayload);
        const sourceNode = draftNodes.find((node) => node.clientId === selectedEdge.sourceClientId);
        const targetNode = draftNodes.find((node) => node.clientId === selectedEdge.targetClientId);
        const sourceType = sourceNode ? inferFlowNodeType(sourceNode, sourceNode.moduleToolId ? toolById.get(sourceNode.moduleToolId) ?? null : null) : null;
        const targetType = targetNode ? inferFlowNodeType(targetNode, targetNode.moduleToolId ? toolById.get(targetNode.moduleToolId) ?? null : null) : null;
        const isVerificationInput = targetType === "verify-route" && /^field:rule_\d+$/.test(selectedEdge.targetHandle ?? "");
        const isFieldInput = selectedEdge.targetHandle?.startsWith("field:") === true;
        const selectedOutputKey = typeof condition.selected_output_key === "string" ? condition.selected_output_key : "";
        const inputLabel = typeof condition.input_label === "string" ? condition.input_label : "";
        const outputOptions = publicOutputOptions(sourceNode, sourceType);
        const selectedOutput = outputOptions.find((option) => option.key === selectedOutputKey) ?? outputOptions[0];
        const hasCondition = Object.keys(condition).length > 0;
        const defaultPath = sourceNode ? `outputs.${sourceNode.nodeKey}.valid` : "outputs.node.output";
        return (
          <div className="flex flex-wrap items-end gap-3 border-b border-border-default bg-bg-page px-6 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">Instradamento del collegamento</p>
              <p className="truncate text-xs text-text-muted">{sourceNode?.label ?? "Nodo origine"} -&gt; {targetNode?.label ?? "Nodo destinazione"}</p>
            </div>
            {isFieldInput ? (
              <>
                <label className="grid min-w-[220px] gap-1 text-xs font-medium text-text-secondary">
                  {isVerificationInput ? "Valore da controllare" : "Dato inoltrato"}
                  <select
                    value={selectedOutputKey}
                    onChange={(event) => {
                      const selected = outputOptions.find((option) => option.key === event.target.value) ?? outputOptions[0];
                      selectFieldOutput(selectedEdge, event.target.value, selected?.label ?? "Output collegato");
                    }}
                    className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
                  >
                    {outputOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </label>
                <label className="grid min-w-[180px] gap-1 text-xs font-medium text-text-secondary">
                  Nome nel workflow
                  <input
                    value={inputLabel}
                    onChange={(event) => setFieldInputLabel(selectedEdge, event.target.value, selectedOutput?.label ?? "Output collegato")}
                    placeholder={selectedOutput?.label ?? "Output collegato"}
                    className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 text-text-secondary">
                  <input
                    type="checkbox"
                    checked={hasCondition}
                    onChange={(event) => patchEdgeCondition(selectedEdge.clientId, event.target.checked ? { path: defaultPath, operator: "truthy" } : null)}
                  />
                  Esegui solo se la condizione e valida
                </label>
                {hasCondition ? (
                  <p className="text-xs text-text-muted">Le condizioni avanzate esistenti restano attive. Per una verifica leggibile usa Verifica e instrada.</p>
                ) : null}
              </>
            )}
          </div>
        );
      })() : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ReactFlow<Node<CanvasNodeData>, Edge>
            key={workflow?.id ?? "workflow-canvas"}
            className="workflow-react-flow h-full w-full"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
              setIsOutputFocused(false);
              setOutputPreviewNodeId(null);
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setIsOutputFocused(false);
              setOutputPreviewNodeId(null);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedNodeId(null);
              setSelectedEdgeId(edge.id);
              setIsOutputFocused(false);
              setOutputPreviewNodeId(null);
            }}
            onNodesDelete={() => setSelectedNodeId(null)}
            onInit={setFlowInstance}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <RunResultsPanel
          expandedResultCard={expandedResultCard}
          isCollapsed={isRunsPanelCollapsed}
          isLoadingRuns={isLoadingRuns}
          isOutputFocused={isOutputFocused}
          latestRun={latestRun}
          latestRunReference={latestRunReference}
          nodeLabelByKey={nodeLabelByKey}
          runs={workflowRuns}
          onSelectRun={(runId) => void selectWorkflowRun(runId)}
          onToggleCollapsed={() => setIsRunsPanelCollapsed((current) => !current)}
          onToggleCard={(cardId) => setExpandedResultCard((current) => current === cardId ? null : cardId)}
        />
      </div>
      <WorkflowOutputDialog
        isOpen={outputPreviewNodeId !== null}
        latestRun={latestRun}
        nodeKey={draftNodes.find((node) => node.clientId === outputPreviewNodeId)?.nodeKey ?? null}
        nodeLabel={draftNodes.find((node) => node.clientId === outputPreviewNodeId)?.label ?? flowNodeLabel("output", language)}
        onClose={() => setOutputPreviewNodeId(null)}
      />
      {nodePickerGroup ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="workflow-node-picker-title">
          <Card className="flex max-h-[80vh] w-full max-w-5xl flex-col p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Text as="h2" variant="h2" className="text-lg" id="workflow-node-picker-title">{language === "en" ? nodePickerGroup.titleEn : nodePickerGroup.title}</Text>
                <Text variant="muted">{t("workflow.nodesAvailable", { count: nodePickerGroup.items.length })}</Text>
              </div>
              <button type="button" onClick={() => setNodePickerGroupId(null)} className="rounded-md p-1 text-text-muted hover:bg-bg-muted hover:text-text-primary" aria-label={t("workflow.closeNodePicker")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              value={nodePickerQuery}
              onChange={(event) => setNodePickerQuery(event.target.value)}
              placeholder={t("workflow.searchNode")}
              autoFocus
              className="mt-4 h-10 w-full rounded-md border border-border-default bg-bg-page px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
            />
            <div className="mt-3 grid min-h-0 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
              {nodePickerItems.map((kind) => {
                const Icon = NODE_KIND_ICONS[kind];
                return <PaletteButton key={kind} icon={<Icon className="h-4 w-4" />} title={flowNodeLabel(kind, language)} subtitle={flowNodeDescription(kind, language)} dragPayload={{ kind: "FLOW", id: kind }} onClick={() => { addFlowNode(kind); setNodePickerGroupId(null); }} />;
              })}
              {nodePickerItems.length === 0 ? <p className="col-span-full py-8 text-center text-sm text-text-muted">{t("workflow.noNodesFound")}</p> : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
