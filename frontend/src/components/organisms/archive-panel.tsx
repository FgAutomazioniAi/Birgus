"use client";

import { Archive, FileText, FolderKanban, LoaderCircle, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";
import { cn } from "@/lib/cn";
import { scheduleUndoableAction } from "@/lib/undoable-action";

type ArchivePackageKey = "complete" | "projects";

interface ArchivePackageSummary {
  key: ArchivePackageKey;
  label: string;
  description: string;
  count: number;
}

interface ArchivedItemDto {
  id: string;
  entityType: "project" | "project_version" | "shipment" | "document";
  entityId: string;
  archivedAt: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  versionLabel: string | null;
  shipmentCode: string | null;
  fileName: string | null;
  scope: string | null;
}

interface ArchiveApiResponse {
  selectedPackage: ArchivePackageKey;
  packages: ArchivePackageSummary[];
  items: ArchivedItemDto[];
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

const toEntityTypeLabel = (entityType: ArchivedItemDto["entityType"]): string => {
  switch (entityType) {
    case "project":
      return "Progetto";
    case "project_version":
      return "Versione";
    case "shipment":
      return "Spedizione";
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

  if (item.entityType === "shipment" && item.shipmentCode) {
    return `Codice ${item.shipmentCode}`;
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
  const [selectedPackage, setSelectedPackage] = useState<ArchivePackageKey>("complete");
  const [packages, setPackages] = useState<ArchivePackageSummary[]>(DEFAULT_PACKAGES);
  const [items, setItems] = useState<ArchivedItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

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

  useEffect(() => {
    void loadArchive();
  }, [selectedPackage]);

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
    const previousItems = items;
    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    setProcessingItemId(item.id);

    scheduleUndoableAction({
      pendingMessage: `"${item.title}" in eliminazione definitiva...`,
      successMessage: "Elemento eliminato definitivamente.",
      errorMessage: "Eliminazione permanente non riuscita.",
      rollback: () => {
        setProcessingItemId(null);
        setItems(previousItems);
      },
      commit: async () => {
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
          await loadArchive();
        } finally {
          setProcessingItemId(null);
        }
      },
    });
  };

  const packageByKey = useMemo(
    () => new Map(packages.map((entry) => [entry.key, entry])),
    [packages],
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Archive size={18} className="text-brand-primary" />
          <Text as="h1" variant="h1">
            Archivio
          </Text>
        </div>
        <Text variant="muted">Elementi in archivio, la cancellazione automatica verrà implementata.</Text>
      </header>

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
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-text-muted">
            <LoaderCircle size={18} className="animate-spin" />
            <span className="text-sm">Caricamento archivio...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <FileText size={18} className="text-text-muted" />
            <Text variant="muted">Nessun elemento archiviato per questo blocco.</Text>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle text-sm">
              <thead className="bg-bg-muted/40 text-left text-xs font-bold uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Elemento</th>
                  <th className="px-4 py-3">Progetto</th>
                  <th className="px-4 py-3">Dettagli</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
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
    </div>
  );
}
