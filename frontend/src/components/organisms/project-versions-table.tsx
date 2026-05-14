"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Columns3,
  Eye,
  FileDown,
  PlusCircle,
  Save,
  Truck,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { PageHelpHint, SearchField } from "@/components/molecules";
import { cn } from "@/lib/cn";
import { downloadTablePdf } from "@/lib/pdf-export";
import { PROJECT_STATUS_OPTIONS, getProjectStatusLabel } from "@/lib/project-status";
import { APP_ROUTES } from "@/lib/routes";
import { scheduleUndoableAction } from "@/lib/undoable-action";
import type { ProjectStatus } from "@/lib/types";

interface ProjectVersionRow {
  id: number;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
  description: string;
  isDefault: boolean;
  status: ProjectStatus;
  shipmentCode: string | null;
  shipmentId: string | null;
  shipmentStatusKey: string | null;
  versionLabel: string;
}

interface VersionsPayload {
  selectedVersionLabel?: string;
  versions: ProjectVersionRow[];
}

interface ProjectSummary {
  projectName: string;
}

interface ClientItem {
  id: string;
  name: string;
}

type VersionColumnKey = "description" | "versionLabel" | "clientName" | "shipment" | "status" | "createdAt" | "actions";

interface VersionColumnDef {
  cellClassName?: string;
  key: VersionColumnKey;
  label: string;
  render: (version: ProjectVersionRow) => ReactNode;
  required: boolean;
}

interface StoredColumnConfig {
  hidden: VersionColumnKey[];
  order: VersionColumnKey[];
}

interface ProjectVersionsTableProps {
  id: string;
}

const VERSION_COLUMNS_STORAGE_KEY = "vl_project_versions_table_columns_v1";
const DEFAULT_VERSION_COLUMN_ORDER: VersionColumnKey[] = [
  "description",
  "versionLabel",
  "clientName",
  "shipment",
  "status",
  "createdAt",
  "actions",
];

const VERSION_COLUMN_DEFS: VersionColumnDef[] = [
  {
    key: "description",
    label: "Descrizione",
    required: true,
    render: (version) => version.description,
  },
  {
    key: "versionLabel",
    label: "Versione",
    required: false,
    render: (version) => version.versionLabel,
    cellClassName: "font-mono text-xs text-brand-primary",
  },
  {
    key: "clientName",
    label: "Cliente",
    required: false,
    render: (version) => version.clientName ?? "N/D",
  },
  {
    key: "shipment",
    label: "Spedizione",
    required: false,
    render: (version) =>
      version.shipmentCode
        ? `${version.shipmentCode}${version.shipmentStatusKey ? ` (${formatShipmentStatus(version.shipmentStatusKey)})` : ""}`
        : "Non collegata",
    cellClassName: "text-xs text-text-secondary",
  },
  {
    key: "status",
    label: "Stato",
    required: false,
    render: (version) => getProjectStatusLabel(version.status),
  },
  {
    key: "createdAt",
    label: "Creata il",
    required: false,
    render: (version) => formatDate(version.createdAt),
  },
  {
    key: "actions",
    label: "Azioni",
    required: true,
    render: () => null,
    cellClassName: "text-right",
  },
];

const isVersionColumnKey = (value: string): value is VersionColumnKey =>
  DEFAULT_VERSION_COLUMN_ORDER.includes(value as VersionColumnKey);

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("it-IT");
}

function formatShipmentStatus(value: string | null): string {
  switch (value) {
    case "draft":
      return "Bozza";
    case "prepared":
      return "Preparata";
    case "shipped":
      return "Spedita";
    case "delivered":
      return "Consegnata";
    default:
      return value ?? "-";
  }
}

