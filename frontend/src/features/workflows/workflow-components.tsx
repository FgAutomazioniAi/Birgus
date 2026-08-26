"use client";

import { cloneElement, isValidElement, useEffect, useId, useState, type DragEvent, type ReactElement, type ReactNode } from "react";
import { Check, ChevronDown, Clock, FileText, HelpCircle, Mail, MessageCircle, Plus, Send, Settings, Sparkles } from "lucide-react";

import { Badge, Input, Text } from "@/components/atoms";
import { cn } from "@/lib/cn";
import type { WorkflowRun, WorkflowTool } from "./types";
import {
  formatPayload,
  formatResultPreview,
  formatDateTime,
  stringValue,
  textareaClassName,
  type PaletteDragPayload,
} from "./workflow-model";

interface ConnectedTelegramChannel {
  id: string;
  recipientId: string;
  label: string;
}

export function TelegramChannelField({
  value,
  manualChatId,
  idPrefix = "workflow-telegram",
  onChange,
  onManualChatIdChange,
}: {
  value: string;
  manualChatId: string;
  idPrefix?: string;
  onChange: (channelId: string) => void;
  onManualChatIdChange: (chatId: string) => void;
}) {
  const [channels, setChannels] = useState<ConnectedTelegramChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    fetch("/api/connected-apps?provider=telegram", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return { apps: [] };
        }
        return (await response.json()) as { apps?: ConnectedTelegramChannel[] };
      })
      .then((payload) => {
        if (isActive) {
          setChannels(payload.apps ?? []);
        }
      })
      .catch(() => {
        if (isActive) {
          setChannels([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="space-y-2">
      <select
        id={`${idPrefix}-channel`}
        name={`${idPrefix}-channel`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary outline-none focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-ring-primary"
      >
        <option value="">{isLoading ? "Caricamento Telegram..." : "Chat ID manuale"}</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.label} - {channel.recipientId}
          </option>
        ))}
      </select>
      {!value ? (
        <Input
          id={`${idPrefix}-chat-id`}
          name={`${idPrefix}-chat-id`}
          value={manualChatId}
          onChange={(event) => onManualChatIdChange(event.target.value)}
          placeholder="-"
        />
      ) : null}
    </div>
  );
}

