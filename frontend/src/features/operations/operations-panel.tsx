"use client";

import dynamic from "next/dynamic";
import { CalendarDays, ExternalLink, MapPin, RefreshCw, TrendingUp, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card, Text } from "@/components/atoms";
import { ConfigurableDataTable, type ConfigurableColumn } from "./configurable-data-table";
import type { CustomerGeoPoint } from "./customer-geo-map";
import { OptionSelect, SegmentedControl } from "./operation-controls";

const CustomerGeoMap = dynamic(() => import("./customer-geo-map").then((module) => module.CustomerGeoMap), {
  ssr: false,
});

type PanelKind = "customer-map" | "offer-priority" | "maintenance-proposals" | "maintenance-calendar";
type OfferAnalysisMode = "score" | "abc";

interface OperationsPanelProps {
  kind: PanelKind;
}

interface CustomerMapItem {
  id: string;
  customerName: string;
  label?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodingStatus: string;
}

interface OfferPriorityItem {
  id: string;
  offerCode: string;
  customerName: string;
  status?: string | null;
  subject?: string | null;
  totalAmount?: number | null;
  issuedAt?: string | null;
  competence?: string | null;
  conversionRate?: number | null;
  priorityScore?: number | null;
  priorityBand?: string | null;
  abcClass?: string | null;
  cumulativeShare?: number | null;
  topLines: Array<{ description: string; totalAmount?: number | null }>;
}

interface MaintenanceProposalItem {
  id: string;
  customerName: string;
  workReferenceCode: string;
  workReferenceName: string;
  lastServiceAt?: string | null;
  suggestedAt?: string | null;
  estimatedFrequencyDays?: number | null;
  historicalEventsCount: number;
  historicalWorkMinutes: number;
  preferredOperator?: string | null;
  annualPlanHint?: string | null;
  urgency: string;
  reason?: string | null;
}

interface MaintenanceResponse {
  proposals: MaintenanceProposalItem[];
}

interface MaintenanceCalendarItem {
  id: string;
  title: string;
  customerName: string;
  workReferenceCode: string;
  workReferenceName: string;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  status: string;
  assigneeName?: string | null;
  note?: string | null;
}

const PANEL_CONFIG = {
  "customer-map": {
    endpoint: "/api/customer-map",
    title: "Mappa clienti",
    subtitle: "Sedi cliente geocodificate e analisi di prossimita.",
    icon: MapPin,
  },
  "offer-priority": {
    endpoint: "/api/offer-priority",
    title: "Priorita offerte",
    subtitle: "Score proprietario o analisi ABC sul valore cumulato.",
    icon: TrendingUp,
  },
  "maintenance-proposals": {
    endpoint: "/api/maintenance-proposals",
    title: "Proposte manutenzione",
    subtitle: "Proposte generate dai dati operativi disponibili.",
    icon: Wrench,
  },
  "maintenance-calendar": {
    endpoint: "/api/maintenance-calendar",
    title: "Calendario manutenzioni",
    subtitle: "Piano operativo manutenzioni dalla sorgente collegata.",
    icon: CalendarDays,
  },
} as const;

const formatDate = (value?: string | null): string => {
  if (!value) {
    return "n/d";
  }

  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return "n/d";
  }

  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

const formatCurrency = (value?: number | null): string => {
  if (value === null || value === undefined) {
    return "n/d";
  }

  return new Intl.NumberFormat("it-IT", { currency: "EUR", style: "currency" }).format(value);
};

const formatPercent = (value?: number | null): string => {
  if (value === null || value === undefined) {
    return "n/d";
  }

  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1, style: "percent" }).format(value);
};

