"use client";

import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Eye,
  FileDown,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, CheckboxControl, Text } from "@/components/atoms";
import { PageHelpHint, SearchField, SelectDropdown } from "@/components/molecules";
import { HumanInterventionsPanel } from "@/components/organisms/human-interventions-panel";
import { useLanguage } from "@/components/organisms/language-provider";
import { cn } from "@/lib/cn";
import { downloadTablePdf } from "@/lib/pdf-export";
import { APP_ROUTES } from "@/lib/routes";
import { scheduleUndoableAction } from "@/lib/undoable-action";
import type { Project } from "@/lib/types";

type ProjectColumnKey = "project" | "versionsCount" | "date" | "actions";

interface ProjectColumnDef {
  cellClassName?: string;
  key: ProjectColumnKey;
  label: string;
  render: (project: Project) => ReactNode;
  required: boolean;
}

interface StoredColumnConfig {
  hidden: ProjectColumnKey[];
  order: ProjectColumnKey[];
}

interface UserPreferencesResponse {
  colonneProgetti?: StoredColumnConfig | null;
  righeProgetti?: number;
}

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 40] as const;
const TABLE_COLUMNS_STORAGE_KEY = "vl_projects_table_columns_v1";
const DEFAULT_PROJECT_COLUMN_ORDER: ProjectColumnKey[] = ["project", "versionsCount", "date", "actions"];

const PROJECT_COLUMN_DEFS: ProjectColumnDef[] = [
  {
    key: "project",
    label: "Progetto",
    required: true,
    render: (project) => project.project,
  },
  {
    key: "versionsCount",
    label: "Versioni",
    required: false,
    render: (project) => project.versionsCount,
  },
  {
    key: "date",
    label: "Creato il",
    required: false,
    render: (project) => project.date,
  },
  {
    key: "actions",
    label: "Azioni",
    required: true,
    cellClassName: "text-right",
    render: () => null,
  },
];

const isProjectColumnKey = (value: string): value is ProjectColumnKey =>
  DEFAULT_PROJECT_COLUMN_ORDER.includes(value as ProjectColumnKey);

