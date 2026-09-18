"use client";

import {
  BarChart3,
  BrainCircuit,
  Database,
  ExternalLink,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { cn } from "@/lib/cn";
import { useModuleAccess } from "@/lib/module-access";
import { APP_ROUTES } from "@/lib/routes";

type Commission = {
  id: string;
  code: string;
  companyName: string | null;
};
const brainyDatabaseHref = (prompt: string) =>
  `${APP_ROUTES.brainy}?kind=database&prompt=${encodeURIComponent(prompt)}`;

export function CommissionInsightsPanel() {
  const { enabledModuleKeys } = useModuleAccess();
  const [records, setRecords] = useState<Commission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const brainyEnabled = enabledModuleKeys.includes("brainy");
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/commission-intake/details/records", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        records?: Commission[];
        message?: string;
      };
      if (!response.ok)
        throw new Error(payload.message ?? "Impossibile caricare le commesse.");
      setRecords(payload.records ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossibile caricare le commesse.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return !query
      ? records
      : records.filter((record) =>
          `${record.code} ${record.companyName ?? ""}`
            .toLowerCase()
            .includes(query),
        );
  }, [records, search]);
  const selected = records.find((record) => record.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <header>
        <Text as="h1" variant="h1">
          Dettaglio commesse
        </Text>
        <Text variant="muted" className="mt-1">
          Consultazione approfondita delle commesse e del database collegato.
        </Text>
      </header>
      <Card className="border-status-info-text/30 bg-status-info-bg/40 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3">
            <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
            <div>
              <Text className="font-semibold">
                Consulta il database con Brainyware
              </Text>
              <Text variant="caption" className="mt-1 block">
                Birgus non invia i dati delle commesse: Brainyware interroga
                direttamente la connessione database autorizzata.
              </Text>
            </div>
          </div>
          {brainyEnabled ? (
            <Link
              href={brainyDatabaseHref(
                "Dammi una panoramica delle tabelle e delle informazioni disponibili per le commesse.",
              )}
            >
              <Button>
                <BrainCircuit size={16} />
                Panoramica database
                <ExternalLink size={14} />
              </Button>
            </Link>
          ) : (
            <Text variant="caption">
              Il modulo Brainyware non è attivo nel workspace.
            </Text>
          )}
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca una commessa"
              className="pl-9"
            />
          </div>
          <div className="mt-3 max-h-[440px] space-y-1 overflow-y-auto">
            {isLoading ? (
              <p className="px-2 py-6 text-sm text-text-muted">
                Caricamento commesse...
              </p>
            ) : (
              filteredRecords.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={cn(
                    "w-full rounded-[var(--radius-md)] px-3 py-3 text-left",
                    selected?.id === record.id
                      ? "bg-brand-primary/10 text-brand-primary"
                      : "hover:bg-bg-muted",
                  )}
                >
                  <span className="block text-sm font-bold">{record.code}</span>
                  <span className="mt-1 block text-xs text-text-muted">
                    {record.companyName ?? "Nessuna azienda"}
                  </span>
                </button>
              ))
            )}
            {!isLoading && filteredRecords.length === 0 ? (
              <p className="px-2 py-6 text-sm text-text-muted">
                Nessuna commessa disponibile.
              </p>
            ) : null}
          </div>
        </Card>
        <Card className="p-5">
          {selected ? (
            <>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <Text as="h2" variant="h2">
                    {selected.code}
                  </Text>
                </div>
                {brainyEnabled ? (
                  <Link
                    href={brainyDatabaseHref(
                      `Dammi informazioni sulla commessa ${selected.code}. Cerca i dettagli nel database collegato.`,
                    )}
                  >
                    <Button variant="outline">
                      <BrainCircuit size={16} />
                      Chiedi a Brainyware
                    </Button>
                  </Link>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Azienda"
                  value={selected.companyName ?? "Non disponibile"}
                />
              </div>
              <div className="mt-5 rounded-[var(--radius-md)] border border-dashed border-border-default p-4">
                <div className="flex items-center gap-2 text-text-secondary">
                  <BarChart3 size={18} />
                  <Text className="font-semibold">Dettagli e andamento</Text>
                </div>
                <Text variant="caption" className="mt-2 block">
                  Questa sezione leggerà i dettagli e i grafici direttamente dal
                  database esterno dopo la configurazione della connessione e
                  dello scheduler. Non viene replicato alcun dato in Birgus.
                </Text>
              </div>
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center text-center text-text-muted">
              <Database size={28} />
              <Text className="mt-3 font-semibold">Seleziona una commessa</Text>
              <Text variant="caption" className="mt-1 max-w-sm">
                Potrai aprire la ricerca mirata in Brainyware usando soltanto il
                suo identificativo.
              </Text>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-bg-muted p-3">
      <Text variant="caption">{label}</Text>
      <Text className="mt-1 font-semibold">{value}</Text>
    </div>
  );
}