export function OperationsPanel({ kind }: OperationsPanelProps) {
  const config = PANEL_CONFIG[kind];
  const Icon = config.icon;
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(config.endpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Caricamento non riuscito");
      }

      setData(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare i dati.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [kind]);

  const itemCount = useMemo(() => {
    if (kind === "maintenance-proposals") {
      return ((data as MaintenanceResponse | null)?.proposals ?? []).length;
    }

    return Array.isArray(data) ? data.length : 0;
  }, [data, kind]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-bg-surface text-brand-primary">
            <Icon size={20} />
          </span>
          <div>
            <Text as="h1" variant="h1">
              {config.title}
            </Text>
            <Text variant="muted">{config.subtitle}</Text>
          </div>
        </div>

        <Button variant="outline" className="h-10 rounded-lg px-3" onClick={() => void load()} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Aggiorna
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <p className="text-sm font-semibold text-text-primary">Elementi disponibili</p>
          <Badge>{isLoading ? "..." : itemCount}</Badge>
        </div>

        {kind === "customer-map" && <CustomerMapView items={(Array.isArray(data) ? data : []) as CustomerMapItem[]} isLoading={isLoading} />}
        {kind === "offer-priority" && <OfferPriorityView items={(Array.isArray(data) ? data : []) as OfferPriorityItem[]} isLoading={isLoading} />}
        {kind === "maintenance-proposals" && (
          <MaintenanceProposalView data={(data as MaintenanceResponse | null) ?? { proposals: [] }} isLoading={isLoading} />
        )}
        {kind === "maintenance-calendar" && (
          <MaintenanceCalendarView items={(Array.isArray(data) ? data : []) as MaintenanceCalendarItem[]} isLoading={isLoading} />
        )}
      </Card>
    </div>
  );
}

function EmptyState({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-text-muted">
      {isLoading ? "Caricamento dati in corso..." : "Nessun dato disponibile dalla sorgente collegata."}
    </div>
  );
}

