"use client";

import { Database, FileText, FolderKanban, LoaderCircle, Package, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";
import { ConfirmDeleteDialog } from "@/components/molecules/confirm-delete-dialog";
import { PageHelpHint } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { cn } from "@/lib/cn";

type ArchivePackageKey = "complete" | "projects";
type ArchiveArea = "documents" | "trash";
type ActiveDocumentContainer = "all" | "modules" | "playgrounds";

interface ArchivePackageSummary {
  key: ArchivePackageKey;
  label: string;
  description: string;
  count: number;
}

interface ArchivedItemDto {
  id: string;
  entityType: "project" | "project_version" | "document";
  entityId: string;
  archivedAt: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  versionLabel: string | null;
  fileName: string | null;
  scope: string | null;
}

interface ArchiveApiResponse {
  selectedPackage: ArchivePackageKey;
  packages: ArchivePackageSummary[];
  items: ArchivedItemDto[];
}

interface ActiveDocumentContainerSummary {
  key: ActiveDocumentContainer;
  label: string;
  description: string;
  count: number;
}

interface ActiveDocumentDto {
  id: string;
  filename: string;
  sizeBytes: number | null;
  createdAt: string;
  extension: string | null;
  moduleName: string | null;
  moduleKey: string | null;
  nodePath: string;
  container: "modules" | "playgrounds" | "other";
  knowledgeStatus: "indexed" | "processing" | "not_indexed";
}

interface ActiveDocumentsApiResponse {
  selectedContainer: ActiveDocumentContainer;
  containers: ActiveDocumentContainerSummary[];
  documents: ActiveDocumentDto[];
}

const DEFAULT_PACKAGES: ArchivePackageSummary[] = [
  {
    key: "complete",
    label: "Completo",
    description: "Tutti gli elementi archiviati",
    count: 0,
  },
  {
    key: "projects",
    label: "Progetti",
    description: "Archivio riferito ai progetti",
    count: 0,
  },
];
const formatArchivedAt = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const formatFileSize = (sizeBytes: number | null): string => {
  if (sizeBytes === null) {
    return "-";
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const knowledgeStatusLabel: Record<ActiveDocumentDto["knowledgeStatus"], string> = {
  indexed: "In knowledge",
  processing: "In elaborazione",
  not_indexed: "Non indicizzato",
};

const toEntityTypeLabel = (entityType: ArchivedItemDto["entityType"]): string => {
  switch (entityType) {
    case "project":
      return "Progetto";
    case "project_version":
      return "Versione";
    case "document":
      return "Documento";
    default:
      return "Elemento";
  }
};

const toDetails = (item: ArchivedItemDto): string => {
  if (item.entityType === "project_version" && item.versionLabel) {
    return `Versione ${item.versionLabel.toUpperCase()}`;
  }


  if (item.entityType === "document") {
    const scope = item.scope?.replace(/_/g, " ").toLowerCase();
    if (scope) {
      return `Scope ${scope}`;
    }
  }

  return "-";
};

export function ArchivePanel() {
  const { language, t } = useLanguage();
  const [activeArea, setActiveArea] = useState<ArchiveArea>("documents");
  const [selectedPackage, setSelectedPackage] = useState<ArchivePackageKey>("complete");
  const [packages, setPackages] = useState<ArchivePackageSummary[]>(DEFAULT_PACKAGES);
  const [items, setItems] = useState<ArchivedItemDto[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ActiveDocumentContainer>("all");
  const [documentContainers, setDocumentContainers] = useState<ActiveDocumentContainerSummary[]>([]);
  const [documents, setDocuments] = useState<ActiveDocumentDto[]>([]);
  const [documentQuery, setDocumentQuery] = useState("");
  const [knowledgeFilter, setKnowledgeFilter] = useState<"all" | "indexed" | "not_indexed">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false);

  const loadArchive = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/archive?package=${encodeURIComponent(selectedPackage)}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Caricamento archivio non riuscito.");
      }

      const payload = (await response.json()) as ArchiveApiResponse;
      setPackages(payload.packages);
      setItems(payload.items);
    } catch {
      toast.error("Impossibile caricare l'archivio.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const search = new URLSearchParams({
        container: selectedContainer,
        knowledge: knowledgeFilter,
      });
      if (documentQuery.trim()) {
        search.set("query", documentQuery.trim());
      }
      const response = await fetch(`/api/archive/documents?${search.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Caricamento documenti non riuscito.");
      }
      const payload = (await response.json()) as ActiveDocumentsApiResponse;
      setDocumentContainers(payload.containers);
      setDocuments(payload.documents);
    } catch {
      toast.error("Impossibile caricare i documenti.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeArea === "documents") {
      void loadDocuments();
      return;
    }
    void loadArchive();
  }, [activeArea, selectedPackage, selectedContainer, documentQuery, knowledgeFilter]);

  const restoreItem = async (item: ArchivedItemDto) => {
    try {
      setProcessingItemId(item.id);
      const response = await fetch(`/api/archive/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.entityId)}/restore`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: "Ripristino non riuscito." }))) as { message?: string };
        throw new Error(payload.message ?? "Ripristino non riuscito.");
      }

      toast.success("Elemento ripristinato.");
      await loadArchive();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ripristino non riuscito.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const permanentlyDeleteItem = async (item: ArchivedItemDto) => {
    setProcessingItemId(item.id);
    try {
      const response = await fetch(`/api/archive/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.entityId)}/permanent`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: "cancella" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: "Eliminazione permanente non riuscita." }))) as { message?: string };
        throw new Error(payload.message ?? "Eliminazione permanente non riuscita.");
      }
      toast.success("Elemento eliminato definitivamente.");
      await loadArchive();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eliminazione permanente non riuscita.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const deleteDocument = async (document: ActiveDocumentDto) => {
    setProcessingItemId(document.id);
    try {
      const response = await fetch(`/api/archive/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: "Eliminazione documento non riuscita." }))) as { message?: string };
        throw new Error(payload.message ?? "Eliminazione documento non riuscita.");
      }
      toast.success("Documento spostato nel cestino e rimosso dalla knowledge.");
      await loadDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Eliminazione documento non riuscita.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const emptyTrash = async () => {
    setProcessingItemId("empty-trash");
    try {
      const response = await fetch("/api/archive/empty", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: "svuota" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: "Svuotamento cestino non riuscito." }))) as { message?: string };
        throw new Error(payload.message ?? "Svuotamento cestino non riuscito.");
      }
      toast.success("Cestino svuotato.");
      setIsEmptyTrashDialogOpen(false);
      await loadArchive();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Svuotamento cestino non riuscito.");
    } finally {
      setProcessingItemId(null);
    }
  };

  const packageByKey = useMemo(
    () => new Map(packages.map((entry) => [entry.key, entry])),
    [packages],
  );

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            {t("archive.title")}
          </Text>
          <PageHelpHint text={t("archive.help")} />
        </div>
        <Text variant="muted">{language === "en" ? "Documents and archived items in the workspace." : "Documenti ed elementi archiviati nel workspace."}</Text>
      </header>

      <div className="flex w-fit items-center gap-1 rounded-md border border-border-default bg-bg-muted p-1">
        <button type="button" onClick={() => setActiveArea("documents")} className={cn("h-8 rounded px-3 text-sm font-semibold transition-colors", activeArea === "documents" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}>{t("archive.documents")}</button>
        <button type="button" onClick={() => setActiveArea("trash")} className={cn("h-8 rounded px-3 text-sm font-semibold transition-colors", activeArea === "trash" ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary")}>{t("archive.trash")}</button>
      </div>

      {activeArea === "documents" ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {documentContainers.map((entry) => (
              <button key={entry.key} type="button" onClick={() => setSelectedContainer(entry.key)} className={cn("rounded-md border bg-bg-surface p-4 text-left transition-colors", selectedContainer === entry.key ? "border-brand-primary ring-2 ring-ring-primary" : "border-border-default hover:border-brand-primary/50")}>
                <div className="flex items-start justify-between gap-3"><div><Text className="text-sm font-bold text-text-primary">{entry.key === "all" ? t("archive.all") : entry.key === "modules" ? t("archive.modules") : t("archive.playgrounds")}</Text><Text variant="caption">{entry.description}</Text></div><span className="rounded-full border border-border-default bg-bg-muted px-2 py-0.5 text-xs font-semibold text-text-secondary">{entry.count}</span></div>
              </button>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted/60 px-4 py-3">
              <div className="flex items-center gap-2"><Package size={16} className="text-brand-primary" /><Text className="text-sm font-bold text-text-primary">{t("archive.documents")}</Text></div>
              <div className="flex flex-1 justify-end gap-2 sm:max-w-xl"><label className="relative min-w-40 flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" /><input value={documentQuery} onChange={(event) => setDocumentQuery(event.target.value)} className="h-9 w-full rounded-md border border-border-default bg-bg-surface pl-8 pr-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" placeholder={t("archive.searchDocument")} /></label><select value={knowledgeFilter} onChange={(event) => setKnowledgeFilter(event.target.value as typeof knowledgeFilter)} className="h-9 rounded-md border border-border-default bg-bg-surface px-2 text-sm text-text-secondary outline-none focus:ring-2 focus:ring-ring-primary"><option value="all">{t("archive.knowledgeAll")}</option><option value="indexed">{t("archive.inKnowledge")}</option><option value="not_indexed">{t("archive.notInKnowledge")}</option></select></div>
            </div>
            {isLoading ? <div className="flex items-center justify-center gap-2 p-10 text-text-muted"><LoaderCircle size={18} className="animate-spin" /><span className="text-sm">{t("archive.loadingDocuments")}</span></div> : documents.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 p-10 text-center"><FileText size={18} className="text-text-muted" /><Text variant="muted">{t("archive.noDocuments")}</Text></div> : <div className="overflow-x-auto"><table className="min-w-full divide-y divide-border-subtle text-sm"><thead className="bg-bg-muted/40 text-left text-xs font-bold uppercase tracking-wide text-text-muted"><tr><th className="px-4 py-3">{t("workflow.document")}</th><th className="px-4 py-3">{t("archive.origin")}</th><th className="px-4 py-3">Knowledge</th><th className="px-4 py-3">{t("archive.date")}</th><th className="px-4 py-3">{t("archive.size")}</th><th className="px-4 py-3 text-right">{t("archive.actions")}</th></tr></thead><tbody className="divide-y divide-border-subtle/70 bg-bg-surface">{documents.map((document) => <tr key={document.id}><td className="px-4 py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-brand-primary" /><div><Text className="text-sm font-bold text-text-primary">{document.filename}</Text><Text variant="caption">{document.extension?.toUpperCase() ?? "FILE"}</Text></div></div></td><td className="px-4 py-3"><span className="inline-flex rounded-full border border-border-default bg-bg-muted px-2 py-0.5 text-xs font-semibold text-text-secondary">{document.container === "playgrounds" ? t("archive.playgrounds") : document.moduleName ?? t("archive.workspace")}</span></td><td className="px-4 py-3"><span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", document.knowledgeStatus === "indexed" ? "border-status-success-border bg-status-success-bg text-status-success-text" : "border-border-default bg-bg-muted text-text-muted")}>{document.knowledgeStatus === "indexed" ? <Database className="mr-1 h-3 w-3" /> : null}{document.knowledgeStatus === "indexed" ? t("archive.inKnowledge") : document.knowledgeStatus === "processing" ? t("archive.processing") : t("archive.notInKnowledge")}</span></td><td className="whitespace-nowrap px-4 py-3 text-text-secondary">{new Intl.DateTimeFormat(language === "en" ? "en-GB" : "it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(document.createdAt))}</td><td className="whitespace-nowrap px-4 py-3 text-text-secondary">{formatFileSize(document.sizeBytes)}</td><td className="px-4 py-3 text-right"><button type="button" title={t("archive.moveToTrash")} aria-label={`${t("archive.moveToTrash")}: ${document.filename}`} disabled={processingItemId === document.id} onClick={() => void deleteDocument(document)} className="rounded-md p-2 text-text-muted hover:bg-status-danger-bg hover:text-status-danger-text disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>}
          </Card>
        </>
      ) : (
        <>

      <div className="grid gap-3 md:grid-cols-2">
        {DEFAULT_PACKAGES.map((fallbackPackage) => {
          const entry = packageByKey.get(fallbackPackage.key) ?? fallbackPackage;
          const isSelected = selectedPackage === entry.key;

          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setSelectedPackage(entry.key)}
              className={cn(
                "rounded-[var(--radius-xl)] border bg-bg-surface p-4 text-left transition-all",
                isSelected
                  ? "border-brand-primary ring-2 ring-ring-primary"
                  : "border-border-default hover:border-brand-accent/70",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Text className="text-sm font-bold text-text-primary">{entry.label}</Text>
                  <Text variant="caption">{entry.description}</Text>
                </div>
                <span className="rounded-full border border-border-default bg-bg-muted px-2 py-0.5 text-xs font-semibold text-text-secondary">
                  {entry.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle bg-bg-muted/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-brand-primary" />
            <Text className="text-sm font-bold text-text-primary">
              {selectedPackage === "projects" ? "Archivio Progetti" : "Archivio Completo"}
            </Text>
          </div>
          <span className="rounded-full border border-border-default bg-bg-surface px-2 py-0.5 text-xs font-semibold text-text-secondary">
            {items.length}
          </span>
          {items.length > 0 ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsEmptyTrashDialogOpen(true)}
              disabled={processingItemId !== null}
            >
              Svuota cestino
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-text-muted">
            <LoaderCircle size={18} className="animate-spin" />
            <span className="text-sm">{t("archive.loadingTrash")}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <FileText size={18} className="text-text-muted" />
            <Text variant="muted">{t("archive.noTrash")}</Text>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle text-sm">
              <thead className="bg-bg-muted/40 text-left text-xs font-bold uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">{t("archive.date")}</th>
                  <th className="px-4 py-3">{t("archive.type")}</th>
                  <th className="px-4 py-3">{t("archive.item")}</th>
                  <th className="px-4 py-3">{t("archive.project")}</th>
                  <th className="px-4 py-3">{t("archive.details")}</th>
                  <th className="px-4 py-3 text-right">{t("archive.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70 bg-bg-surface">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatArchivedAt(item.archivedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {toEntityTypeLabel(item.entityType)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <Text className="text-sm font-bold text-text-primary">{item.title}</Text>
                        {item.description ? <Text variant="caption">{item.description}</Text> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.projectName ? (
                        <span className="inline-flex items-center rounded-full border border-border-default bg-bg-muted px-2 py-0.5 text-xs font-semibold text-text-secondary">
                          <FolderKanban size={12} className="mr-1" />
                          {item.projectName}
                        </span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{toDetails(item)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void restoreItem(item)}
                          disabled={processingItemId === item.id}
                        >
                          Ripristina
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void permanentlyDeleteItem(item)}
                          disabled={processingItemId === item.id}
                        >
                          Elimina definitivo
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
        </>
      )}
      <ConfirmDeleteDialog
        open={isEmptyTrashDialogOpen}
        expectedText="svuota"
        title="Svuota cestino"
        confirmLabel="Svuota cestino"
        isBusy={processingItemId === "empty-trash"}
        onCancel={() => setIsEmptyTrashDialogOpen(false)}
        onConfirm={emptyTrash}
      />
    </div>
  );
}
