"use client";

import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Columns3,
  FileDown,
  Filter,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";
import { PageHelpHint, SearchField } from "@/components/molecules";
import { cn } from "@/lib/cn";
import { downloadTablePdf } from "@/lib/pdf-export";
import { APP_ROUTES } from "@/lib/routes";
import { scheduleUndoableAction } from "@/lib/undoable-action";
import type { Client } from "@/lib/types";

type ClientColumnKey = "name" | "email" | "phone" | "notes" | "actions";

interface ClientColumnDef {
  cellClassName?: string;
  key: ClientColumnKey;
  label: string;
  render: (client: Client) => ReactNode;
  required: boolean;
}

interface StoredColumnConfig {
  hidden: ClientColumnKey[];
  order: ClientColumnKey[];
}

interface UserPreferencesResponse {
  colonneClienti?: StoredColumnConfig | null;
  righeClienti?: number;
}

const TABLE_COLUMNS_STORAGE_KEY = "vl_clients_table_columns_v1";
const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 40] as const;

const DEFAULT_CLIENT_COLUMN_ORDER: ClientColumnKey[] = ["name", "email", "phone", "notes", "actions"];

const isClientColumnKey = (value: string): value is ClientColumnKey =>
  DEFAULT_CLIENT_COLUMN_ORDER.includes(value as ClientColumnKey);

