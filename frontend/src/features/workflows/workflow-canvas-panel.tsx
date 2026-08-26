"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
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
  GitBranch,
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

import { Badge, Button, Card, Text } from "@/components/atoms";
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
  formatDateTime,
  isAiRequestFlowNodeType,
  isAdvancedLangChainTool,
  isAgentTool,
  isLangChainTool,
  inferFlowNodeType,
  MAX_WORKFLOW_UPLOAD_BYTES,
  NODE_KIND_BORDER,
  NODE_KIND_ICONS,
  NODE_KIND_LABELS,
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
import { PaletteButton, PaletteSection, RunResultsPanel, TelegramChannelField, ToolbarDropdown, ToolConfigurationForm, WorkflowCheckbox } from "./workflow-components";

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
  if (tool.handlerKey === "document_intelligence.analyze_document_set") {
    return "Analizza i documenti collegati e produci una risposta chiara, citando gli elementi rilevanti.";
  }
  if (tool.handlerKey === "langchain_orchestrator.chat") {
    return "Rispondi in modo chiaro, operativo e coerente con l'input ricevuto dal workflow.";
  }
  return "";
}

function FlowNodeCard({ data, selected }: NodeProps<Node<CanvasNodeData>>) {
  const [isDefaultPromptOpen, setIsDefaultPromptOpen] = useState(false);
  const [defaultPromptDraft, setDefaultPromptDraft] = useState("");
  const [isConfirmingDefaultPrompt, setIsConfirmingDefaultPrompt] = useState(false);
  const Icon = NODE_KIND_ICONS[data.type] ?? (data.paletteKind === "AGENT" ? Bot : data.paletteKind === "TOOL" ? Wrench : nodeKindIcon[data.kind]);
  const hasTarget = data.type !== "input-text";
  const hasSource = data.type !== "output";
  const config = data.configuration;
  const isAiRequestNode = isAiRequestFlowNodeType(data.type);
  const currentPrompt = currentPromptFromConfiguration(config);
  const defaultPrompt = defaultPromptFromConfiguration(config);
  const manualInputDisabled = data.hasInputSource;
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
  const manualInputHint = manualInputDisabled ? (
    <p className="text-[11px] leading-snug text-text-muted">Input ricevuto dal nodo collegato.</p>
  ) : null;

  useEffect(() => {
    setDefaultPromptDraft(defaultPrompt);
    setIsConfirmingDefaultPrompt(false);
  }, [data.nodeId, defaultPrompt]);

  return (
    <div
      className={cn(
        "w-64 rounded-lg border-2 bg-bg-surface p-3 shadow-card",
        NODE_KIND_BORDER[data.type],
        selected ? "ring-2 ring-ring-primary" : "",
      )}
    >
      {hasTarget ? <Handle type="target" position={Position.Left} /> : null}
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-primary" />
        <span className="text-sm font-medium text-text-primary">{data.label}</span>
      </div>

      {data.type === "input-text" ? (
        <textarea
          id={fieldId("promptText")}
          name={fieldId("promptText")}
          value={stringConfig("promptText")}
          onChange={(event) => patchConfig("promptText", event.target.value)}
          placeholder="Enter the prompt text..."
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
            placeholder="What should this look up?"
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          <select
            id={fieldId("category")}
            name={fieldId("category")}
            value={stringConfig("category")}
            onChange={(event) => patchConfig("category", event.target.value)}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          >
            <option value="">All categories</option>
            <option value="contract">Contract</option>
            <option value="quotation">Quotation</option>
            <option value="other">Other</option>
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
            placeholder="Document IDs, uno per riga"
            rows={3}
            disabled={manualInputDisabled}
            className={inputClassName}
          />
          <textarea
            id={fieldId("prompt")}
            name={fieldId("prompt")}
            value={currentPrompt}
            onChange={(event) => patchCurrentPrompt(event.target.value)}
            placeholder="Richiesta, es. riassumi i documenti"
            rows={2}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          {manualInputHint}
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
          <textarea
            id={fieldId("input_text")}
            name={fieldId("input_text")}
            value={stringConfig("input_text")}
            onChange={(event) => patchConfig("input_text", event.target.value)}
            placeholder={manualInputDisabled ? "Input dal nodo collegato" : "Leave blank to use the previous step's output"}
            rows={2}
            disabled={manualInputDisabled}
            className={inputClassName}
          />
          <textarea
            id={fieldId("instructions")}
            name={fieldId("instructions")}
            value={currentPrompt}
            onChange={(event) => patchCurrentPrompt(event.target.value)}
            placeholder="Instructions"
            rows={3}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          {manualInputHint}
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
            placeholder={manualInputDisabled ? "Input dal nodo collegato" : "Leave blank to use the previous step's output"}
            rows={2}
            disabled={manualInputDisabled}
            className={inputClassName}
          />
          <textarea
            id={fieldId("structure-instructions")}
            name={fieldId("structure-instructions")}
            value={currentPrompt}
            onChange={(event) => patchCurrentPrompt(event.target.value)}
            placeholder="Instructions (required)"
            rows={3}
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
          {manualInputHint}
        </div>
      ) : null}

      {data.type === "generate-document" || data.type === "quotation-docx" ? (
        <div className="nodrag flex flex-col gap-1">
          <textarea
            id={fieldId(data.type === "quotation-docx" ? "quotationDataJson" : "content")}
            name={fieldId(data.type === "quotation-docx" ? "quotationDataJson" : "content")}
            value={stringConfig(data.type === "quotation-docx" ? "quotationDataJson" : "content")}
            onChange={(event) => patchConfig(data.type === "quotation-docx" ? "quotationDataJson" : "content", event.target.value)}
            placeholder={manualInputDisabled ? "Input dal nodo collegato" : data.type === "quotation-docx" ? "Quotation data JSON" : "Document content"}
            rows={3}
            disabled={manualInputDisabled}
            className={inputClassName}
          />
          {manualInputHint}
          <input
            id={fieldId("file_name")}
            name={fieldId("file_name")}
            type="text"
            value={stringConfig("file_name")}
            onChange={(event) => patchConfig("file_name", event.target.value)}
            placeholder="File name"
            className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
          />
        </div>
      ) : null}

      {data.type === "send-email" ? (
        <div className="nodrag flex flex-col gap-1">
          <input id={fieldId("to")} name={fieldId("to")} type="email" value={stringConfig("to")} onChange={(event) => patchConfig("to", event.target.value)} placeholder="Recipient email" className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <input id={fieldId("subject")} name={fieldId("subject")} type="text" value={stringConfig("subject")} onChange={(event) => patchConfig("subject", event.target.value)} placeholder="Subject" className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <textarea id={fieldId("text")} name={fieldId("text")} value={stringConfig("text")} onChange={(event) => patchConfig("text", event.target.value)} placeholder={manualInputDisabled ? "Input dal nodo collegato" : "Body (leave blank to use previous output)"} rows={3} disabled={manualInputDisabled} className={inputClassName} />
          {manualInputHint}
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
          <textarea id={fieldId("text")} name={fieldId("text")} value={stringConfig("text")} onChange={(event) => patchConfig("text", event.target.value)} placeholder={manualInputDisabled ? "Input dal nodo collegato" : "Message (leave blank to use previous output)"} rows={3} disabled={manualInputDisabled} className={inputClassName} />
          {manualInputHint}
        </div>
      ) : null}

      {data.type === "send-whatsapp" ? (
        <div className="nodrag flex flex-col gap-1">
          <input id={fieldId("to")} name={fieldId("to")} type="tel" value={stringConfig("to")} onChange={(event) => patchConfig("to", event.target.value)} placeholder="WhatsApp number, es. 393..." className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <textarea id={fieldId("text")} name={fieldId("text")} value={stringConfig("text")} onChange={(event) => patchConfig("text", event.target.value)} placeholder={manualInputDisabled ? "Input dal nodo collegato" : "Message (leave blank to use previous output)"} rows={3} disabled={manualInputDisabled} className={inputClassName} />
          {manualInputHint}
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
          <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
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
                className="w-1/2 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs normal-case tracking-normal text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
              />
              <select
                id={fieldId("scheduleRepeatUnit")}
                name={fieldId("scheduleRepeatUnit")}
                value={stringConfig("scheduleRepeatUnit") || "days"}
                onChange={(event) => patchConfig("scheduleRepeatUnit", event.target.value)}
                className="w-1/2 rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs normal-case tracking-normal text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
              >
                <option value="hours">ore</option>
                <option value="days">giorni</option>
              </select>
            </div>
          </label>
          <p className="text-xs text-text-muted">
            Collegalo direttamente a Email, Telegram o WhatsApp: il nodo collegato verra' pianificato e non inviato subito.
          </p>
        </div>
      ) : null}

      {data.type === "compose-email" ? (
        <div className="nodrag flex flex-col gap-1">
          <textarea id={fieldId("context")} name={fieldId("context")} value={stringConfig("context")} onChange={(event) => patchConfig("context", event.target.value)} placeholder={manualInputDisabled ? "Input dal nodo collegato" : "What's the email about?"} rows={2} disabled={manualInputDisabled} className={inputClassName} />
          <input id={fieldId("tone")} name={fieldId("tone")} type="text" value={stringConfig("tone")} onChange={(event) => patchConfig("tone", event.target.value)} placeholder="Tone (professionale)" className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          <textarea id={fieldId("extra_instructions")} name={fieldId("extra_instructions")} value={currentPrompt} onChange={(event) => patchCurrentPrompt(event.target.value)} placeholder="Extra instructions" rows={2} className="w-full rounded-md border border-border-default bg-bg-page px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
          {manualInputHint}
        </div>
      ) : null}

      {data.type === "check-mailbox" ? (
        <p className="text-xs text-text-muted">Checks the inbox and processes attachments when this workflow runs.</p>
      ) : null}

      {isAiRequestNode ? (
        <div className="nodrag relative mt-2 border-t border-border-subtle pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-semibold text-text-muted hover:bg-bg-muted hover:text-text-primary"
            onClick={() => setIsDefaultPromptOpen((current) => !current)}
            aria-expanded={isDefaultPromptOpen}
          >
            <span>Prompt default</span>
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
              <p className="text-xs font-semibold text-text-primary">Aggiornare il prompt default?</p>
              <p className="mt-1 text-xs text-text-muted">Cambiera' il template salvato per questo nodo.</p>
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

      {hasSource ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

const nodeTypes = { workflowNode: FlowNodeCard };

export function WorkflowCanvasPanel() {
  const { enabledModuleKeys } = useModuleAccess();
  const [screen, setScreen] = useState<WorkflowScreen>("modules");
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [tools, setTools] = useState<WorkflowTool[]>([]);
  const [agents, setAgents] = useState<WorkflowAgent[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [draftNodes, setDraftNodes] = useState<DraftNode[]>([]);
  const [draftEdges, setDraftEdges] = useState<DraftEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
  const [expandedResultCard, setExpandedResultCard] = useState<string | null>(null);
  const [openToolbarGroup, setOpenToolbarGroup] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [runInputText, setRunInputText] = useState("{}");
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedWorkflowFile>>({});
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<Node<CanvasNodeData>, Edge> | null>(null);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<CanvasNodeData>>([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);

  const selectedNode = useMemo(
    () => draftNodes.find((item) => item.clientId === selectedNodeId) ?? null,
    [draftNodes, selectedNodeId],
  );
  const toolById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const selectedAgent = selectedNode?.moduleAgentId ? agentById.get(selectedNode.moduleAgentId) ?? null : null;
  const selectedTool = selectedNode?.moduleToolId ? toolById.get(selectedNode.moduleToolId) ?? null : null;
  const moduleCards = useMemo(() => buildModuleCards(workflows, tools, agents, enabledModuleKeys), [agents, enabledModuleKeys, tools, workflows]);
  const playgroundCard = useMemo<ModuleCard>(() => {
    const playground = workflows.find((item) => item.key === PLAYGROUND_KEY) ?? null;
    return {
      cardKey: "playground",
      moduleKey: "workflow_management",
      title: "Playground",
      description: "Area libera per costruire e provare workflow senza aumentare i workflow dei moduli.",
      workflow: playground,
      agentsCount: agents.length + tools.filter(isAgentTool).length,
      toolsCount: tools.filter((tool) => !isAgentTool(tool)).length,
      isPlayground: true,
    };
  }, [agents.length, tools, workflows]);
  const nodeLabelByKey = useMemo(() => new Map(draftNodes.map((node) => [node.nodeKey, cleanWorkflowLabel(node.label)])), [draftNodes]);
  const inputSourceTargetIds = useMemo(() => {
    const inputNodeIds = new Set(draftNodes.filter((node) => node.nodeKind === "INPUT").map((node) => node.clientId));
    return new Set(
      draftEdges
        .filter((edge) => edge.isEnabled && inputNodeIds.has(edge.sourceClientId))
        .map((edge) => edge.targetClientId),
    );
  }, [draftEdges, draftNodes]);
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
      inputSourceTargetIds.has(item.clientId),
      patchNodeConfiguration,
      handleNodeFileChange,
    )));
    setEdges(draftEdges.map(toFlowEdge));
  }, [agentById, draftEdges, draftNodeStructureKey, handleNodeFileChange, inputSourceTargetIds, patchNodeConfiguration, setEdges, setNodes, toolById, uploadedFiles]);

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
    setOpenToolbarGroup(null);
    const nextIndex = draftNodes.length + 1;
    const position = dropPosition ?? { x: 100 + nextIndex * 40, y: 100 + nextIndex * 40 };

    if (kind === "input-text" || kind === "input-file") {
      commitHistory();
      const nodeKey = uniqueNodeKey(draftNodes, `${kind}_${nextIndex}`);
      const node: DraftNode = {
        clientId: `node_${Date.now()}_${nextIndex}`,
        nodeKey,
        nodeKind: "INPUT",
        label: NODE_KIND_LABELS[kind],
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
        label: NODE_KIND_LABELS[kind],
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
      toast.info(`Tool backend non configurato per ${NODE_KIND_LABELS[kind]}.`);
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
        conditionPayload: null,
        orderNo: index + 1,
        isEnabled: edge.isEnabled,
      }));

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
    commitHistory();
    const edge: DraftEdge = {
      clientId: `edge_${Date.now()}`,
      sourceClientId: connection.source,
      targetClientId: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      orderNo: draftEdges.length + 1,
      isEnabled: true,
    };
    setDraftEdges((current) => [...current, edge]);
    setEdges((current) => addEdge({ ...connection, id: edge.clientId, animated: true }, current));
  }, [commitHistory, draftEdges.length, setEdges]);

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
            <Text as="h1" variant="h1">Workflow</Text>
            <Text variant="muted">Scegli un modulo o crea un workflow libero da un playground vuoto.</Text>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <Text as="h2" variant="h2" className="text-lg">Workflow moduli</Text>
            <Text variant="caption">{moduleCards.length} moduli attivi</Text>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-bg-muted text-brand-primary">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <Badge tone={card.workflow ? "success" : "info"}>{card.workflow ? `v${card.workflow.versionNo}` : "Non configurato"}</Badge>
                  </div>
                  <p className="mt-4 text-base font-bold text-text-primary">{card.title}</p>
                  <p className="mt-2 min-h-10 text-sm text-text-muted">{card.description}</p>
                  <div className="mt-4 flex gap-2 text-xs text-text-muted">
                    <span>{card.agentsCount} agent</span>
                    <span>{card.toolsCount} tool</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-dashed border-border-default bg-bg-surface p-6 text-sm text-text-muted">
              Nessun workflow modulo disponibile per i moduli attivi.
            </div>
          )}
        </section>

        <section className="border-t border-border-subtle pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Text as="h2" variant="h2" className="text-lg">Playground</Text>
              <Text variant="caption">{personalWorkflows.length + (playgroundCard.workflow ? 1 : 0)} workflow liberi</Text>
            </div>
            <Button onClick={() => setIsCreateWorkflowOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuovo workflow
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <button
              key={playgroundCard.cardKey}
              className="min-h-32 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-4 text-left shadow-card transition hover:border-brand-primary hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void openModule(playgroundCard)}
              disabled={isLoading || isCreatingPlayground}
            >
              <div className="flex items-start justify-between gap-3">
                <Sparkles className="h-5 w-5 text-brand-primary" />
                <Badge tone={playgroundCard.workflow ? "success" : "progress"}>{playgroundCard.workflow ? `v${playgroundCard.workflow.versionNo}` : "Crea"}</Badge>
              </div>
              <p className="mt-4 truncate text-sm font-semibold text-text-primary">{playgroundCard.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">{playgroundCard.description}</p>
            </button>
            {personalWorkflows.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void loadWorkflow(item.id)}
                  className="min-h-32 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-4 text-left shadow-card transition hover:border-brand-primary hover:bg-bg-subtle"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Sparkles className="h-5 w-5 text-brand-primary" />
                    <Badge tone={item.isEnabled ? "success" : "warn"}>{item.isEnabled ? "Attivo" : "Disattivo"}</Badge>
                  </div>
                  <p className="mt-4 truncate text-sm font-semibold text-text-primary">{item.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.description || "Workflow libero"}</p>
                </button>
            ))}
          </div>
        </section>
        {isCreateWorkflowOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="create-workflow-title">
            <Card className="w-full max-w-md p-5 shadow-elevated">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Text as="h2" variant="h2" className="text-lg" id="create-workflow-title">Nuovo workflow</Text>
                  <Text variant="muted">Parte vuoto: Input e Output, senza copiare alcun flusso esistente.</Text>
                </div>
                <button type="button" onClick={() => setIsCreateWorkflowOpen(false)} className="rounded-md p-1 text-text-muted hover:bg-bg-muted hover:text-text-primary" aria-label="Chiudi">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="mt-5 block space-y-2" htmlFor="new-workflow-name">
                <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Nome</span>
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
                <Button variant="outline" onClick={() => setIsCreateWorkflowOpen(false)}>Annulla</Button>
                <Button onClick={() => void createPersonalWorkflow()} disabled={isCreatingWorkflow}>
                  {isCreatingWorkflow ? "Creazione..." : "Crea workflow"}
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
            Indietro
          </button>
          <label className="sr-only" htmlFor="workflow-name">Nome workflow</label>
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
            Contesto
            <select
              id="workflow-knowledge-mode"
              name="workflow-knowledge-mode"
              value={knowledgeMode}
              onChange={(event) => setKnowledgeMode(event.target.value as WorkflowKnowledgeMode)}
              className="rounded border border-border-default bg-bg-surface px-2 py-1 text-xs text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
            >
              <option value="on_demand">Documenti caricati</option>
              <option value="hybrid">Knowledge workspace</option>
            </select>
          </label>
          {TOOLBAR_GROUPS.map((group) => (
            <ToolbarDropdown
              key={group.title}
              count={group.items.length}
              isOpen={openToolbarGroup === group.title}
              onOpenChange={(isOpen) => setOpenToolbarGroup(isOpen ? group.title : null)}
              title={group.title}
            >
              {group.items.map((kind) => {
                const Icon = NODE_KIND_ICONS[kind];
                return (
                  <PaletteButton
                    key={kind}
                    icon={<Icon className="h-4 w-4" />}
                    title={NODE_KIND_LABELS[kind]}
                    subtitle={flowNodeDescription(kind)}
                    dragPayload={{ kind: "FLOW", id: kind }}
                    onClick={() => addFlowNode(kind)}
                  />
                );
              })}
            </ToolbarDropdown>
          ))}
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-page px-3 py-1.5 text-sm font-medium text-status-danger-text hover:bg-bg-muted"
          >
            <Trash2 className="h-4 w-4" />
            Elimina selezionati
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={past.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-page px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-muted disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            Annulla
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={future.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-border-default bg-bg-page px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-muted disabled:opacity-40"
          >
            <RotateCw className="h-4 w-4" />
            Ripristina
          </button>
          <button
            type="button"
            onClick={runWorkflow}
            disabled={!workflow || isRunning || isSaving}
            className="flex items-center gap-1.5 rounded-md border border-status-success-text bg-status-success-bg px-3 py-1.5 text-sm font-medium text-status-success-text hover:opacity-80 disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {isRunning ? "Esecuzione..." : "Salva ed esegui"}
          </button>
          <button
            type="button"
            onClick={() => void saveWorkflow()}
            disabled={!workflow || isSaving}
            className="flex items-center gap-1.5 rounded-md border border-brand-primary bg-brand-primary px-3 py-1.5 text-sm font-medium text-text-inverse shadow-brand hover:bg-brand-primary-hover disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>

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
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              const isOutputNode = node.data.type === "output";
              setIsOutputFocused(isOutputNode);
              if (isOutputNode && latestRun?.resultPayload !== undefined && latestRun.resultPayload !== null) {
                setExpandedResultCard("final");
              }
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setIsOutputFocused(false);
              setOpenToolbarGroup(null);
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
          isLoadingRuns={isLoadingRuns}
          isOutputFocused={isOutputFocused}
          latestRun={latestRun}
          latestRunReference={latestRunReference}
          nodeLabelByKey={nodeLabelByKey}
          runs={workflowRuns}
          onSelectRun={(runId) => void selectWorkflowRun(runId)}
          onToggleCard={(cardId) => setExpandedResultCard((current) => current === cardId ? null : cardId)}
        />
      </div>
    </div>
  );
}
