"use client";

import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Eye,
  FileDown,
  FolderOpen,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";
import { PageHelpHint, SearchField, SelectDropdown } from "@/components/molecules";
import { cn } from "@/lib/cn";
import { downloadTablePdf } from "@/lib/pdf-export";
import { APP_ROUTES } from "@/lib/routes";
import type { ShipmentListItem } from "@/lib/types";

type ShipmentColumnKey =
  | "code"
  | "projectName"
  | "projectVersionLabel"
  | "clientName"
  | "statusKey"
  | "specificationUpdatedAt"
  | "createdAt"
  | "actions";

interface ShipmentColumnDef {
  cellClassName?: string;
  key: ShipmentColumnKey;
  label: string;
  render: (shipment: ShipmentListItem) => ReactNode;
  required: boolean;
}

interface StoredColumnConfig {
  hidden: ShipmentColumnKey[];
  order: ShipmentColumnKey[];
}

interface UserPreferencesResponse {
  colonneSpedizioni?: StoredColumnConfig | null;
  righeSpedizioni?: number;
}

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 40] as const;
const TABLE_COLUMNS_STORAGE_KEY = "vl_shipments_table_columns_v1";
const DEFAULT_SHIPMENT_COLUMN_ORDER: ShipmentColumnKey[] = [
  "code",
  "projectName",
  "projectVersionLabel",
  "clientName",
  "statusKey",
  "specificationUpdatedAt",
  "createdAt",
  "actions",
];

const isShipmentColumnKey = (value: string): value is ShipmentColumnKey =>
  DEFAULT_SHIPMENT_COLUMN_ORDER.includes(value as ShipmentColumnKey);

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("it-IT");
};

const formatShipmentStatus = (value: string) => {
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
      return value;
  }
};

const SHIPMENT_COLUMN_DEFS: ShipmentColumnDef[] = [
  {
    key: "code",
    label: "Codice",
    required: true,
    render: (shipment) => shipment.code,
    cellClassName: "font-mono text-xs text-brand-primary",
  },
  {
    key: "projectName",
    label: "Progetto",
    required: true,
    render: (shipment) => shipment.projectName,
  },
  {
    key: "projectVersionLabel",
    label: "Versione",
    required: false,
    render: (shipment) => shipment.projectVersionLabel.toUpperCase(),
    cellClassName: "text-xs font-semibold text-brand-primary",
  },
  {
    key: "clientName",
    label: "Cliente",
    required: false,
    render: (shipment) => shipment.clientName ?? "N/D",
  },
  {
    key: "statusKey",
    label: "Stato",
    required: false,
    render: (shipment) => formatShipmentStatus(shipment.statusKey),
  },
  {
    key: "specificationUpdatedAt",
    label: "Configurazione",
    required: false,
    render: (shipment) =>
      shipment.specificationUpdatedAt ? `Salvata il ${formatDate(shipment.specificationUpdatedAt)}` : "Da configurare",
  },
  {
    key: "createdAt",
    label: "Creata il",
    required: false,
    render: (shipment) => formatDate(shipment.createdAt),
  },
  {
    key: "actions",
    label: "Azioni",
    required: true,
    render: () => null,
    cellClassName: "text-right",
  },
];

