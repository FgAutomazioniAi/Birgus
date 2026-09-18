"use client";

import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronDown,
  ChevronUp,
  Columns3,
  Database,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button, Card, CheckboxControl, Text } from "@/components/atoms";
import { APP_ROUTES } from "@/lib/routes";

type Connection = { id: string; name: string };
type Cell = string | number | boolean | null;
type Result = { columns: string[]; rows: Array<Record<string, Cell>> };
type ColumnFilter = { id: string; column: string; value: string };
type SortState = { column: string; direction: "asc" | "desc" } | null;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      String(
        (payload as { message?: unknown }).message ?? "Richiesta non riuscita.",
      ),
    );
  }
  return payload as T;
}

function cellText(value: Cell | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function CommissionRecordsPanel() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [result, setResult] = useState<Result>({ columns: [], rows: [] });
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMenuPosition, setFilterMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [sort, setSort] = useState<SortState>(null);
  const [canOpenDetails, setCanOpenDetails] = useState(false);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const hasAutoLoadedRef = useRef(false);

  useEffect(() => {
    void getJson<{ connection: Connection }>(
      "/api/commission-intake/external-records/connections",
    )
      .then(({ connection: item }) => setConnection(item))
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Impossibile caricare le connessioni database.",
        ),
      )
      .finally(() => setLoadingConnections(false));
    void getJson<{ user?: { roleKeys?: string[] } }>("/api/auth/session")
      .then((session) =>
        setCanOpenDetails(
          (session.user?.roleKeys ?? []).some((role) =>
            ["admin", "superuser", "developer"].includes(role),
          ),
        ),
      )
      .catch(() => setCanOpenDetails(false));
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        columnsRef.current &&
        !columnsRef.current.contains(event.target as Node)
      ) {
        setColumnsOpen(false);
      }
      const target = event.target as Node;
      if (
        !filterButtonRef.current?.contains(target) &&
        !filterMenuRef.current?.contains(target)
      ) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const load = async () => {
    if (!connection) {
      toast.error("Non hai accesso al database associato alle Commesse.");
      return;
    }
    setLoadingRows(true);
    try {
      const next = await getJson<Result>(
        "/api/commission-intake/external-records",
      );
      setResult(next);
      setVisibleColumns((current) => {
        const retained = current.filter((column) =>
          next.columns.includes(column),
        );
        return [
          ...retained,
          ...next.columns.filter((column) => !retained.includes(column)),
        ];
      });
      setFilters((current) =>
        current.filter((filter) => next.columns.includes(filter.column)),
      );
      setSort(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossibile leggere la vista SQL Server.",
      );
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (!connection || hasAutoLoadedRef.current) return;
    hasAutoLoadedRef.current = true;
    void load();
  }, [connection]);

  const openFiltersMenu = () => {
    const bounds = filterButtonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setFilterMenuPosition({
      top: bounds.bottom + 8,
      right: window.innerWidth - bounds.right,
    });
    setFiltersOpen((open) => !open);
  };

  const displayedColumns = useMemo(
    () => visibleColumns.filter((column) => result.columns.includes(column)),
    [result.columns, visibleColumns],
  );
  const displayedRows = useMemo(() => {
    const filtered = result.rows.filter((row) =>
      filters.every((filter) =>
        cellText(row[filter.column])
          .toLocaleLowerCase("it")
          .includes(filter.value.trim().toLocaleLowerCase("it")),
      ),
    );
    if (!sort) return filtered;
    return [...filtered].sort((first, second) => {
      const firstValue = cellText(first[sort.column]);
      const secondValue = cellText(second[sort.column]);
      const firstNumber = Number(firstValue.replace(",", "."));
      const secondNumber = Number(secondValue.replace(",", "."));
      const order =
        Number.isFinite(firstNumber) && Number.isFinite(secondNumber)
          ? firstNumber - secondNumber
          : firstValue.localeCompare(secondValue, "it", {
              numeric: true,
              sensitivity: "base",
            });
      return sort.direction === "asc" ? order : -order;
    });
  }, [filters, result.rows, sort]);

  const addFilter = () => {
    const column =
      result.columns.find(
        (candidate) => !filters.some((filter) => filter.column === candidate),
      ) ?? result.columns[0];
    if (!column) return;
    setFilters((current) => [
      ...current,
      { id: crypto.randomUUID(), column, value: "" },
    ]);
  };
  const updateFilter = (id: string, update: Partial<ColumnFilter>) =>
    setFilters((current) =>
      current.map((filter) =>
        filter.id === id ? { ...filter, ...update } : filter,
      ),
    );
  const moveColumn = (column: string, delta: number) =>
    setVisibleColumns((current) => {
      const index = current.indexOf(column);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const toggleColumn = (column: string) =>
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column],
    );
  const toggleSort = (column: string) =>
    setSort((current) =>
      current?.column !== column
        ? { column, direction: "asc" }
        : current.direction === "asc"
          ? { column, direction: "desc" }
          : null,
    );
  const startResize = (
    column: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth =
      columnWidths[column] ??
      (column.toLowerCase().includes("descrizione") ? 420 : 180);
    const resize = (moveEvent: MouseEvent) => {
      setColumnWidths((current) => ({
        ...current,
        [column]: Math.max(100, startWidth + moveEvent.clientX - startX),
      }));
    };
    const stop = () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stop);
    };
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stop);
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[34rem] flex-col gap-4">
      <header>
        <Text as="h1" variant="h1">
          Anagrafica commesse
        </Text>
        <Text variant="muted" className="mt-1">
          Consultazione in sola lettura della vista SQL Server configurata.
        </Text>
      </header>
      <Card className="shrink-0 p-4">
        <div className="flex items-end gap-3 overflow-x-auto">
          <div className="min-w-56 flex-1">
            <div className="text-xs font-medium text-text-secondary">
              Database collegato
            </div>
            <div className="mt-1 flex h-9 items-center rounded-[var(--radius-md)] border border-border-default bg-bg-page px-3 text-sm text-text-primary">
              {loadingConnections
                ? "Caricamento…"
                : (connection?.name ??
                  "Visita le impostazioni Admin per configurare una connessione.")}
            </div>
          </div>
          <div className="shrink-0">
            <Button
              ref={filterButtonRef}
              type="button"
              size="sm"
              variant="outline"
              disabled={!result.columns.length}
              onClick={openFiltersMenu}
            >
              <Plus size={15} />
              Filtri{filters.length ? ` (${filters.length})` : ""}
            </Button>
            {filtersOpen && filterMenuPosition
              ? createPortal(
                  <div
                    ref={filterMenuRef}
                    className="fixed z-[200] w-[36rem] max-w-[calc(100vw-2rem)] space-y-2 rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3 shadow-elevated"
                    style={{
                      top: filterMenuPosition.top,
                      right: filterMenuPosition.right,
                    }}
                  >
                    {filters.length === 0 ? (
                      <Text variant="caption">Nessun filtro attivo.</Text>
                    ) : null}
                    {filters.map((filter) => (
                      <div key={filter.id} className="flex items-center gap-2">
                        <select
                          value={filter.column}
                          onChange={(event) =>
                            updateFilter(filter.id, {
                              column: event.target.value,
                            })
                          }
                          className="h-9 w-48 rounded-[var(--radius-md)] border border-border-default bg-bg-page px-3 text-sm text-text-primary"
                        >
                          {result.columns.map((column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                        <input
                          value={filter.value}
                          placeholder={`Cerca in ${filter.column}`}
                          onChange={(event) =>
                            updateFilter(filter.id, {
                              value: event.target.value,
                            })
                          }
                          className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border-default bg-bg-page px-3 text-sm text-text-primary"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 px-0"
                          title="Rimuovi filtro"
                          onClick={() =>
                            setFilters((current) =>
                              current.filter((item) => item.id !== filter.id),
                            )
                          }
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addFilter}
                    >
                      <Plus size={15} />
                      Aggiungi filtro
                    </Button>
                  </div>,
                  document.body,
                )
              : null}
          </div>
          <Button
            type="button"
            className="shrink-0"
            disabled={loadingRows || !connection}
            onClick={() => void load()}
          >
            {loadingRows ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Esegui ricerca
          </Button>
          {canOpenDetails ? (
            <Link href={APP_ROUTES.commissionInsights} className="shrink-0">
              <Button type="button" variant="outline">
                <ExternalLink size={16} />
                Dettaglio commesse
              </Button>
            </Link>
          ) : null}
        </div>
      </Card>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-bg-surface">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle p-2">
          <Text variant="caption" className="px-2">
            {loadingRows
              ? "Lettura in corso…"
              : result.columns.length
                ? `${displayedRows.length.toLocaleString("it-IT")} righe visualizzate su ${result.rows.length.toLocaleString("it-IT")}`
                : "Esegui una ricerca per visualizzare le commesse."}
          </Text>
          <div className="relative" ref={columnsRef}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!result.columns.length}
              onClick={() => setColumnsOpen((open) => !open)}
            >
              <Columns3 size={16} />
              Colonne
            </Button>
            {columnsOpen ? (
              <div className="absolute right-0 z-20 mt-2 max-h-80 w-80 overflow-y-auto rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2 shadow-elevated">
                {result.columns.map((column) => {
                  const index = visibleColumns.indexOf(column);
                  const isVisible = index >= 0;
                  return (
                    <div
                      key={column}
                      className="flex items-center gap-2 px-2 py-1.5"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <CheckboxControl
                          checked={isVisible}
                          onChange={() => toggleColumn(column)}
                        />
                        <span className="truncate">{column}</span>
                      </label>
                      {isVisible ? (
                        <>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveColumn(column, -1)}
                            className="p-1 disabled:opacity-30"
                            aria-label={`Sposta ${column} a sinistra`}
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={index === visibleColumns.length - 1}
                            onClick={() => moveColumn(column, 1)}
                            className="p-1 disabled:opacity-30"
                            aria-label={`Sposta ${column} a destra`}
                          >
                            <ChevronDown size={15} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-max min-w-full table-fixed text-left">
            <colgroup>
              {displayedColumns.map((column) => (
                <col
                  key={column}
                  style={{
                    width:
                      columnWidths[column] ??
                      (column.toLowerCase().includes("descrizione")
                        ? 420
                        : 180),
                  }}
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-border-subtle bg-bg-muted/95 backdrop-blur">
              <tr>
                {displayedColumns.map((column) => (
                  <th
                    key={column}
                    className="relative border-r border-border-default px-4 py-3 text-xs font-bold uppercase text-text-muted last:border-r-0"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left"
                      onClick={() => toggleSort(column)}
                    >
                      {column}
                      {sort?.column === column ? (
                        sort.direction === "asc" ? (
                          <ArrowUpAZ size={14} />
                        ) : (
                          <ArrowDownAZ size={14} />
                        )
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      aria-label={`Ridimensiona ${column}`}
                      onMouseDown={(event) => startResize(column, event)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr>
                  <td
                    colSpan={Math.max(displayedColumns.length, 1)}
                    className="px-4 py-10 text-sm text-text-muted"
                  >
                    La vista SQL Server sta restituendo tutte le righe
                    richieste…
                  </td>
                </tr>
              ) : displayedRows.length ? (
                displayedRows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-border-subtle last:border-b-0 hover:bg-bg-muted/30"
                  >
                    {displayedColumns.map((column) => (
                      <td
                        key={column}
                        className={
                          column.toLowerCase().includes("descrizione")
                            ? "break-words whitespace-normal border-r border-border-subtle px-4 py-3 text-sm text-text-secondary last:border-r-0"
                            : "whitespace-nowrap border-r border-border-subtle px-4 py-3 text-sm text-text-secondary last:border-r-0"
                        }
                      >
                        {cellText(row[column]) || "-"}
                      </td>
                    ))}
                  </tr>
                ))
              ) : result.columns.length ? (
                <tr>
                  <td
                    colSpan={Math.max(displayedColumns.length, 1)}
                    className="px-4 py-10 text-center text-sm text-text-muted"
                  >
                    Nessuna riga corrisponde ai filtri inseriti.
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className="px-4 py-12 text-center text-sm text-text-muted">
                    <Database size={24} className="mx-auto mb-2" />
                    Seleziona un database ed esegui la ricerca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
