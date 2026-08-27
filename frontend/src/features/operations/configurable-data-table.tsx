"use client";

import { ChevronDown, ChevronUp, Columns3, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Button, CheckboxControl } from "@/components/atoms";
import { cn } from "@/lib/cn";

type SortDirection = "asc" | "desc";

export interface ConfigurableColumn<TItem, TKey extends string> {
  cellClassName?: string;
  defaultWidth: number;
  key: TKey;
  label: string;
  minWidth?: number;
  render: (item: TItem) => ReactNode;
  required?: boolean;
  sortValue?: (item: TItem) => number | string | null | undefined;
}

interface StoredTableConfig<TKey extends string> {
  hidden: TKey[];
  order: TKey[];
  widths: Partial<Record<TKey, number>>;
}

interface ConfigurableDataTableProps<TItem, TKey extends string> {
  columns: ConfigurableColumn<TItem, TKey>[];
  emptyLabel: string;
  getRowId: (item: TItem) => string;
  items: TItem[];
  storageKey: string;
}

export function ConfigurableDataTable<TItem, TKey extends string>({
  columns,
  emptyLabel,
  getRowId,
  items,
  storageKey,
}: ConfigurableDataTableProps<TItem, TKey>) {
  const defaultOrder = useMemo(() => columns.map((column) => column.key), [columns]);
  const [columnOrder, setColumnOrder] = useState<TKey[]>(defaultOrder);
  const [hiddenColumns, setHiddenColumns] = useState<TKey[]>([]);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<TKey, number>>>({});
  const [sort, setSort] = useState<{ direction: SortDirection; key: TKey } | null>(null);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<{ key: TKey; startWidth: number; startX: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setColumnOrder((current) => {
      const known = new Set(defaultOrder);
      const kept = current.filter((key) => known.has(key));
      const missing = defaultOrder.filter((key) => !kept.includes(key));
      return [...kept, ...missing];
    });
  }, [defaultOrder]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredTableConfig<TKey>>;
      const keys = new Set(defaultOrder);
      setColumnOrder([...(parsed.order ?? []).filter((key) => keys.has(key)), ...defaultOrder.filter((key) => !(parsed.order ?? []).includes(key))]);
      setHiddenColumns((parsed.hidden ?? []).filter((key) => keys.has(key) && !columns.find((column) => column.key === key)?.required));
      setColumnWidths(parsed.widths ?? {});
    } catch {
      setColumnOrder(defaultOrder);
      setHiddenColumns([]);
      setColumnWidths({});
    }
  }, [columns, defaultOrder, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ hidden: hiddenColumns, order: columnOrder, widths: columnWidths }));
  }, [columnOrder, columnWidths, hiddenColumns, storageKey]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsColumnsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!resizingColumn) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const column = columns.find((item) => item.key === resizingColumn.key);
      const minWidth = column?.minWidth ?? 110;
      const nextWidth = Math.max(minWidth, resizingColumn.startWidth + event.clientX - resizingColumn.startX);
      setColumnWidths((current) => ({ ...current, [resizingColumn.key]: nextWidth }));
    };

    const handlePointerUp = () => setResizingColumn(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [columns, resizingColumn]);

  const columnByKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const visibleColumns = columnOrder
    .map((key) => columnByKey.get(key))
    .filter((column): column is ConfigurableColumn<TItem, TKey> => Boolean(column))
    .filter((column) => !hiddenColumns.includes(column.key));

  const sortedItems = useMemo(() => {
    if (!sort) {
      return items;
    }

    const column = columnByKey.get(sort.key);
    if (!column?.sortValue) {
      return items;
    }

    return [...items].sort((left, right) => {
      const leftValue = column.sortValue?.(left);
      const rightValue = column.sortValue?.(right);
      const result = compareValues(leftValue, rightValue);
      return sort.direction === "asc" ? result : -result;
    });
  }, [columnByKey, items, sort]);

  const tableWidth = visibleColumns.reduce((sum, column) => sum + (columnWidths[column.key] ?? column.defaultWidth), 0);

  const toggleSort = (key: TKey) => {
    const column = columnByKey.get(key);
    if (!column?.sortValue) {
      return;
    }

    setSort((current) => {
      if (current?.key !== key) {
        return { key, direction: "asc" };
      }

      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  };

  const toggleColumn = (key: TKey) => {
    const column = columnByKey.get(key);
    if (!column || column.required) {
      return;
    }

    setHiddenColumns((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const moveColumn = (key: TKey, direction: "up" | "down") => {
    setColumnOrder((current) => {
      const index = current.indexOf(key);
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const resetColumns = () => {
    setColumnOrder(defaultOrder);
    setHiddenColumns([]);
    setColumnWidths({});
    setSort(null);
  };

  return (
    <div>
      <div className="flex justify-end border-b border-border-subtle px-4 py-3">
        <div className="relative" ref={menuRef}>
          <Button variant="outline" size="sm" className="h-9 rounded-lg px-3" onClick={() => setIsColumnsMenuOpen((current) => !current)}>
            <Columns3 size={16} />
            Colonne
          </Button>
          {isColumnsMenuOpen && (
            <div className="absolute right-0 top-11 z-20 w-80 rounded-lg border border-border-default bg-bg-surface p-3 shadow-elevated">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase text-brand-primary">Configura colonne</p>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetColumns}>
                  <RotateCcw size={13} />
                  Reset
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {columnOrder.map((key, index) => {
                  const column = columnByKey.get(key);
                  if (!column) {
                    return null;
                  }
                  const hidden = hiddenColumns.includes(key);
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-muted px-2.5 py-2">
                      <label className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
                        <CheckboxControl
                          id={`${storageKey}-${key}`}
                          name={`${storageKey}-${key}`}
                          type="checkbox"
                          checked={!hidden}
                          disabled={column.required}
                          onChange={() => toggleColumn(key)}
                        />
                        <span className="truncate">{column.label}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Sposta in alto ${column.label}`}
                          className="rounded-md border border-border-default p-1 text-text-muted disabled:opacity-40"
                          disabled={index === 0}
                          onClick={() => moveColumn(key, "up")}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Sposta in basso ${column.label}`}
                          className="rounded-md border border-border-default p-1 text-text-muted disabled:opacity-40"
                          disabled={index === columnOrder.length - 1}
                          onClick={() => moveColumn(key, "down")}
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
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left" style={{ minWidth: tableWidth }}>
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.key} style={{ width: columnWidths[column.key] ?? column.defaultWidth }} />
            ))}
          </colgroup>
          <thead className="bg-bg-muted/70">
            <tr>
              {visibleColumns.map((column) => {
                const isSortable = Boolean(column.sortValue);
                const isActive = sort?.key === column.key;
                return (
                  <th key={column.key} className="relative px-5 py-3 text-xs font-bold uppercase text-text-muted">
                    <button
                      type="button"
                      className={cn("flex w-full items-center justify-between gap-2 text-left", isSortable ? "cursor-pointer" : "cursor-default")}
                      onClick={() => toggleSort(column.key)}
                    >
                      <span>{column.label}</span>
                      {isActive && <span>{sort.direction === "asc" ? "↑" : "↓"}</span>}
                    </button>
                    <span
                      aria-label={`Ridimensiona colonna ${column.label}`}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      role="separator"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setResizingColumn({
                          key: column.key,
                          startX: event.clientX,
                          startWidth: columnWidths[column.key] ?? column.defaultWidth,
                        });
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sortedItems.map((item) => (
              <tr key={getRowId(item)} className="transition-colors hover:bg-bg-muted/60">
                {visibleColumns.map((column) => (
                  <td key={`${getRowId(item)}-${column.key}`} className={cn("px-5 py-4 align-top text-sm text-text-secondary", column.cellClassName)}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
            {!sortedItems.length && (
              <tr>
                <td colSpan={Math.max(visibleColumns.length, 1)} className="px-6 py-12 text-center text-sm text-text-muted">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function compareValues(left: number | string | null | undefined, right: number | string | null | undefined): number {
  if (typeof left === "number" || typeof right === "number") {
    return Number(left ?? Number.NEGATIVE_INFINITY) - Number(right ?? Number.NEGATIVE_INFINITY);
  }

  return String(left ?? "").localeCompare(String(right ?? ""), "it", { sensitivity: "base" });
}