const CLIENT_COLUMN_DEFS: ClientColumnDef[] = [
  {
    key: "name",
    label: "Nome Cliente",
    required: true,
    render: (client) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-warn-bg text-xs font-bold text-status-warn-text">
          {client.name.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="block text-sm font-bold text-brand-primary">{client.name}</span>
          {client.name === "FG Automazioni" && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-status-success-text">
              <ShieldCheck size={10} /> Verificato Premium
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "email",
    label: "Email",
    required: false,
    render: (client) => (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Mail size={14} className="text-slate-400" />
        {client.email}
      </div>
    ),
  },
  {
    key: "phone",
    label: "Telefono",
    required: false,
    render: (client) => (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Phone size={14} className="text-slate-400" />
        {client.phone}
      </div>
    ),
  },
  {
    key: "notes",
    label: "Note",
    required: false,
    render: (client) => (
      <div className="flex max-w-xs items-center gap-2 truncate text-sm italic text-text-muted" title={client.notes}>
        <MessageSquare size={14} className="text-slate-300" />
        {client.notes}
      </div>
    ),
  },
  {
    key: "actions",
    label: "Azioni",
    required: true,
    cellClassName: "text-right",
    render: () => null,
  },
];

export function ClientsTable() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ClientColumnKey[]>(DEFAULT_CLIENT_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<ClientColumnKey[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/clients", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento clienti");
      }

      const data = (await response.json()) as Client[];
      setClients(data);
    } catch {
      toast.error("Impossibile caricare i clienti.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
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
      ? config.order.filter((column): column is ClientColumnKey => isClientColumnKey(String(column)))
      : [];
    const uniqueOrder = Array.from(new Set(parsedOrder));
    const nextOrder = DEFAULT_CLIENT_COLUMN_ORDER.filter((column) => uniqueOrder.includes(column));
    const missing = DEFAULT_CLIENT_COLUMN_ORDER.filter((column) => !nextOrder.includes(column));
    setColumnOrder([...nextOrder, ...missing]);

    const parsedHidden = Array.isArray(config.hidden)
      ? config.hidden.filter((column): column is ClientColumnKey => isClientColumnKey(String(column)))
      : [];
    const optionalColumns = new Set(CLIENT_COLUMN_DEFS.filter((column) => !column.required).map((column) => column.key));
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
      setColumnOrder(DEFAULT_CLIENT_COLUMN_ORDER);
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
        applyColumnConfig(data.colonneClienti);

        const preferredRows = data.righeClienti;
        if (preferredRows && ROWS_PER_PAGE_OPTIONS.includes(preferredRows as (typeof ROWS_PER_PAGE_OPTIONS)[number])) {
          setRowsPerPage(preferredRows);
        }
      } catch {
        // fallback su cache locale.
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
              righeClienti: rowsPerPage,
              colonneClienti: {
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

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        const lowered = searchTerm.toLowerCase();
        return (
          client.name.toLowerCase().includes(lowered) ||
          client.email.toLowerCase().includes(lowered) ||
          client.phone.toLowerCase().includes(lowered)
        );
      }),
    [clients, searchTerm],
  );

  const visibleColumns = useMemo(() => {
    const ordered = columnOrder
      .map((key) => CLIENT_COLUMN_DEFS.find((column) => column.key === key))
      .filter((column): column is ClientColumnDef => Boolean(column));
    return ordered.filter((column) => !hiddenColumns.includes(column.key));
  }, [columnOrder, hiddenColumns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredClients.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredClients, rowsPerPage]);

  const totalVisibleColumns = Math.max(visibleColumns.length, 1);

  const handleDelete = (client: Client) => {
    const previousClients = clients;
    setClients((prev) => prev.filter((item) => item.id !== client.id));

    scheduleUndoableAction({
      pendingMessage: `Cliente "${client.name}" in archiviazione...`,
      successMessage: "Cliente archiviato.",
      errorMessage: "Archiviazione cliente non riuscita.",
      rollback: () => setClients(previousClients),
      commit: async () => {
        const response = await fetch(`/api/clients/${client.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmText: "cancella" }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ message: "Errore archiviazione cliente" }))) as { message?: string };
          throw new Error(payload.message ?? "Errore archiviazione cliente");
        }
      },
    });
  };

  const toggleColumnVisibility = (key: ClientColumnKey) => {
    const column = CLIENT_COLUMN_DEFS.find((item) => item.key === key);
    if (!column || column.required) {
      return;
    }

    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const moveColumn = (key: ClientColumnKey, direction: "up" | "down") => {
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

  const firstVisibleRow = filteredClients.length ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const lastVisibleRow = filteredClients.length
    ? Math.min(currentPage * rowsPerPage, filteredClients.length)
    : 0;

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const exportClientsPdf = async () => {
    if (!filteredClients.length) {
      toast.error("Nessun cliente da esportare.");
      return;
    }

    try {
      setIsExporting(true);
      await downloadTablePdf({
        columns: [
          { key: "name", label: "Nome Cliente" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Telefono" },
          { key: "notes", label: "Note" },
        ],
        filename: `clienti-${new Date().toISOString().slice(0, 10)}.pdf`,
        rows: filteredClients.map((client) => ({
          email: client.email,
          name: client.name,
          notes: client.notes,
          phone: client.phone,
        })),
        subtitle: `Totale clienti esportati: ${filteredClients.length}`,
        title: "Elenco Clienti",
      });
      toast.success("PDF clienti generato con successo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'esportazione clienti.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Text as="h1" variant="h1">
              Clienti
            </Text>
            <PageHelpHint text="Cerca, modifica o crea un cliente." />
          </div>
          <Text variant="muted">Anagrafica Clienti</Text>
        </div>

        <Button
          variant="accent"
          className="h-11 rounded-[var(--radius-md)] px-4 py-2.5"
          onClick={() => router.push(APP_ROUTES.clientNew)}
        >
          <UserPlus size={20} />
          Nuovo cliente
        </Button>
      </div>

      <Card className="overflow-visible">
        <div className="flex flex-col justify-between gap-4 border-b border-border-subtle p-4 md:flex-row md:items-center">
          <SearchField
            className="max-w-md flex-1"
            placeholder="Ricerca clienti.."
            value={searchTerm}
            onChange={setSearchTerm}
          />

          <div className="flex flex-wrap items-center gap-2">
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
                      const column = CLIENT_COLUMN_DEFS.find((item) => item.key === key);
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

            <Button variant="outline" size="sm" className="h-10 rounded-lg px-3 py-2 font-medium">
              <Filter size={18} />
              Filtra
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg px-3 py-2 font-medium"
              onClick={() => void exportClientsPdf()}
              disabled={isExporting}
            >
              <FileDown size={16} />
              Esporta
            </Button>
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
              {paginatedClients.map((client) => (
                <tr key={client.id} className="group transition-colors hover:bg-bg-muted/60">
                  {visibleColumns.map((column) => (
                    <td key={`${client.id}-${column.key}`} className={cn("px-6 py-4", column.cellClassName)}>
                      {column.key === "actions" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(APP_ROUTES.clientEdit(client.id))}
                            className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-status-info-bg"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(client)}
                            className="rounded-lg p-1.5 text-status-danger-text transition-colors hover:bg-status-danger-bg"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button className="group/arrow rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-bg-subtle">
                            <ArrowRight size={18} className="transition-transform group-hover/arrow:translate-x-0.5" />
                          </button>
                        </div>
                      ) : (
                        column.render(client)
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {isLoading && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Caricamento clienti in corso...
                  </td>
                </tr>
              )}

              {!isLoading && !filteredClients.length && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Nessun cliente trovato con i filtri attivi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-border-subtle p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-text-muted">
              {firstVisibleRow} - {lastVisibleRow} su {filteredClients.length} clienti
            </p>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <span>vista</span>
              <select
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value))}
                className="h-8 cursor-pointer rounded-md border border-border-default bg-bg-muted px-2 text-xs text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary"
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={!canGoPrevious}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium",
                canGoPrevious
                  ? "border-border-default text-text-secondary hover:bg-bg-subtle"
                  : "cursor-not-allowed border-border-default bg-bg-muted text-slate-400",
              )}
            >
              Precedente
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={!canGoNext}
              className={cn(
                "rounded-lg border px-3 py-1 text-xs font-medium",
                canGoNext
                  ? "border-brand-primary text-brand-primary hover:bg-status-info-bg"
                  : "cursor-not-allowed border-border-default bg-bg-muted text-slate-400",
              )}
            >
              Successivo
            </button>
          </div>
        </div>
      </Card>

    </div>
  );
}