function CustomerMapView({ items, isLoading }: { items: CustomerMapItem[]; isLoading: boolean }) {
  const points = items.filter(isGeoPoint);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = points.find((point) => point.id === selectedId) ?? points[0] ?? null;
  const nearby = selected ? points.filter((point) => point.id !== selected.id).map((point) => ({ ...point, distanceKm: distanceKm(selected, point) })) : [];

  useEffect(() => {
    if (!selectedId && points[0]) {
      setSelectedId(points[0].id);
    }
  }, [points, selectedId]);

  if (!items.length) {
    return <EmptyState isLoading={isLoading} />;
  }

  return (
    <div className="grid min-h-[620px] gap-4 p-4 xl:grid-cols-[1fr_360px]">
      <div className="min-h-[420px] overflow-hidden rounded-lg border border-border-subtle bg-bg-muted">
        <CustomerGeoMap points={points} selectedId={selected?.id ?? null} />
      </div>
      <div className="space-y-3">
        <select
          id="customer-map-selected"
          name="customer-map-selected"
          className="h-10 w-full rounded-lg border border-border-default bg-bg-surface px-3 text-sm text-text-primary"
          value={selected?.id ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {points.map((point) => (
            <option key={point.id} value={point.id}>
              {point.customerName} | {point.label}
            </option>
          ))}
        </select>
        {nearby.map((point) => (
          <a
            key={point.id}
            className="block rounded-lg border border-border-subtle bg-bg-muted/40 p-4 transition-colors hover:bg-bg-muted"
            href={buildItineraryUrl(selected, point)}
            target="_blank"
            rel="noreferrer"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary">{point.customerName}</p>
                <p className="mt-1 text-sm text-text-muted">{point.label}</p>
              </div>
              <ExternalLink size={16} className="text-brand-primary" />
            </div>
            <p className="mt-3 text-sm text-text-secondary">{point.distanceKm.toFixed(1)} km</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function OfferPriorityView({ items, isLoading }: { items: OfferPriorityItem[]; isLoading: boolean }) {
  const [analysisMode, setAnalysisMode] = useState<OfferAnalysisMode>("score");
  const [competenceFilter, setCompetenceFilter] = useState("all");
  const competenceOptions = useMemo(
    () => [
      { label: "Tutte", value: "all" },
      ...Array.from(new Set(items.map((item) => item.competence).filter((value): value is string => Boolean(value))))
        .sort((left, right) => left.localeCompare(right, "it"))
        .map((value) => ({ label: value, value })),
    ],
    [items],
  );
  const filteredItems = useMemo(
    () => competenceFilter === "all" ? items : items.filter((item) => item.competence === competenceFilter),
    [competenceFilter, items],
  );
  const rows = useMemo(() => (analysisMode === "abc" ? buildAbcOffers(filteredItems) : filteredItems), [analysisMode, filteredItems]);
  const columns = useMemo<Array<ConfigurableColumn<OfferPriorityItem, string>>>(
    () => [
      {
        key: "offer",
        label: "Offerta",
        defaultWidth: 170,
        required: true,
        sortValue: (item) => item.offerCode,
        render: (item) => (
          <div>
            <p className="font-semibold text-text-primary">{item.offerCode}</p>
            <p className="text-xs text-text-muted">{formatDate(item.issuedAt)}</p>
          </div>
        ),
      },
      { key: "client", label: "Cliente", defaultWidth: 240, sortValue: (item) => item.customerName, render: (item) => item.customerName || "n/d" },
      {
        key: "items",
        label: "Righe principali",
        defaultWidth: 360,
        render: (item) => item.topLines.map((line) => line.description).join(", ") || "n/d",
      },
      { key: "competence", label: "Competenza", defaultWidth: 160, sortValue: (item) => item.competence, render: (item) => item.competence || "n/d" },
      { key: "value", label: "Valore", defaultWidth: 140, sortValue: (item) => item.totalAmount, render: (item) => formatCurrency(item.totalAmount) },
      {
        key: "conversion",
        label: "Storico conferme",
        defaultWidth: 160,
        sortValue: (item) => item.conversionRate,
        render: (item) => formatPercent(item.conversionRate),
      },
      {
        key: "priority",
        label: analysisMode === "abc" ? "Classe ABC" : "Priorita",
        defaultWidth: 150,
        sortValue: (item) => (analysisMode === "abc" ? abcRank(String(item.abcClass ?? "C")) : item.priorityScore),
        render: (item) =>
          analysisMode === "abc" ? (
            <div>
              <Badge tone={item.abcClass === "A" ? "warn" : item.abcClass === "B" ? "progress" : "info"}>Classe {item.abcClass ?? "C"}</Badge>
              <p className="mt-1 text-xs text-text-muted">cumulato {formatPercent(item.cumulativeShare)}</p>
            </div>
          ) : (
            <div>
              <Badge>{item.priorityBand ?? "n/d"}</Badge>
              <p className="mt-1 text-xs text-text-muted">score {item.priorityScore?.toFixed(3) ?? "n/d"}</p>
            </div>
          ),
      },
    ],
    [analysisMode],
  );

  if (!items.length) {
    return <EmptyState isLoading={isLoading} />;
  }

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedControl
          ariaLabel="Modalita analisi offerte"
          value={analysisMode}
          onChange={setAnalysisMode}
          options={[
            { label: "% proprietaria", value: "score", description: "Score: valore, storico conferme e anzianita offerta." },
            { label: "ABC", value: "abc", description: "Classificazione sul valore cumulato." },
          ]}
        />
        <OptionSelect id="offer-competence-filter" label="Competenza" value={competenceFilter} onChange={setCompetenceFilter} options={competenceOptions} />
      </div>
      <ConfigurableDataTable columns={columns} emptyLabel="Nessuna offerta disponibile." getRowId={(item) => item.id} items={rows} storageKey="operations-offers" />
    </>
  );
}

function MaintenanceProposalView({ data, isLoading }: { data: MaintenanceResponse; isLoading: boolean }) {
  const columns = useMemo<Array<ConfigurableColumn<MaintenanceProposalItem, string>>>(
    () => [
      { key: "client", label: "Cliente", defaultWidth: 220, required: true, sortValue: (item) => item.customerName, render: (item) => item.customerName || "n/d" },
      {
        key: "work",
        label: "Commessa",
        defaultWidth: 300,
        sortValue: (item) => item.workReferenceCode,
        render: (item) => [item.workReferenceCode, item.workReferenceName].filter(Boolean).join(" - ") || "n/d",
      },
      { key: "last", label: "Ultima manutenzione", defaultWidth: 160, sortValue: (item) => Date.parse(item.lastServiceAt ?? ""), render: (item) => formatDate(item.lastServiceAt) },
      { key: "proposal", label: "Data suggerita", defaultWidth: 150, sortValue: (item) => Date.parse(item.suggestedAt ?? ""), render: (item) => formatDate(item.suggestedAt) },
      { key: "cadence", label: "Frequenza stimata", defaultWidth: 160, sortValue: (item) => item.estimatedFrequencyDays, render: (item) => `${item.estimatedFrequencyDays ?? "n/d"} giorni` },
      { key: "history", label: "Storico interventi", defaultWidth: 170, sortValue: (item) => item.historicalEventsCount, render: (item) => `${item.historicalEventsCount} interventi` },
      { key: "operator", label: "Manutentore", defaultWidth: 180, sortValue: (item) => item.preferredOperator, render: (item) => item.preferredOperator || "n/d" },
      { key: "plan", label: "Piano annuale", defaultWidth: 190, sortValue: (item) => item.annualPlanHint, render: (item) => item.annualPlanHint || "n/d" },
      { key: "urgency", label: "Urgenza", defaultWidth: 130, sortValue: (item) => urgencyRank(item.urgency), render: (item) => <Badge tone={item.urgency === "OVERDUE" ? "warn" : "info"}>{item.urgency}</Badge> },
      { key: "reason", label: "Motivo", defaultWidth: 360, render: (item) => item.reason || "n/d" },
    ],
    [],
  );

  if (!data.proposals.length) {
    return <EmptyState isLoading={isLoading} />;
  }

  return <ConfigurableDataTable columns={columns} emptyLabel="Nessuna proposta disponibile." getRowId={(item) => item.id} items={data.proposals} storageKey="operations-maintenance-proposals" />;
}

function MaintenanceCalendarView({ items, isLoading }: { items: MaintenanceCalendarItem[]; isLoading: boolean }) {
  const columns = useMemo<Array<ConfigurableColumn<MaintenanceCalendarItem, string>>>(
    () => [
      { key: "title", label: "Intervento", defaultWidth: 260, required: true, sortValue: (item) => item.title, render: (item) => <span className="font-semibold text-text-primary">{item.title}</span> },
      { key: "client", label: "Cliente", defaultWidth: 220, sortValue: (item) => item.customerName, render: (item) => item.customerName || "n/d" },
      { key: "work", label: "Commessa", defaultWidth: 260, sortValue: (item) => item.workReferenceCode, render: (item) => [item.workReferenceCode, item.workReferenceName].filter(Boolean).join(" - ") || "n/d" },
      { key: "start", label: "Inizio", defaultWidth: 180, sortValue: (item) => Date.parse(item.plannedStartAt ?? ""), render: (item) => formatDateTime(item.plannedStartAt) },
      { key: "end", label: "Fine", defaultWidth: 180, sortValue: (item) => Date.parse(item.plannedEndAt ?? ""), render: (item) => formatDateTime(item.plannedEndAt) },
      { key: "status", label: "Stato", defaultWidth: 130, sortValue: (item) => item.status, render: (item) => <Badge>{item.status}</Badge> },
      { key: "assignee", label: "Assegnato a", defaultWidth: 170, sortValue: (item) => item.assigneeName, render: (item) => item.assigneeName || "n/d" },
      { key: "note", label: "Note", defaultWidth: 320, render: (item) => item.note || "n/d" },
    ],
    [],
  );

  if (!items.length) {
    return <EmptyState isLoading={isLoading} />;
  }

  return <ConfigurableDataTable columns={columns} emptyLabel="Nessuna voce calendario disponibile." getRowId={(item) => item.id} items={items} storageKey="operations-maintenance-calendar" />;
}

function isGeoPoint(item: CustomerMapItem): item is CustomerMapItem & CustomerGeoPoint {
  return typeof item.latitude === "number" && typeof item.longitude === "number";
}

function buildAbcOffers(items: OfferPriorityItem[]): OfferPriorityItem[] {
  const sorted = [...items].sort((left, right) => Number(right.totalAmount ?? 0) - Number(left.totalAmount ?? 0));
  const totalValue = sorted.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0);
  let cumulativeValue = 0;

  return sorted.map((item) => {
    cumulativeValue += Number(item.totalAmount ?? 0);
    const cumulativeShare = totalValue ? cumulativeValue / totalValue : 0;
    return {
      ...item,
      abcClass: cumulativeShare <= 0.8 ? "A" : cumulativeShare <= 0.95 ? "B" : "C",
      cumulativeShare,
    };
  });
}

function abcRank(value: string): number {
  if (value === "A") {
    return 3;
  }
  if (value === "B") {
    return 2;
  }
  return 1;
}

function urgencyRank(value: string): number {
  if (value === "OVERDUE") {
    return 4;
  }
  if (value === "DUE_SOON") {
    return 3;
  }
  if (value === "PLANNED") {
    return 2;
  }
  return 1;
}

function distanceKm(left: CustomerGeoPoint, right: CustomerGeoPoint): number {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(right.latitude - left.latitude);
  const lonDelta = toRadians(right.longitude - left.longitude);
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function buildItineraryUrl(anchor: CustomerGeoPoint | null, destination: CustomerGeoPoint): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", "Via Giacomin Dorino, 5, 32030 Fonzaso BL, Italia");
  if (anchor) {
    url.searchParams.set("waypoints", `${anchor.latitude},${anchor.longitude}`);
  }
  url.searchParams.set("destination", `${destination.latitude},${destination.longitude}`);
  return url.toString();
}