export function ShipmentsTable() {
  const router = useRouter();
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ShipmentColumnKey[]>(DEFAULT_SHIPMENT_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<ShipmentColumnKey[]>([]);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const loadShipments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/shipments", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento spedizioni");
      }

      const payload = (await response.json()) as { shipments?: ShipmentListItem[] };
      setShipments(payload.shipments ?? []);
    } catch {
      toast.error("Impossibile caricare le spedizioni.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadShipments();
  }, []);

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
      ? config.order.filter((column): column is ShipmentColumnKey => isShipmentColumnKey(String(column)))
      : [];
    const uniqueOrder = Array.from(new Set(parsedOrder));
    const nextOrder = DEFAULT_SHIPMENT_COLUMN_ORDER.filter((column) => uniqueOrder.includes(column));
    const missing = DEFAULT_SHIPMENT_COLUMN_ORDER.filter((column) => !nextOrder.includes(column));
    setColumnOrder([...nextOrder, ...missing]);

    const parsedHidden = Array.isArray(config.hidden)
      ? config.hidden.filter((column): column is ShipmentColumnKey => isShipmentColumnKey(String(column)))
      : [];
    const optionalColumns = new Set(SHIPMENT_COLUMN_DEFS.filter((column) => !column.required).map((column) => column.key));
    setHiddenColumns(parsedHidden.filter((column) => optionalColumns.has(column)));
  };

  useEffect(() => {
    const storedRaw = window.localStorage.getItem(TABLE_COLUMNS_STORAGE_KEY);
    if (!storedRaw) {
      return;
    }

    try {
      const parsed = JSON.parse(storedRaw) as Partial<StoredColumnConfig>;
      applyColumnConfig(parsed);
    } catch {
      setColumnOrder(DEFAULT_SHIPMENT_COLUMN_ORDER);
      setHiddenColumns([]);
    }
  }, []);

  useEffect(() => {
    const payload: StoredColumnConfig = { order: columnOrder, hidden: hiddenColumns };
    window.localStorage.setItem(TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(payload));
  }, [columnOrder, hiddenColumns]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/user/preferences", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as UserPreferencesResponse;
        applyColumnConfig(data.colonneSpedizioni);

        const preferredRows = data.righeSpedizioni;
        if (preferredRows && ROWS_PER_PAGE_OPTIONS.includes(preferredRows as (typeof ROWS_PER_PAGE_OPTIONS)[number])) {
          setRowsPerPage(preferredRows);
        }
      } catch {
        // fallback su localStorage.
      } finally {
        setIsPreferencesReady(true);
      }
    };

    void loadPreferences();
  }, []);

  useEffect(() => {
    if (!isPreferencesReady) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const persist = async () => {
        try {
          await fetch("/api/user/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              righeSpedizioni: rowsPerPage,
              colonneSpedizioni: {
                order: columnOrder,
                hidden: hiddenColumns,
              },
            }),
          });
        } catch {
          // fallback su localStorage.
        }
      };

      void persist();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [columnOrder, hiddenColumns, isPreferencesReady, rowsPerPage]);

  const filteredShipments = useMemo(
    () =>
      shipments.filter((shipment) => {
        const lowered = searchTerm.toLowerCase();
        return (
          shipment.code.toLowerCase().includes(lowered) ||
          shipment.projectName.toLowerCase().includes(lowered) ||
          shipment.projectVersionLabel.toLowerCase().includes(lowered) ||
          (shipment.clientName ?? "").toLowerCase().includes(lowered) ||
          formatShipmentStatus(shipment.statusKey).toLowerCase().includes(lowered)
        );
      }),
    [searchTerm, shipments],
  );

  const visibleColumns = useMemo(() => {
    const ordered = columnOrder
      .map((key) => SHIPMENT_COLUMN_DEFS.find((column) => column.key === key))
      .filter((column): column is ShipmentColumnDef => Boolean(column));
    return ordered.filter((column) => !hiddenColumns.includes(column.key));
  }, [columnOrder, hiddenColumns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredShipments.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedShipments = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredShipments.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredShipments, rowsPerPage]);

  const totalVisibleColumns = Math.max(visibleColumns.length, 1);

  const toggleColumnVisibility = (key: ShipmentColumnKey) => {
    const column = SHIPMENT_COLUMN_DEFS.find((item) => item.key === key);
    if (!column || column.required) {
      return;
    }

    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const moveColumn = (key: ShipmentColumnKey, direction: "up" | "down") => {
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

  const exportShipmentsPdf = async () => {
    if (!filteredShipments.length) {
      toast.error("Nessuna spedizione da esportare.");
      return;
    }

    try {
      setIsExporting(true);
      await downloadTablePdf({
        columns: [
          { key: "code", label: "Codice" },
          { key: "projectName", label: "Progetto" },
          { key: "projectVersionLabel", label: "Versione" },
          { key: "clientName", label: "Cliente" },
          { key: "statusKey", label: "Stato" },
          { key: "specificationUpdatedAt", label: "Configurazione" },
        ],
        filename: `spedizioni-${new Date().toISOString().slice(0, 10)}.pdf`,
        rows: filteredShipments.map((shipment) => ({
          code: shipment.code,
          projectName: shipment.projectName,
          projectVersionLabel: shipment.projectVersionLabel.toUpperCase(),
          clientName: shipment.clientName ?? "N/D",
          statusKey: formatShipmentStatus(shipment.statusKey),
          specificationUpdatedAt: shipment.specificationUpdatedAt
            ? `Salvata il ${formatDate(shipment.specificationUpdatedAt)}`
            : "Da configurare",
        })),
        subtitle: `Totale spedizioni esportate: ${filteredShipments.length}`,
        title: "Elenco Spedizioni",
      });
      toast.success("PDF spedizioni generato con successo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'esportazione spedizioni.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Text as="h1" variant="h1">
              Spedizioni
            </Text>
            <PageHelpHint text="Consulta le spedizioni collegate alle versioni progetto e apri la configurazione tecnica della singola spedizione." />
          </div>
          <Text variant="muted">Ogni versione progetto genera una singola spedizione dedicata.</Text>
        </div>
      </div>

      <Card className="overflow-visible">
        <div className="flex flex-col justify-between gap-4 border-b border-border-subtle p-4 md:flex-row md:items-center">
          <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Elenco spedizioni</h3>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <SearchField
              className="w-full md:w-80"
              placeholder="Ricerca spedizioni..."
              value={searchTerm}
              onChange={setSearchTerm}
            />

            <div className="flex items-center gap-2">
              <SelectDropdown
                value={String(rowsPerPage)}
                onChange={(value) => setRowsPerPage(Number(value))}
                options={ROWS_PER_PAGE_OPTIONS.map((option) => ({
                  value: String(option),
                  label: `${option} righe`,
                }))}
                className="min-w-[120px]"
              />

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
                        const column = SHIPMENT_COLUMN_DEFS.find((item) => item.key === key);
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
                onClick={() => void exportShipmentsPdf()}
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
              {paginatedShipments.map((shipment) => (
                <tr key={shipment.id} className="transition-colors hover:bg-bg-muted/60">
                  {visibleColumns.map((column) => (
                    <td key={`${shipment.id}-${column.key}`} className={cn("px-6 py-4", column.cellClassName)}>
                      {column.key === "actions" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(APP_ROUTES.projectVersions(shipment.projectId))}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border-default px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                          >
                            <FolderOpen size={12} />
                            Progetto
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(APP_ROUTES.shipmentDetail(shipment.id))}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-status-info-border px-2.5 text-[11px] font-medium text-status-info-text transition-colors hover:bg-status-info-bg"
                          >
                            <Eye size={12} />
                            Apri
                          </button>
                        </div>
                      ) : column.key === "code" ? (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary">
                          <Truck size={14} />
                          {column.render(shipment)}
                        </span>
                      ) : (
                        <span className={cn("text-sm", column.key === "createdAt" ? "text-text-muted" : "text-text-secondary")}>
                          {column.render(shipment)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && paginatedShipments.length === 0 && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Nessuna spedizione disponibile.
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Caricamento spedizioni...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            Totale spedizioni: <strong className="text-text-primary">{filteredShipments.length}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>
              Precedente
            </Button>
            <span>
              Pagina {currentPage} di {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>
              Successiva
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