export function DashboardTable() {
  const { t } = useLanguage();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<ProjectColumnKey[]>(DEFAULT_PROJECT_COLUMN_ORDER);
  const [hiddenColumns, setHiddenColumns] = useState<ProjectColumnKey[]>([]);
  const [isPreferencesReady, setIsPreferencesReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento progetti");
      }

      const data = (await response.json()) as Project[];
      setProjects(data);
    } catch {
      toast.error("Impossibile caricare i progetti.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
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
      ? config.order.filter((column): column is ProjectColumnKey => isProjectColumnKey(String(column)))
      : [];
    const uniqueOrder = Array.from(new Set(parsedOrder));
    const nextOrder = DEFAULT_PROJECT_COLUMN_ORDER.filter((column) => uniqueOrder.includes(column));
    const missing = DEFAULT_PROJECT_COLUMN_ORDER.filter((column) => !nextOrder.includes(column));
    setColumnOrder([...nextOrder, ...missing]);

    const parsedHidden = Array.isArray(config.hidden)
      ? config.hidden.filter((column): column is ProjectColumnKey => isProjectColumnKey(String(column)))
      : [];
    const optionalColumns = new Set(PROJECT_COLUMN_DEFS.filter((column) => !column.required).map((column) => column.key));
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
      setColumnOrder(DEFAULT_PROJECT_COLUMN_ORDER);
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
        applyColumnConfig(data.colonneProgetti);

        const preferredRows = data.righeProgetti;
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
              righeProgetti: rowsPerPage,
              colonneProgetti: {
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

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const lowered = searchTerm.toLowerCase();
        return (
          project.project.toLowerCase().includes(lowered) ||
          project.id.toLowerCase().includes(lowered) ||
          String(project.versionsCount).includes(lowered) ||
          project.date.toLowerCase().includes(lowered)
        );
      }),
    [projects, searchTerm],
  );

  const visibleColumns = useMemo(() => {
    const ordered = columnOrder
      .map((key) => PROJECT_COLUMN_DEFS.find((column) => column.key === key))
      .filter((column): column is ProjectColumnDef => Boolean(column));
    return ordered.filter((column) => !hiddenColumns.includes(column.key));
  }, [columnOrder, hiddenColumns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredProjects.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredProjects, rowsPerPage]);

  const totalVisibleColumns = Math.max(visibleColumns.length, 1);

  const handleDelete = (project: Project) => {
    const previousProjects = projects;
    setProjects((prev) => prev.filter((item) => item.id !== project.id));

    scheduleUndoableAction({
      pendingMessage: `Progetto "${project.project}" in archiviazione...`,
      successMessage: "Progetto archiviato.",
      errorMessage: "Archiviazione progetto non riuscita.",
      rollback: () => setProjects(previousProjects),
      commit: async () => {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmText: project.project }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ message: "Errore archiviazione progetto" }))) as { message?: string };
          throw new Error(payload.message ?? "Errore archiviazione progetto");
        }
      },
    });
  };

  const toggleColumnVisibility = (key: ProjectColumnKey) => {
    const column = PROJECT_COLUMN_DEFS.find((item) => item.key === key);
    if (!column || column.required) {
      return;
    }

    setHiddenColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const moveColumn = (key: ProjectColumnKey, direction: "up" | "down") => {
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

  const exportProjectsPdf = async () => {
    if (!filteredProjects.length) {
      toast.error("Nessun progetto da esportare.");
      return;
    }

    try {
      setIsExporting(true);
      await downloadTablePdf({
        columns: [
          { key: "project", label: "Progetto" },
          { align: "right", key: "versionsCount", label: "Versioni" },
          { key: "date", label: "Creato il" },
        ],
        filename: `progetti-${new Date().toISOString().slice(0, 10)}.pdf`,
        rows: filteredProjects.map((project) => ({
          date: project.date,
          project: project.project,
          versionsCount: project.versionsCount,
        })),
        subtitle: `Totale progetti esportati: ${filteredProjects.length}`,
        title: "Elenco Progetti",
      });
      toast.success("PDF progetti generato con successo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'esportazione progetti.");
    } finally {
      setIsExporting(false);
    }
  };

  const firstVisibleRow = filteredProjects.length ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const lastVisibleRow = filteredProjects.length
    ? Math.min(currentPage * rowsPerPage, filteredProjects.length)
    : 0;

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Text as="h1" variant="h1">
              Progetti
            </Text>
            <PageHelpHint text={t("projects.help")} />
          </div>
          <Text variant="muted">{t("projects.subtitle")}</Text>
        </div>

        <Button
          variant="accent"
          size="md"
          className="h-11 rounded-[var(--radius-md)] px-4 py-2.5"
          onClick={() => router.push(APP_ROUTES.projectNew)}
        >
          <Plus size={20} />
          {t("projects.new")}
        </Button>
      </div>

      <HumanInterventionsPanel />

      <Card className="overflow-visible">
        <div className="flex flex-col justify-between gap-4 border-b border-border-subtle p-4 md:flex-row md:items-center">
          <SearchField
            className="max-w-md flex-1"
            placeholder={t("projects.search")}
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
                      const column = PROJECT_COLUMN_DEFS.find((item) => item.key === key);
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
                            <CheckboxControl
                              type="checkbox"
                              checked={!hidden}
                              disabled={column.required}
                              onChange={() => toggleColumnVisibility(column.key)}
                            />
                            <span className={cn("font-medium", column.required ? "text-text-primary" : "text-text-secondary")}>
                              {column.label}
                            </span>
                            {column.required && <span className="text-[10px] font-bold uppercase text-brand-primary">LOCK</span>}
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
              onClick={() => void exportProjectsPdf()}
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
              {paginatedProjects.map((project) => (
                <tr key={project.id} className="group transition-colors hover:bg-bg-muted/60">
                  {visibleColumns.map((column) => (
                    <td key={`${project.id}-${column.key}`} className={cn("px-6 py-4", column.cellClassName)}>
                      {column.key === "actions" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(APP_ROUTES.projectVersions(project.id))}
                            className="rounded-lg p-1.5 text-brand-primary transition-colors hover:bg-status-info-bg"
                            title="Apri versionamenti"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => router.push(APP_ROUTES.projectEdit(project.id))}
                            className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-status-info-bg"
                            title="Modifica dati progetto"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(project)}
                            className="rounded-lg p-1.5 text-status-danger-text transition-colors hover:bg-status-danger-bg"
                            title="Archivia progetto"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : column.key === "project" ? (
                        <button
                          type="button"
                          onClick={() => router.push(APP_ROUTES.projectVersions(project.id))}
                          className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                          {project.project}
                        </button>
                      ) : (
                        <span className={cn("text-sm", column.key === "date" ? "text-text-muted" : "text-text-secondary")}>
                          {column.render(project)}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {isLoading && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Caricamento progetti in corso...
                  </td>
                </tr>
              )}

              {!isLoading && !filteredProjects.length && (
                <tr>
                  <td colSpan={totalVisibleColumns} className="px-6 py-12 text-center text-text-muted">
                    Nessun progetto trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-border-subtle p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-text-muted">
              {firstVisibleRow} - {lastVisibleRow} su {filteredProjects.length} progetti
            </p>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <span>Righe</span>
              <SelectDropdown
                size="sm"
                value={String(rowsPerPage)}
                onChange={(value) => setRowsPerPage(Number(value))}
                options={ROWS_PER_PAGE_OPTIONS.map((option) => ({
                  value: String(option),
                  label: String(option),
                }))}
                className="min-w-[72px]"
              />
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