export function ProjectVersionsTable({ id }: ProjectVersionsTableProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [versions, setVersions] = useState<ProjectVersionRow[]>([]);
  const [selectedVersionLabel, setSelectedVersionLabel] = useState("v1");
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<ProjectStatus>(PROJECT_STATUS_OPTIONS[0].key);
  const [newClientId, setNewClientId] = useState<string>("");
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<VersionColumnKey[]>(DEFAULT_VERSION_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<VersionColumnKey[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedRow = useMemo(
    () => versions.find((version) => version.versionLabel === selectedVersionLabel) ?? versions[0] ?? null,
    [selectedVersionLabel, versions],
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [projectResponse, versionsResponse, clientsResponse] = await Promise.all([
        fetch(`/api/projects/${id}`, { cache: "no-store" }),
        fetch(`/api/projects/${id}/versions`, { cache: "no-store" }),
        fetch("/api/clients", { cache: "no-store" }),
      ]);

      if (!projectResponse.ok || !versionsResponse.ok || !clientsResponse.ok) {
        throw new Error("Errore caricamento dati");
      }

      const project = (await projectResponse.json()) as ProjectSummary;
      const versionsPayload = (await versionsResponse.json()) as VersionsPayload;
      const clientsPayload = (await clientsResponse.json()) as ClientItem[];

      setProjectName(project.projectName);
      setVersions(versionsPayload.versions ?? []);
      setSelectedVersionLabel(
        versionsPayload.selectedVersionLabel ??
        versionsPayload.versions?.find((version) => version.isDefault)?.versionLabel ??
        versionsPayload.versions?.[0]?.versionLabel ??
        "v1",
      );
      setClients(clientsPayload);

      const suggestedClientId =
        versionsPayload.versions?.find((version) => version.isDefault)?.clientId ??
        versionsPayload.versions?.[0]?.clientId ??
        clientsPayload[0]?.id ??
        "";
      const suggestedStatus =
        versionsPayload.versions?.find((version) => version.isDefault)?.status ??
        PROJECT_STATUS_OPTIONS[0].key;

      setNewClientId(suggestedClientId ?? "");
      setNewStatus(suggestedStatus);
    } catch {
      toast.error("Impossibile caricare le versioni progetto.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!columnsMenuRef.current) {
        return;
      }

      if (!columnsMenuRef.current.contains(event.target as Node)) {
        setIsColumnsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const applyColumnConfig = (config: Partial<StoredColumnConfig> | null | undefined) => {
    if (!config) {
      return;
    }

    const parsedOrder = Array.isArray(config.order)
      ? config.order.filter((column): column is VersionColumnKey => isVersionColumnKey(String(column)))
      : [];
    const uniqueOrder = Array.from(new Set(parsedOrder));
    const nextOrder = DEFAULT_VERSION_COLUMN_ORDER.filter((column) => uniqueOrder.includes(column));
    const missing = DEFAULT_VERSION_COLUMN_ORDER.filter((column) => !nextOrder.includes(column));
    setColumnOrder([...nextOrder, ...missing]);

    const parsedHidden = Array.isArray(config.hidden)
      ? config.hidden.filter((column): column is VersionColumnKey => isVersionColumnKey(String(column)))
      : [];
    const optionalColumns = new Set(VERSION_COLUMN_DEFS.filter((column) => !column.required).map((column) => column.key));
    setHiddenColumns(parsedHidden.filter((column) => optionalColumns.has(column)));
  };

  useEffect(() => {
    const storedRaw = window.localStorage.getItem(VERSION_COLUMNS_STORAGE_KEY);
    if (!storedRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(storedRaw) as Partial<StoredColumnConfig>;
      applyColumnConfig(parsed);
    } catch {
      setColumnOrder(DEFAULT_VERSION_COLUMN_ORDER);
      setHiddenColumns([]);
    }
  }, []);

  useEffect(() => {
    const payload: StoredColumnConfig = { order: columnOrder, hidden: hiddenColumns };
    window.localStorage.setItem(VERSION_COLUMNS_STORAGE_KEY, JSON.stringify(payload));
  }, [columnOrder, hiddenColumns]);

  const selectVersion = async (versionLabel: string) => {
    try {
      setSelectedVersionLabel(versionLabel);
      const response = await fetch(`/api/projects/${id}/versions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionLabel }),
      });

      if (!response.ok) {
        throw new Error("Switch versione fallito");
      }

      const payload = (await response.json()) as VersionsPayload;
      if (payload.versions?.length) {
        setVersions(payload.versions);
      }
      toast.success(`Versione attiva: ${versionLabel.toUpperCase()}`);
    } catch {
      toast.error("Impossibile impostare la versione attiva.");
    }
  };

  const createVersion = async () => {
    if (newDescription.trim().length < 2) {
      toast.error("Inserisci una descrizione di almeno 2 caratteri.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/projects/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: newClientId || null,
          description: newDescription.trim(),
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Creazione versione fallita");
      }

      const payload = (await response.json()) as VersionsPayload & { selectedVersionLabel?: string };
      setVersions(payload.versions ?? []);
      setSelectedVersionLabel(payload.selectedVersionLabel ?? "v1");
      setNewDescription("");
      toast.success("Nuova versione creata.");
    } catch {
      toast.error("Impossibile creare la nuova versione.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const createClientInline = async () => {
    if (!newClientName.trim() || !newClientEmail.trim() || !newClientPhone.trim() || !newClientNotes.trim()) {
      toast.error("Compila tutti i campi del cliente.");
      return;
    }

    try {
      setIsCreatingClient(true);
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newClientEmail.trim(),
          name: newClientName.trim(),
          notes: newClientNotes.trim(),
          phone: newClientPhone.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Creazione cliente fallita");
      }

      const created = (await response.json()) as ClientItem;
      const refreshedResponse = await fetch("/api/clients", { cache: "no-store" });
      const refreshed = refreshedResponse.ok ? ((await refreshedResponse.json()) as ClientItem[]) : [...clients, created];
      setClients(refreshed);
      setNewClientId(created.id);
      setIsClientModalOpen(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientNotes("");
      toast.success("Cliente creato con successo.");
    } catch {
      toast.error("Impossibile creare il cliente.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const deleteVersion = (version: ProjectVersionRow) => {
    const previousVersions = versions;
    const previousSelectedVersionLabel = selectedVersionLabel;

    const filtered = versions.filter((item) => item.versionLabel !== version.versionLabel);
    setVersions(filtered);
    if (previousSelectedVersionLabel === version.versionLabel) {
      setSelectedVersionLabel(filtered[0]?.versionLabel ?? "v1");
    }

    scheduleUndoableAction({
      pendingMessage: `Versione ${version.versionLabel.toUpperCase()} in archiviazione...`,
      successMessage: "Versione archiviata.",
      errorMessage: "Archiviazione versione non riuscita.",
      rollback: () => {
        setVersions(previousVersions);
        setSelectedVersionLabel(previousSelectedVersionLabel);
      },
      commit: async () => {
        const response = await fetch(`/api/projects/${id}/versions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmText: "cancella",
            versionLabel: version.versionLabel,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ message: "Errore archiviazione versione" }))) as { message?: string };
          throw new Error(payload.message ?? "Errore archiviazione versione");
        }

        const payload = (await response.json()) as VersionsPayload;
        setVersions(payload.versions ?? []);
        setSelectedVersionLabel(payload.selectedVersionLabel ?? "v1");
      },
    });
  };

  const filteredVersions = useMemo(
    () =>
      versions.filter((version) => {
        const lowered = searchTerm.toLowerCase();
        return (
          version.description.toLowerCase().includes(lowered) ||
          version.versionLabel.toLowerCase().includes(lowered) ||
          (version.clientName ?? "").toLowerCase().includes(lowered) ||
          (version.shipmentCode ?? "").toLowerCase().includes(lowered) ||
          getProjectStatusLabel(version.status).toLowerCase().includes(lowered) ||
          formatDate(version.createdAt).toLowerCase().includes(lowered)
        );
      }),
    [searchTerm, versions],
  );

  const visibleColumns = useMemo(() => {
    const ordered = columnOrder
      .map((key) => VERSION_COLUMN_DEFS.find((column) => column.key === key))
      .filter((column): column is VersionColumnDef => Boolean(column));
    return ordered.filter((column) => !hiddenColumns.includes(column.key));
  }, [columnOrder, hiddenColumns]);

  const totalVisibleColumns = Math.max(visibleColumns.length, 1);

  const toggleColumnVisibility = (key: VersionColumnKey) => {
    const column = VERSION_COLUMN_DEFS.find((item) => item.key === key);
    if (!column || column.required) {
      return;
    }

    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const moveColumn = (key: VersionColumnKey, direction: "up" | "down") => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) {
        return prev;
      }

      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const exportVersionsPdf = async () => {
    if (!filteredVersions.length) {
      toast.error("Nessuna versione da esportare.");
      return;
    }

    try {
      setIsExporting(true);
      await downloadTablePdf({
        columns: [
          { key: "description", label: "Descrizione" },
          { key: "versionLabel", label: "Versione" },
          { key: "clientName", label: "Cliente" },
          { key: "status", label: "Stato" },
          { key: "createdAt", label: "Creata il" },
        ],
        filename: `versioni-${projectName || "progetto"}-${new Date().toISOString().slice(0, 10)}.pdf`,
        rows: filteredVersions.map((version) => ({
          clientName: version.clientName ?? "N/D",
          createdAt: formatDate(version.createdAt),
          description: version.description,
          status: getProjectStatusLabel(version.status),
          versionLabel: version.versionLabel,
        })),
        subtitle: `Progetto: ${projectName || id} · Totale versioni esportate: ${filteredVersions.length}`,
        title: "Elenco Versionamenti Progetto",
      });
      toast.success("PDF versionamenti generato con successo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'esportazione versionamenti.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(APP_ROUTES.projects)}
            className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2 text-text-secondary transition-colors hover:bg-bg-muted hover:text-brand-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Text as="h1" variant="h1">
                {projectName || "Versionamenti progetto"}
              </Text>
              <PageHelpHint text="Crea e gestisci le versioni del progetto." />
            </div>
            <Text variant="muted">Cliente e stato sono gestiti per singola versione</Text>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(APP_ROUTES.projectEdit(id))}
          className="h-11 rounded-[var(--radius-md)] px-4"
        >
          <Eye size={18} />
          Apri Documenti
        </Button>
      </div>

      <Card className="overflow-hidden p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Nuova Versione</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            maxLength={80}
            placeholder="Descrizione breve"
            disabled={isSubmitting}
          />
          <select
            value={newStatus}
            onChange={(event) => setNewStatus(event.target.value as ProjectStatus)}
            disabled={isSubmitting}
            className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {PROJECT_STATUS_OPTIONS.map((status) => (
              <option key={status.key} value={status.key}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr),auto,auto]">
          <select
            value={newClientId}
            onChange={(event) => setNewClientId(event.target.value)}
            disabled={isSubmitting}
            className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Nessun cliente associato</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => setIsClientModalOpen(true)} className="h-11 px-4">
            <PlusCircle size={16} />
            Nuovo cliente
          </Button>
          <Button type="button" onClick={() => void createVersion()} disabled={isSubmitting} className="h-11 px-4">
            <Save size={16} />
            Crea versione
          </Button>
        </div>
      </Card>

      <Card className="overflow-visible">
        <div className="flex flex-col justify-between gap-4 border-b border-border-subtle p-4 md:flex-row md:items-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Versionamenti</h3>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <SearchField
              className="w-full md:w-80"
              placeholder="Ricerca versioni..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
            <div className="flex items-center gap-2">
              <div className="relative" ref={columnsMenuRef}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-lg px-3 py-2 font-medium"
                  onClick={() => setIsColumnsMenuOpen((prev) => !prev)}
                >
                  <Columns3 size={18} />
                  Colonne
                </Button>

                {isColumnsMenuOpen && (
                  <div className="absolute right-0 top-12 z-20 w-80 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3 shadow-elevated">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Configura colonne</p>
                    <p className="mt-1 text-xs text-text-muted">Mostra, nascondi e riordina le colonne della tabella.</p>

                    <div className="mt-3 space-y-2">
                      {columnOrder.map((key, index) => {
                        const column = VERSION_COLUMN_DEFS.find((item) => item.key === key);
                        if (!column) {
                          return null;
                        }

                        const hidden = hiddenColumns.includes(column.key);
                        return (
                          <div
                            key={column.key}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-muted px-2.5 py-2"
                          >
                            <label className="flex items-center gap-2 text-sm text-text-secondary">
                              <input
                                type="checkbox"
                                checked={!hidden}
                                disabled={column.required}
                                onChange={() => toggleColumnVisibility(column.key)}
                                className="h-4 w-4 accent-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                              />
                              <span className={cn("font-medium", column.required ? "text-text-primary" : "text-text-secondary")}>
                                {column.label}
                              </span>
                              {column.required && <span className="text-[10px] font-bold uppercase text-brand-primary">🔒</span>}
                            </label>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveColumn(column.key, "up")}
                                disabled={index === 0}
                                className="rounded-md border border-border-default p-1 text-text-muted transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={`Sposta in alto ${column.label}`}
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => moveColumn(column.key, "down")}
                                disabled={index === columnOrder.length - 1}
                                className="rounded-md border border-border-default p-1 text-text-muted transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={`Sposta in basso ${column.label}`}
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-lg px-3 py-2 font-medium"
                onClick={() => void exportVersionsPdf()}
                disabled={isExporting}
              >
                <FileDown size={16} />
                Esporta
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-bg-muted/70">
              <tr>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted",
                      column.key === visibleColumns[visibleColumns.length - 1]?.key ? "text-right" : "text-left",
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredVersions.map((version) => (
                <tr key={version.versionLabel} className="transition-colors hover:bg-bg-muted/60">
                  {visibleColumns.map((column) => (
                    <td key={`${version.versionLabel}-${column.key}`} className={cn("px-6 py-4", column.cellClassName)}>
                      {column.key === "actions" ? (
                        <div className="flex items-center justify-end gap-2">
                          {version.shipmentId && (
                            <button
                              type="button"
                              onClick={() => router.push(APP_ROUTES.shipmentDetail(version.shipmentId as string))}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-status-info-border px-2.5 text-[11px] font-medium text-status-info-text transition-colors hover:bg-status-info-bg"
                            >
                              <Truck size={12} />
                              Spedizione
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void selectVersion(version.versionLabel)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border-default px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                          >
                            Imposta attiva
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteVersion(version)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-status-danger-border px-2.5 text-[11px] font-medium text-status-danger-text transition-colors hover:bg-status-danger-bg"
                          >
                            <Trash2 size={12} />
                            Archivia
                          </button>
                        </div>
                      ) : column.key === "description" ? (
                        <span className="text-sm font-semibold text-text-secondary">
                          {version.description}
                          {version.isDefault && (
                            <span className="ml-2 rounded-md bg-status-info-bg px-1.5 py-0.5 text-[10px] font-bold text-status-info-text">
                              Attiva
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className={cn("text-sm", column.key === "createdAt" ? "text-text-muted" : "text-text-secondary")}>
                          {column.render(version)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && filteredVersions.length === 0 && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Nessuna versione disponibile.
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Caricamento versioni...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedRow && (
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Versione attiva</p>
          <p className="mt-1 text-sm font-semibold text-text-secondary">
            {selectedRow.description} ({selectedRow.versionLabel.toUpperCase()})
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Cliente: {selectedRow.clientName ?? "N/D"} · Stato: {selectedRow.status}
          </p>
        </Card>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-border-default bg-bg-surface p-5 shadow-elevated">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Nuovo Cliente</h3>
            {/*<p className="mt-1 text-xs text-text-muted"></p>*/}
            <div className="mt-4 grid grid-cols-1 gap-3">
              <Input value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="Nome e cognome" />
              <Input type="email" value={newClientEmail} onChange={(event) => setNewClientEmail(event.target.value)} placeholder="Email" />
              <Input value={newClientPhone} onChange={(event) => setNewClientPhone(event.target.value)} placeholder="Telefono" />
              <Input value={newClientNotes} onChange={(event) => setNewClientNotes(event.target.value)} placeholder="Note" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsClientModalOpen(false)}
                disabled={isCreatingClient}
              >
                <X size={16} />
                Annulla
              </Button>
              <Button type="button" onClick={() => void createClientInline()} disabled={isCreatingClient}>
                <Save size={16} />
                Salva cliente
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/*
guarda tutto il progetto, quando hai fatto vorrei due info:
una che vorrei capire i passaggi corretti per caricare tutte le modifiche su git (ho già una repo con alcune modifiche,
*/