export function RunResultsPanel({
  expandedResultCard,
  isLoadingRuns,
  isOutputFocused,
  latestRun,
  latestRunReference,
  nodeLabelByKey,
  runs,
  onSelectRun,
  onToggleCard,
}: {
  expandedResultCard: string | null;
  isLoadingRuns: boolean;
  isOutputFocused: boolean;
  latestRun: WorkflowRun | null;
  latestRunReference: string;
  nodeLabelByKey: Map<string, string>;
  runs: WorkflowRun[];
  onSelectRun: (runId: string) => void;
  onToggleCard: (cardId: string) => void;
}) {
  return (
    <aside className="w-96 shrink-0 overflow-y-auto border-l border-border-default bg-bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Esecuzioni</h3>
        {isLoadingRuns ? <span className="text-xs text-text-muted">Caricamento...</span> : null}
      </div>
      {runs.length > 0 ? (
        <div className="mb-4 flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
          {runs.map((run) => {
            const isSelected = latestRun?.id === run.id;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(run.id)}
                className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition ${isSelected ? "border-brand-primary bg-bg-subtle" : "border-border-subtle bg-bg-page hover:border-brand-primary/40"}`}
              >
                <span className="min-w-0 truncate text-xs font-medium text-text-secondary">
                  {formatDateTime(run.completedAt ?? run.startedAt ?? run.queuedAt)}
                </span>
                <Badge tone={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "warn" : "progress"}>{run.status}</Badge>
              </button>
            );
          })}
        </div>
      ) : null}
      {!latestRun ? (
        <p className="text-sm text-text-muted">Esegui il workflow o seleziona un'esecuzione per vedere gli output effettivi.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-border-default bg-bg-page p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Esecuzione</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{latestRunReference}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={latestRun.status === "COMPLETED" ? "success" : latestRun.status === "FAILED" ? "warn" : "progress"}>
                {latestRun.status}
              </Badge>
              {latestRun.triggerSource ? <Badge tone="info">{latestRun.triggerSource}</Badge> : null}
            </div>
          </div>
          {latestRun.errorMessage ? <p className="text-sm text-status-danger-text">{latestRun.errorMessage}</p> : null}
          {isOutputFocused ? (
            <div className="rounded-md border border-brand-primary bg-bg-subtle p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Output finale</p>
              {latestRun.resultPayload !== undefined && latestRun.resultPayload !== null ? (
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border-default bg-bg-surface p-3 text-xs leading-5 text-text-secondary">
                  {formatPayload(latestRun.resultPayload)}
                </pre>
              ) : (
                <p className="mt-2 text-sm text-text-muted">L'output apparirà al completamento dell'esecuzione.</p>
              )}
            </div>
          ) : null}
          {(latestRun.steps ?? []).map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onToggleCard(step.id)}
              className="rounded-md border border-border-subtle bg-bg-page p-2 text-left transition-colors hover:border-brand-primary/40 hover:bg-bg-muted"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-text-primary">
                    {step.sequenceNo ? `${step.sequenceNo}. ` : ""}
                    {step.label ?? nodeLabelByKey.get(step.stepKey ?? step.nodeKey ?? "") ?? "Passaggio"}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs text-text-secondary">
                    {formatResultPreview(step.outputPayload ?? step.errorMessage ?? "Nessun output")}
                  </p>
                </div>
                <Badge tone={step.status === "SUCCEEDED" ? "success" : step.status === "FAILED" ? "warn" : "progress"}>
                  {step.status}
                </Badge>
              </div>
              {step.errorMessage ? <p className="mt-1 text-xs text-status-danger-text">{step.errorMessage}</p> : null}
              {expandedResultCard === step.id && step.outputPayload !== undefined && step.outputPayload !== null ? (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-bg-surface p-2 text-xs text-text-secondary">
                  {formatPayload(step.outputPayload)}
                </pre>
              ) : null}
            </button>
          ))}
          {!isOutputFocused && latestRun.resultPayload !== undefined && latestRun.resultPayload !== null ? (
            <button
              type="button"
              onClick={() => onToggleCard("final")}
              className="rounded-md border border-border-subtle bg-bg-page p-2 text-left transition-colors hover:border-brand-primary/40 hover:bg-bg-muted"
            >
              <p className="text-xs font-semibold text-text-primary">Risultato finale</p>
              <p className="mt-1 line-clamp-3 text-xs text-text-secondary">{formatResultPreview(latestRun.resultPayload)}</p>
              {expandedResultCard === "final" ? (
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-bg-surface p-2 text-xs text-text-secondary">
                  {formatPayload(latestRun.resultPayload)}
                </pre>
              ) : null}
            </button>
          ) : null}
        </div>
      )}
    </aside>
  );
}

export function WorkflowCheckbox({
  checked,
  help,
  label,
  onChange,
}: {
  checked: boolean;
  help?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const id = `workflow-checkbox-${useId().replace(/:/g, "")}`;

  return (
    <div className="relative flex items-center gap-1.5">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
        />
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border transition",
            checked
              ? "border-brand-primary bg-brand-primary text-text-inverse"
              : "border-border-default bg-bg-page text-transparent",
          )}
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
        <span>{label}</span>
      </label>
      {help ? (
        <>
          <button
            type="button"
            className="rounded-full p-0.5 text-text-muted hover:bg-bg-muted hover:text-text-primary"
            onClick={() => setIsHelpOpen((current) => !current)}
            aria-label={`Info ${label}`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
          {isHelpOpen ? (
            <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-md border border-border-default bg-bg-surface p-3 text-xs leading-relaxed text-text-secondary shadow-elevated">
              {help}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function PaletteSection({ title, count, defaultOpen = false, children }: { title: string; count: number; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="palette-group" open={defaultOpen}>
      <summary className="palette-group-toggle">
        <span>{title}</span>
        <Badge tone={count > 0 ? "info" : "warn"}>{count}</Badge>
      </summary>
      <div className="palette-group-body">
        {count > 0 ? children : <Text variant="muted">Nessun elemento disponibile per questo workflow.</Text>}
      </div>
    </details>
  );
}

export function PaletteButton({
  icon,
  title,
  subtitle,
  dragPayload,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  dragPayload: PaletteDragPayload;
  onClick: () => void;
}) {
  const onDragStart = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData("application/x-birgus-workflow-node", JSON.stringify(dragPayload));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <button
      className="group flex w-full items-center gap-3 rounded-md border border-transparent bg-bg-page px-3 py-2.5 text-left transition hover:border-brand-primary/40 hover:bg-bg-muted"
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      type="button"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-surface text-brand-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-text-primary">{title}</strong>
        <small className="mt-0.5 block truncate text-xs text-text-muted">{subtitle}</small>
      </span>
      <Plus className="h-4 w-4 shrink-0 text-text-muted transition group-hover:text-brand-primary" />
    </button>
  );
}

export function ToolbarDropdown({
  children,
  count,
  isOpen,
  onOpenChange,
  title,
}: {
  children: ReactNode;
  count: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md border border-border-default bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary transition hover:border-brand-primary/40 hover:bg-bg-muted"
        onClick={() => onOpenChange(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <Badge tone={count > 0 ? "info" : "warn"}>{count}</Badge>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-lg border border-border-default bg-bg-surface p-2 shadow-elevated">
          <div className="mb-2 border-b border-border-subtle px-2 pb-2">
            <p className="text-xs font-bold uppercase text-brand-primary">{title}</p>
            <p className="mt-0.5 text-xs text-text-muted">Seleziona un nodo da aggiungere al canvas.</p>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function ToolConfigurationForm({
  tool,
  configuration,
  onPatch,
}: {
  tool: WorkflowTool;
  configuration: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const action = tool.handlerKey.split(".")[1] ?? tool.key;

  if (tool.handlerKey.startsWith("langchain_orchestrator.")) {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">Agent request</Text>
        </div>
        {action === "compose_email" ? (
          <>
            <Field label="Tono">
              <Input value={stringValue(configuration.tone)} onChange={(event) => onPatch({ tone: event.target.value })} placeholder="professionale" />
            </Field>
            <Field label="Istruzioni extra">
              <textarea className={textareaClassName} value={stringValue(configuration.extra_instructions)} onChange={(event) => onPatch({ extra_instructions: event.target.value })} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Istruzioni">
              <textarea className={textareaClassName} value={stringValue(configuration.instructions)} onChange={(event) => onPatch({ instructions: event.target.value })} />
            </Field>
            {action === "chat" ? (
              <WorkflowCheckbox
                checked={configuration.use_deep_reasoning === true}
                label="Self-Discover"
                help="Aggiunge una fase di ragionamento strutturato prima della risposta. Di solito migliora analisi complesse, ma impiega piu tempo."
                onChange={(checked) => onPatch({ use_deep_reasoning: checked })}
              />
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (tool.handlerKey === "docx_engine.generate_document") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">Documento</Text>
        </div>
        <Field label="Titolo">
          <Input value={stringValue(configuration.title)} onChange={(event) => onPatch({ title: event.target.value })} />
        </Field>
        <Field label="Formato">
          <select
            className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary"
            value={stringValue(configuration.format) || "docx"}
            onChange={(event) => onPatch({ format: event.target.value })}
          >
            <option value="docx">DOCX</option>
            <option value="pdf">PDF</option>
          </select>
        </Field>
        <Field label="Nome file">
          <Input value={stringValue(configuration.file_name)} onChange={(event) => onPatch({ file_name: event.target.value })} placeholder="documento.docx" />
        </Field>
      </div>
    );
  }

  if (tool.handlerKey === "document_intelligence.analyze_document_set") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">Documenti</Text>
        </div>
        <Field label="Document IDs">
          <textarea
            className={textareaClassName}
            value={stringValue(configuration.documentIds)}
            onChange={(event) => onPatch({ documentIds: event.target.value })}
            placeholder="Uno per riga"
          />
        </Field>
        <Field label="Richiesta">
          <textarea
            className={textareaClassName}
            value={stringValue(configuration.prompt)}
            onChange={(event) => onPatch({ prompt: event.target.value })}
            placeholder="Riassumi i documenti"
          />
        </Field>
        <WorkflowCheckbox
          checked={configuration.use_deep_reasoning === true}
          label="Self-Discover"
          help="Aggiunge una fase di ragionamento strutturato prima della risposta. Di solito migliora analisi complesse, ma impiega piu tempo."
          onChange={(checked) => onPatch({ use_deep_reasoning: checked })}
        />
      </div>
    );
  }

  if (tool.handlerKey === "mail_engine.send_email") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">Email</Text>
        </div>
        <Field label="Destinatario">
          <Input value={stringValue(configuration.to)} onChange={(event) => onPatch({ to: event.target.value })} placeholder="cliente@example.com" />
        </Field>
        <Field label="Oggetto opzionale">
          <Input value={stringValue(configuration.subject)} onChange={(event) => onPatch({ subject: event.target.value })} />
        </Field>
        <Field label="Testo opzionale">
          <textarea className={textareaClassName} value={stringValue(configuration.text)} onChange={(event) => onPatch({ text: event.target.value })} />
        </Field>
      </div>
    );
  }

  if (tool.handlerKey === "messaging_engine.send_telegram") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <Send className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">Telegram</Text>
        </div>
        <Field label="Destinazione">
          <TelegramChannelField
            value={stringValue(configuration.telegram_channel_id)}
            manualChatId={stringValue(configuration.chat_id)}
            onChange={(channelId) => onPatch({ telegram_channel_id: channelId, chat_id: channelId ? "" : stringValue(configuration.chat_id) })}
            onManualChatIdChange={(chatId) => onPatch({ chat_id: chatId })}
          />
        </Field>
        <Field label="Messaggio opzionale">
          <textarea className={textareaClassName} value={stringValue(configuration.text)} onChange={(event) => onPatch({ text: event.target.value })} />
        </Field>
      </div>
    );
  }

  if (tool.handlerKey === "messaging_engine.send_whatsapp") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">WhatsApp</Text>
        </div>
        <Field label="Numero">
          <Input value={stringValue(configuration.to)} onChange={(event) => onPatch({ to: event.target.value })} placeholder="393..." />
        </Field>
        <Field label="Messaggio opzionale">
          <textarea className={textareaClassName} value={stringValue(configuration.text)} onChange={(event) => onPatch({ text: event.target.value })} />
        </Field>
      </div>
    );
  }

  if (tool.handlerKey === "workflow_scheduler.schedule_report_delivery") {
    return (
      <div className="rounded-[var(--radius-md)] border border-border-default p-3">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-primary" />
          <Text className="font-bold">Schedule</Text>
        </div>
        <Field label="Quando">
          <Input
            type="datetime-local"
            value={stringValue(configuration.scheduleWhen)}
            onChange={(event) => onPatch({ scheduleWhen: event.target.value })}
          />
        </Field>
        <Field label="Ripeti ogni">
          <div className="grid grid-cols-[1fr_1fr] gap-2">
            <Input
              type="number"
              min={1}
              value={stringValue(configuration.scheduleRepeatValue)}
              onChange={(event) => onPatch({ scheduleRepeatValue: event.target.value })}
              placeholder="7"
            />
            <select
              className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary"
              value={stringValue(configuration.scheduleRepeatUnit) || "days"}
              onChange={(event) => onPatch({ scheduleRepeatUnit: event.target.value })}
            >
              <option value="hours">ore</option>
              <option value="days">giorni</option>
            </select>
          </div>
        </Field>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-border-default p-3">
      <div className="mb-2 flex items-center gap-2">
        <Settings className="h-4 w-4 text-brand-primary" />
        <Text className="font-bold">Configurazione</Text>
      </div>
      <Text variant="muted">Questo tool usa la configurazione predefinita del catalogo.</Text>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const generatedId = `workflow-field-${useId().replace(/:/g, "")}`;
  const controlId = isValidElement(children) && typeof children.props.id === "string"
    ? children.props.id
    : generatedId;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; name?: string }>, {
        id: controlId,
        name: children.props.name ?? generatedId,
      })
    : children;

  return (
    <label className="block space-y-2" htmlFor={controlId}>
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      {control}
    </label>
  );
}
