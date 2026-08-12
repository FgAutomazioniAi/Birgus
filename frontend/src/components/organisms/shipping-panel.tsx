"use client";

import {
  ArrowLeft,
  Box,
  Boxes,
  Eye,
  Eraser,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Package,
  PackageOpen,
  Palette,
  RefreshCcw,
  Ruler,
  Save,
  ScrollText,
  SquareStack,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";
import {
  calcolaSpedizioni,
  type CopertinaType,
  defaultSpedizioniInput,
  type SpedizioniCalcolo,
  type SpedizioniInput,
  type SopracopertaType,
} from "@/lib/shipping-calculator";

type SpedizioniTab = "layout" | "copertina" | "brossura" | "sopracoperta" | "custodia";
type TechnicalView = "brossura" | "cartonata" | "sopracoperta";
type ViewMode = "floating" | "sidebar";

interface ShipmentDetailPayload {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  projectVersionId: number;
  projectVersionLabel: string;
  clientId: string | null;
  clientName: string | null;
  statusKey: string;
  notes: string | null;
  createdAt: string;
  specification: {
    inputPayload: Partial<SpedizioniInput> | null;
    calculationPayload: Partial<SpedizioniCalcolo> | null;
    updatedAt: string | null;
  } | null;
}

const copertinaOptions: { label: string; value: CopertinaType }[] = [
  { label: "Dorso quadro", value: "quadro" },
  { label: "Dorso tondo", value: "tondo" },
  { label: "Olandese", value: "olandese" },
];

const sopracopertaOptions: { label: string; value: SopracopertaType }[] = [
  { label: "Normale", value: "normale" },
  { label: "Antistrappo", value: "antistrappo" },
];

const sectionClassName =
  "rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted/60 p-4";

const technicalButtonClassName = (active: boolean) =>
  [
    "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-semibold transition-colors",
    active
      ? "border-brand-primary bg-status-info-bg text-brand-primary"
      : "border-border-default bg-bg-surface text-text-secondary hover:bg-bg-subtle",
  ].join(" ");

const formatMillimeters = (value: number) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"} mm`;

function EmptyTechnicalState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted p-6 text-center">
      <Text variant="muted">{message}</Text>
    </div>
  );
}

function BrossuraPreview({
  calc,
  compact = false,
  form,
}: {
  calc: SpedizioniCalcolo;
  compact?: boolean;
  form: SpedizioniInput;
}) {
  const aletta = Math.max(0, form.f17AletteBrossura);
  const piatto = Math.max(0, form.e9BaseRifilato + (aletta > 0 ? form.f18Unghia : 0));
  const dorso = Math.max(0, calc.h16);
  const totale = Math.max(0, (aletta * 2) + (piatto * 2) + dorso);
  const altezza = Math.max(0, form.f9AltezzaRifilato);

  if (totale <= 0 || altezza <= 0) {
    return <EmptyTechnicalState message="Compila i dati base per visualizzare la tavola brossura." />;
  }

  const viewBoxWidth = compact ? 460 : 880;
  const viewBoxHeight = compact ? 220 : 360;
  const drawWidth = compact ? 340 : 710;
  const drawHeight = compact ? 120 : 190;
  const scale = Math.min(drawWidth / totale, drawHeight / altezza);
  const w = totale * scale;
  const h = altezza * scale;
  const x = (viewBoxWidth - w) / 2;
  const y = (viewBoxHeight - h) / 2;
  const cutA = aletta * scale;
  const cutB = (aletta + piatto) * scale;
  const cutC = (aletta + piatto + dorso) * scale;
  const cutD = (aletta + (piatto * 2) + dorso) * scale;

  return (
    <div className="space-y-2">
      <Text className="text-sm font-bold text-brand-primary">COP. Brossatura</Text>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-2">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className={compact ? "h-[130px] w-full" : "h-[220px] w-full min-w-[420px]"}
        >
          <rect x={x - 12} y={y - 12} width={w + 24} height={h + 24} fill="none" stroke="var(--token-color-border-default)" strokeDasharray="4 3" />
          <rect x={x} y={y} width={w} height={h} fill="var(--token-color-bg-surface)" stroke="var(--token-color-text-primary)" strokeWidth={1.5} />
          {[cutA, cutB, cutC, cutD].map((cut, index) => (
            <line
              key={`brossura-cut-${index}`}
              x1={x + cut}
              y1={y}
              x2={x + cut}
              y2={y + h}
              stroke="var(--token-color-border-default)"
              strokeDasharray="3 3"
            />
          ))}
          <text x={x + cutA / 2} y={y + h / 2} textAnchor="middle" className="fill-text-secondary text-[12px] font-semibold">
            {aletta > 0 ? aletta : 0}
          </text>
          <text x={x + cutA + ((cutB - cutA) / 2)} y={y + h / 2} textAnchor="middle" className="fill-text-secondary text-[12px] font-semibold">
            {piatto.toFixed(0)}
          </text>
          <text x={x + cutB + ((cutC - cutB) / 2)} y={y + h / 2} textAnchor="middle" className="fill-text-secondary text-[12px] font-semibold">
            {dorso.toFixed(0)}
          </text>
          <text x={x + cutC + ((cutD - cutC) / 2)} y={y + h / 2} textAnchor="middle" className="fill-text-secondary text-[12px] font-semibold">
            {piatto.toFixed(0)}
          </text>
          <text x={x + cutD + ((w - cutD) / 2)} y={y + h / 2} textAnchor="middle" className="fill-text-secondary text-[12px] font-semibold">
            {aletta > 0 ? aletta : 0}
          </text>
          <line x1={x} y1={y + h + 28} x2={x + w} y2={y + h + 28} stroke="var(--token-color-text-muted)" strokeWidth={1} />
          <text x={x + (w / 2)} y={y + h + 24} textAnchor="middle" className="fill-brand-primary text-[14px] font-bold">
            {totale.toFixed(1)}
          </text>
          <line x1={x - 28} y1={y} x2={x - 28} y2={y + h} stroke="var(--token-color-text-muted)" strokeWidth={1} />
          <text transform={`translate(${x - 34}, ${y + (h / 2)}) rotate(-90)`} textAnchor="middle" className="fill-brand-primary text-[14px] font-bold">
            {altezza.toFixed(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function CartonataPreview({
  calc,
  compact = false,
}: {
  calc: SpedizioniCalcolo;
  compact?: boolean;
}) {
  if (!calc.hasCopertinaCartonata) {
    return <EmptyTechnicalState message="Inserisci i dati della copertina cartonata per generare rivestimento e quadranti." />;
  }

  const risvolto = Math.max(0, calc.k23);
  const piatto = Math.max(0, calc.j23);
  const canalino = Math.max(0, calc.i23);
  const dorso = Math.max(0, calc.h23);
  const totale = Math.max(calc.o23, (risvolto * 2) + (piatto * 2) + (canalino * 2) + dorso);
  const altezza = Math.max(1, calc.p23);

  const viewBoxWidth = compact ? 500 : 940;
  const viewBoxHeight = compact ? 250 : 380;
  const drawWidth = compact ? 330 : 520;
  const drawHeight = compact ? 120 : 180;
  const scale = Math.min(drawWidth / totale, drawHeight / altezza);
  const w = totale * scale;
  const h = altezza * scale;
  const x = compact ? 20 : 32;
  const y = (viewBoxHeight - h) / 2;
  const chamfer = Math.min(18, h / 4);
  const partitions = [risvolto, piatto, canalino, dorso, canalino, piatto, risvolto];
  let cumulative = 0;
  const separators = partitions.slice(0, -1).map((segment) => {
    cumulative += segment;
    return cumulative * scale;
  });

  const quadrantiX = x + w + (compact ? 30 : 60);
  const quadrantiY = y;
  const quadrantiHeight = Math.max(40, (calc.p25 || calc.p23) * scale * 0.75);
  const quadrantiScale = Math.min(1.2, drawHeight / Math.max(calc.p25 || 1, 1));
  const boardWidth = Math.max(24, calc.o25 * quadrantiScale * 0.5);
  const spineWidth = Math.max(16, calc.m25 * quadrantiScale * 0.5);

  return (
    <div className="space-y-2">
      <Text className="text-sm font-bold text-brand-primary">COP. Cartonata</Text>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-2">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className={compact ? "h-[130px] w-full" : "h-[240px] w-full min-w-[460px]"}
        >
          <path
            d={`M ${x + chamfer} ${y} H ${x + w - chamfer} L ${x + w} ${y + chamfer} V ${y + h - chamfer} L ${x + w - chamfer} ${y + h} H ${x + chamfer} L ${x} ${y + h - chamfer} V ${y + chamfer} Z`}
            fill="var(--token-color-bg-surface)"
            stroke="var(--token-color-text-primary)"
            strokeWidth={1.5}
          />
          {separators.map((value, index) => (
            <line
              key={`cartonata-cut-${index}`}
              x1={x + value}
              y1={y}
              x2={x + value}
              y2={y + h}
              stroke="var(--token-color-border-default)"
              strokeDasharray="3 3"
            />
          ))}
          <line x1={x} y1={y + h + 26} x2={x + w} y2={y + h + 26} stroke="var(--token-color-text-muted)" strokeWidth={1} />
          <text x={x + (w / 2)} y={y + h + 22} textAnchor="middle" className="fill-brand-primary text-[14px] font-bold">
            {totale.toFixed(1)}
          </text>
          <line x1={x - 24} y1={y} x2={x - 24} y2={y + h} stroke="var(--token-color-text-muted)" strokeWidth={1} />
          <text transform={`translate(${x - 30}, ${y + (h / 2)}) rotate(-90)`} textAnchor="middle" className="fill-brand-primary text-[14px] font-bold">
            {altezza.toFixed(1)}
          </text>
          <text x={quadrantiX} y={y - 10} className="fill-brand-primary text-[14px] font-bold">
            Quadranti
          </text>
          <rect x={quadrantiX} y={quadrantiY} width={boardWidth} height={quadrantiHeight} fill="var(--token-color-bg-surface)" stroke="var(--token-color-text-primary)" />
          <rect x={quadrantiX + boardWidth + 16} y={quadrantiY} width={spineWidth} height={quadrantiHeight} fill="var(--token-color-bg-surface)" stroke="var(--token-color-text-primary)" />
          <rect
            x={quadrantiX + boardWidth + spineWidth + 32}
            y={quadrantiY}
            width={boardWidth}
            height={quadrantiHeight}
            fill="var(--token-color-bg-surface)"
            stroke="var(--token-color-text-primary)"
          />
        </svg>
      </div>
    </div>
  );
}

function SopracopertaPreview({
  calc,
  compact = false,
  form,
}: {
  calc: SpedizioniCalcolo;
  compact?: boolean;
  form: SpedizioniInput;
}) {
  if (!calc.hasSopracoperta) {
    return <EmptyTechnicalState message="Imposta le alette sopracoperta per generare la vista." />;
  }

  const aletta = Math.max(0, form.j29AletteSopracoperta);
  const piatto = Math.max(0, calc.i29);
  const dorso = Math.max(0, calc.h29);
  const totale = Math.max(calc.o29, (aletta * 2) + (piatto * 2) + dorso);
  const altezza = Math.max(1, calc.p29);

  const viewBoxWidth = compact ? 460 : 860;
  const viewBoxHeight = compact ? 220 : 350;
  const drawWidth = compact ? 330 : 680;
  const drawHeight = compact ? 120 : 190;
  const scale = Math.min(drawWidth / totale, drawHeight / altezza);
  const w = totale * scale;
  const h = altezza * scale;
  const x = (viewBoxWidth - w) / 2;
  const y = (viewBoxHeight - h) / 2;
  const cutA = aletta * scale;
  const cutB = (aletta + piatto) * scale;
  const cutC = (aletta + piatto + dorso) * scale;
  const cutD = (aletta + (piatto * 2) + dorso) * scale;

  return (
    <div className="space-y-2">
      <Text className="text-sm font-bold text-brand-primary">Sopracoperta</Text>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-2">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className={compact ? "h-[130px] w-full" : "h-[220px] w-full min-w-[420px]"}
        >
          <rect x={x} y={y} width={w} height={h} fill="var(--token-color-bg-surface)" stroke="var(--token-color-text-primary)" strokeWidth={1.5} />
          {[cutA, cutB, cutC, cutD].map((cut, index) => (
            <line
              key={`sopracoperta-cut-${index}`}
              x1={x + cut}
              y1={y}
              x2={x + cut}
              y2={y + h}
              stroke="var(--token-color-border-default)"
              strokeDasharray="3 3"
            />
          ))}
          <line x1={x} y1={y + h + 28} x2={x + w} y2={y + h + 28} stroke="var(--token-color-text-muted)" strokeWidth={1} />
          <text x={x + (w / 2)} y={y + h + 24} textAnchor="middle" className="fill-brand-primary text-[14px] font-bold">
            {totale.toFixed(1)}
          </text>
          <line x1={x - 26} y1={y} x2={x - 26} y2={y + h} stroke="var(--token-color-text-muted)" strokeWidth={1} />
          <text transform={`translate(${x - 32}, ${y + (h / 2)}) rotate(-90)`} textAnchor="middle" className="fill-brand-primary text-[14px] font-bold">
            {altezza.toFixed(1)}
          </text>
        </svg>
      </div>
    </div>
  );
}

export function ShippingPanel({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<SpedizioniInput>(defaultSpedizioniInput);
  const [shipment, setShipment] = useState<ShipmentDetailPayload | null>(null);
  const [activeTab, setActiveTab] = useState<SpedizioniTab>("layout");
  const [quickToolsOpen, setQuickToolsOpen] = useState(true);
  const [technicalView, setTechnicalView] = useState<TechnicalView>("brossura");
  const [viewMode, setViewMode] = useState<ViewMode>("floating");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const technicalRef = useRef<HTMLDivElement | null>(null);

  const calc = useMemo(() => calcolaSpedizioni(form), [form]);

  useEffect(() => {
    const loadShipment = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/shipments/${shipmentId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Impossibile caricare la spedizione.");
        }

        const payload = (await response.json()) as ShipmentDetailPayload;
        setShipment(payload);

        const mergedInput: SpedizioniInput = {
          ...defaultSpedizioniInput,
          ...(payload.specification?.inputPayload ?? {}),
        };

        if (!mergedInput.titolo.trim()) {
          mergedInput.titolo = `${payload.projectName} ${payload.projectVersionLabel.toUpperCase()}`;
        }

        setForm(mergedInput);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Errore caricamento spedizione.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadShipment();
  }, [shipmentId]);

  const setNumberField =
    (field: keyof SpedizioniInput) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: raw === "" ? 0 : Number(raw),
      }));
    };

  const setStringField =
    (field: keyof SpedizioniInput) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const goLayout = () => {
    setActiveTab("layout");
    layoutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const createLayout = () => {
    // Kept intentionally: hook point for a future explicit "snapshot/rebuild layout" action.
    // Right now the technical views and layout update automatically on every field change.
    setActiveTab("layout");
    toast.success("Il layout e le tavole sono gia aggiornati automaticamente.");
  };

  const openCopertina = () => {
    if (!calc.hasCopertinaCartonata) {
      toast.warning("Dati copertina cartonata incompleti.");
      return;
    }
    setActiveTab("copertina");
    setTechnicalView("cartonata");
  };

  const openBrossura = () => {
    if (calc.h16 <= 0) {
      toast.warning("Blocco testo non sufficiente per la brossura.");
      return;
    }
    setActiveTab("brossura");
    setTechnicalView("brossura");
  };

  const openSopracoperta = () => {
    if (!calc.hasSopracoperta) {
      toast.warning("Sopracoperta non disponibile con i dati attuali.");
      return;
    }
    setActiveTab("sopracoperta");
    setTechnicalView("sopracoperta");
  };

  const openCustodia = () => {
    if (!calc.hasCustodia) {
      toast.warning("Compila le misure custodia per visualizzare la scheda.");
      return;
    }
    setActiveTab("custodia");
  };

  const clearCopertinaCartonata = () => {
    setForm((prev) => ({
      ...prev,
      copertinaType: defaultSpedizioniInput.copertinaType,
      f23SpessoreCartoni: 0,
      f25AletteOlandese: 0,
    }));
  };

  const clearSopracoperta = () => {
    setForm((prev) => ({
      ...prev,
      j29AletteSopracoperta: 0,
      sopracopertaType: defaultSpedizioniInput.sopracopertaType,
    }));
  };

  const clearCustodia = () => {
    setForm((prev) => ({
      ...prev,
      custodiaK33: 0,
      custodiaP33: 0,
      custodiaType: 1,
    }));
  };

  const openTechnical = (view: TechnicalView) => {
    setTechnicalView(view);
    technicalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveSpecification = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/shipments/${shipmentId}/specification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputPayload: form,
          calculationPayload: calc,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Salvataggio spedizione non riuscito.");
      }

      const payload = (await response.json()) as { specificationUpdatedAt?: string | null };
      setShipment((current) =>
        current
          ? {
              ...current,
              specification: {
                inputPayload: form,
                calculationPayload: calc,
                updatedAt: payload.specificationUpdatedAt ?? new Date().toISOString(),
              },
            }
          : current,
      );
      toast.success("Configurazione spedizione salvata.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Salvataggio spedizione non riuscito.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <Text variant="muted">Caricamento spedizione...</Text>
      </Card>
    );
  }

  if (!shipment) {
    return (
      <Card className="p-8 space-y-4">
        <Text variant="muted">Spedizione non disponibile.</Text>
        <Button variant="outline" onClick={() => router.push(APP_ROUTES.spedizioni)}>
          <ArrowLeft size={16} />
          Torna alle spedizioni
        </Button>
      </Card>
    );
  }

  return (
    <div className={viewMode === "sidebar" ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" : "space-y-6"}>
      <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Text as="h1" variant="h1">
              {shipment.code}
            </Text>
            <PageHelpHint text="Configura e salva i dati tecnici della spedizione collegata alla versione progetto." />
          </div>
          <Text variant="muted">
            {shipment.projectName} · {shipment.projectVersionLabel.toUpperCase()} · {shipment.clientName ?? "Cliente non associato"}
          </Text>
          <Text variant="caption">
            Stato: {shipment.statusKey} · Ultimo salvataggio: {shipment.specification?.updatedAt ? new Date(shipment.specification.updatedAt).toLocaleString("it-IT") : "mai"}
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => router.push(APP_ROUTES.spedizioni)}>
            <ArrowLeft size={16} />
            Torna alla lista
          </Button>
          <Button variant="outline" onClick={goLayout}>
            <ScrollText size={16} />
            Vai a layout
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewMode((prev) => (prev === "floating" ? "sidebar" : "floating"))}
          >
            {viewMode === "floating" ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            {viewMode === "floating" ? "Modalita sidebar tavole" : "Modalita floating tavole"}
          </Button>
          {/* <Button variant="accent" onClick={createLayout}>
            <Palette size={16} />
            Crea layout
          </Button> */}
          <Button
            variant="outline"
            onClick={() => {
              setForm({
                ...defaultSpedizioniInput,
                titolo: `${shipment.projectName} ${shipment.projectVersionLabel.toUpperCase()}`,
              });
              toast.success("Campi ripristinati.");
            }}
          >
            <RefreshCcw size={16} />
            Pulisci campi
          </Button>
          <Button onClick={() => void saveSpecification()} disabled={isSaving}>
            <Save size={16} />
            {isSaving ? "Salvataggio..." : "Salva spedizione"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card className="space-y-4 p-4 lg:p-5">
          <div className={sectionClassName}>
            <Text className="mb-3 text-sm font-bold text-brand-primary">Dati base</Text>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Text variant="caption">Titolo</Text>
                <Input value={form.titolo} onChange={setStringField("titolo")} placeholder="Titolo lavorazione" />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Copie da spedire</Text>
                <Input type="number" value={form.copieDaSpedire} onChange={setNumberField("copieDaSpedire")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Formato rifilato base (mm)</Text>
                <Input type="number" value={form.e9BaseRifilato} onChange={setNumberField("e9BaseRifilato")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Formato rifilato altezza (mm)</Text>
                <Input type="number" value={form.f9AltezzaRifilato} onChange={setNumberField("f9AltezzaRifilato")} />
              </div>
            </div>
          </div>

          <div className={sectionClassName}>
            <Text className="mb-3 text-sm font-bold text-brand-primary">Blocco testo</Text>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Text variant="caption">Tipo</Text>
                <SelectDropdown
                  value={form.bloccoType}
                  onChange={(value) => setForm((prev) => ({ ...prev, bloccoType: value as SpedizioniInput["bloccoType"] }))}
                  options={[
                    { value: "cucito", label: "Cucito" },
                    { value: "fresato", label: "Fresato" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Pagine testo 1</Text>
                <Input type="number" value={form.i7Pagine} onChange={setNumberField("i7Pagine")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">gr/m² testo 1</Text>
                <Input type="number" value={form.j7Grammatura} onChange={setNumberField("j7Grammatura")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">VSA testo 1</Text>
                <Input type="number" value={form.k7Vsa} onChange={setNumberField("k7Vsa")} />
              </div>
            </div>
          </div>

          <div className={sectionClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Text className="text-sm font-bold text-brand-primary">Copertina cartonata</Text>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-muted hover:bg-bg-subtle"
                onClick={clearCopertinaCartonata}
              >
                <Eraser size={12} />
                Cancella
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Text variant="caption">Tipologia</Text>
                <SelectDropdown
                  value={form.copertinaType}
                  onChange={(value) => setForm((prev) => ({ ...prev, copertinaType: value as CopertinaType }))}
                  options={copertinaOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Spessore cartoni (mm)</Text>
                <Input type="number" step="0.1" value={form.f23SpessoreCartoni} onChange={setNumberField("f23SpessoreCartoni")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Alette olandese (mm)</Text>
                <Input type="number" value={form.f25AletteOlandese} onChange={setNumberField("f25AletteOlandese")} />
              </div>
            </div>
          </div>

          <div className={sectionClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Text className="text-sm font-bold text-brand-primary">Sopracoperta</Text>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-muted hover:bg-bg-subtle"
                onClick={clearSopracoperta}
              >
                <Eraser size={12} />
                Cancella
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Text variant="caption">Tipo</Text>
                <SelectDropdown
                  value={form.sopracopertaType}
                  onChange={(value) => setForm((prev) => ({ ...prev, sopracopertaType: value as SopracopertaType }))}
                  options={sopracopertaOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Alette (mm)</Text>
                <Input type="number" value={form.j29AletteSopracoperta} onChange={setNumberField("j29AletteSopracoperta")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Risvolto antistrappo (mm)</Text>
                <Input type="number" value={form.k29RisvoltoSopracoperta} onChange={setNumberField("k29RisvoltoSopracoperta")} />
              </div>
            </div>
          </div>

          <div className={sectionClassName}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <Text className="text-sm font-bold text-brand-primary">Custodia</Text>
              <button
                className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-muted hover:bg-bg-subtle"
                onClick={clearCustodia}
              >
                <Eraser size={12} />
                Cancella
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Text variant="caption">Tipo custodia</Text>
                <SelectDropdown
                  value={String(form.custodiaType)}
                  onChange={(value) => setForm((prev) => ({ ...prev, custodiaType: Number(value) as SpedizioniInput["custodiaType"] }))}
                  options={[
                    { value: "1", label: "Cus1 Rigida" },
                    { value: "2", label: "Cus2 Doppio spessore" },
                    { value: "3", label: "Cus3 Morbida" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Dimensione K33 (mm)</Text>
                <Input type="number" value={form.custodiaK33} onChange={setNumberField("custodiaK33")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Dimensione P33 (mm)</Text>
                <Input type="number" value={form.custodiaP33} onChange={setNumberField("custodiaP33")} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-4 lg:p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Dimensioni bancale</Text>
              <Text className="font-bold text-brand-primary">{calc.palletWidthCm} x {calc.palletHeightCm} cm</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Dimensioni scatola</Text>
              <Text className="font-bold text-brand-primary">{calc.scatolaBaseCm} x {calc.scatolaLunghezzaCm} x {calc.scatolaAltezzaCm} cm</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Copie/scatola</Text>
              <Text className="font-bold text-brand-primary">{calc.copiesPerBox}</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Scatole/piano</Text>
              <Text className="font-bold text-brand-primary">{calc.boxesPerLayer}</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Piani bancale</Text>
              <Text className="font-bold text-brand-primary">{calc.pianiBancale}</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Libri/bancale</Text>
              <Text className="font-bold text-brand-primary">{calc.copiesPerPallet}</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Peso scatola</Text>
              <Text className="font-bold text-brand-primary">{calc.boxWeightKg} kg</Text>
            </div>
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
              <Text variant="caption" className="uppercase tracking-wide">Peso bancale</Text>
              <Text className="font-bold text-brand-primary">{calc.palletWeightKg} kg</Text>
            </div>
          </div>

          <div className={sectionClassName}>
            <Text className="mb-2 text-sm font-bold text-brand-primary">Macro rapide (equivalenti Excel)</Text>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={openBrossura}>
                <PackageOpen size={14} /> COP_B
              </Button>
              <Button variant="outline" size="sm" onClick={openCopertina}>
                <Package size={14} /> COP_C
              </Button>
              <Button variant="outline" size="sm" onClick={openSopracoperta}>
                <ScrollText size={14} /> SOP
              </Button>
              <Button variant="outline" size="sm" onClick={openCustodia}>
                <SquareStack size={14} /> CUS
              </Button>
            </div>
          </div>

          <div className={sectionClassName}>
            <Text className="mb-2 text-sm font-bold text-brand-primary">Configurazione spedizione</Text>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Text variant="caption">Bancale</Text>
                <SelectDropdown
                  value={form.bancaleType}
                  onChange={(value) => setForm((prev) => ({ ...prev, bancaleType: value as SpedizioniInput["bancaleType"] }))}
                  options={[
                    { value: "100x120", label: "100 x 120" },
                    { value: "80x120", label: "80 x 120" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Prodotto cartonata</Text>
                <label className="flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-3 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={form.d51Cartonato}
                    onChange={(event) => setForm((prev) => ({ ...prev, d51Cartonato: event.target.checked }))}
                  />
                  Cartonato (deseleziona per brossura)
                </label>
              </div>
              <div className="space-y-1">
                <Text variant="caption">Max altezza bancale (cm)</Text>
                <Input type="number" value={form.maxAltezzaBancaleCm} onChange={setNumberField("maxAltezzaBancaleCm")} />
              </div>
              <div className="space-y-1">
                <Text variant="caption">Max peso bancale (kg)</Text>
                <Input type="number" value={form.maxPesoBancaleKg} onChange={setNumberField("maxPesoBancaleKg")} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-4 lg:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["layout", "Layout", Truck],
            ["copertina", "Copertina", Box],
            ["brossura", "Brossura", PackageOpen],
            ["sopracoperta", "Sopracoperta", ScrollText],
            ["custodia", "Custodia", Boxes],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              className={[
                "inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-semibold transition-colors",
                activeTab === key
                  ? "border-brand-primary bg-status-info-bg text-brand-primary"
                  : "border-border-default bg-bg-surface text-text-secondary hover:bg-bg-subtle",
              ].join(" ")}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "layout" && (
          <div ref={layoutRef} className="space-y-4">
            <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-3">
              <Text className="mb-2 text-sm font-bold text-brand-primary">Preview layout pallet</Text>
              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${calc.totalLayoutWidth + 16} ${calc.totalLayoutHeight + 16}`}
                  className="h-[360px] w-full min-w-[480px] rounded-[var(--radius-md)] border border-border-default bg-bg-surface"
                >
                  <rect
                    x={8}
                    y={8}
                    width={calc.totalLayoutWidth}
                    height={calc.totalLayoutHeight}
                    rx={4}
                    fill="var(--token-color-status-warn-bg)"
                    stroke="var(--token-color-brand-primary)"
                    strokeWidth={0.8}
                  />
                  {calc.layoutBoxes.map((box, index) => (
                    <rect
                      key={`${box.x}-${box.y}-${index}`}
                      x={8 + box.x}
                      y={8 + box.y}
                      width={box.w}
                      height={box.h}
                      rx={1.5}
                      fill={form.d51Cartonato ? "var(--token-color-bg-subtle)" : "var(--token-color-status-info-bg)"}
                      stroke="var(--token-color-border-default)"
                      strokeWidth={0.4}
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-muted sm:grid-cols-4">
                <div className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1">
                  <span className="font-bold text-text-secondary">Scatole disegnate:</span> {calc.layoutBoxes.length}
                </div>
                <div className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1">
                  <span className="font-bold text-text-secondary">Piani:</span> {calc.lastVisibleLayer}
                </div>
                <div className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1">
                  <span className="font-bold text-text-secondary">Scala:</span> {calc.layoutScaleFactor}
                </div>
                <div className="rounded-md border border-border-subtle bg-bg-surface px-2 py-1">
                  <span className="font-bold text-text-secondary">Formato:</span> {form.bancaleType}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "copertina" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={sectionClassName}>
              <Text variant="caption">Scheda copertina</Text>
              <Text className="font-bold text-brand-primary">{calc.copSheet}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Dorso copertina</Text>
              <Text className="font-bold text-brand-primary">{calc.h23 || calc.h16} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Peso libro totale</Text>
              <Text className="font-bold text-brand-primary">{calc.totalBookWeightGr} g</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Stato</Text>
              <Text className="font-bold text-brand-primary">{calc.hasCopertinaCartonata ? "Disponibile" : "Dati mancanti"}</Text>
            </div>
          </div>
        )}

        {activeTab === "brossura" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={sectionClassName}>
              <Text variant="caption">Scheda brossura</Text>
              <Text className="font-bold text-brand-primary">{calc.outputBrossura}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Dorso brossura</Text>
              <Text className="font-bold text-brand-primary">{calc.h16} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Alette brossura</Text>
              <Text className="font-bold text-brand-primary">{form.f17AletteBrossura} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Formato aperto</Text>
              <Text className="font-bold text-brand-primary">{Math.round((form.e9BaseRifilato * 2) + calc.h16)} mm</Text>
            </div>
          </div>
        )}

        {activeTab === "sopracoperta" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={sectionClassName}>
              <Text variant="caption">Scheda sopracoperta</Text>
              <Text className="font-bold text-brand-primary">{calc.sopSheet}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Dorso</Text>
              <Text className="font-bold text-brand-primary">{calc.h29} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Alette</Text>
              <Text className="font-bold text-brand-primary">{form.j29AletteSopracoperta} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Tipo</Text>
              <Text className="font-bold text-brand-primary">{form.sopracopertaType}</Text>
            </div>
          </div>
        )}

        {activeTab === "custodia" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={sectionClassName}>
              <Text variant="caption">Scheda custodia</Text>
              <Text className="font-bold text-brand-primary">Cus{form.custodiaType}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">K33</Text>
              <Text className="font-bold text-brand-primary">{form.custodiaK33} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">P33</Text>
              <Text className="font-bold text-brand-primary">{form.custodiaP33} mm</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Stato</Text>
              <Text className="font-bold text-brand-primary">{calc.hasCustodia ? "Disponibile" : "Dati mancanti"}</Text>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 lg:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={sectionClassName}>
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-brand-primary" />
              <Text variant="caption">Scatole / piano</Text>
            </div>
            <Text className="mt-1 font-bold text-brand-primary">{calc.boxesPerLayer}</Text>
          </div>
          <div className={sectionClassName}>
            <div className="flex items-center gap-2">
              <Ruler size={14} className="text-brand-primary" />
              <Text variant="caption">Altezza bancale</Text>
            </div>
            <Text className="mt-1 font-bold text-brand-primary">{calc.m56} cm</Text>
          </div>
          <div className={sectionClassName}>
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-brand-primary" />
              <Text variant="caption">Bancali interi</Text>
            </div>
            <Text className="mt-1 font-bold text-brand-primary">{calc.m58}</Text>
          </div>
          <div className={sectionClassName}>
            <div className="flex items-center gap-2">
              <Package size={14} className="text-brand-primary" />
              <Text variant="caption">Bancale parziale</Text>
            </div>
            <Text className="mt-1 font-bold text-brand-primary">{calc.partialPalletWeightKg} kg</Text>
          </div>
        </div>
      </Card>

      <div ref={technicalRef}>
        <Card className="space-y-4 p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Text className="text-sm font-bold text-brand-primary">Tavole Tecniche</Text>
              <Text variant="caption">Aggiornamento automatico sui dati inseriti, in stile fogli output Excel.</Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className={technicalButtonClassName(technicalView === "brossura")}
                onClick={() => setTechnicalView("brossura")}
              >
                COP. Brossatura
              </button>
              <button
                className={technicalButtonClassName(technicalView === "cartonata")}
                onClick={() => setTechnicalView("cartonata")}
              >
                COP. Cartonata
              </button>
              <button
                className={technicalButtonClassName(technicalView === "sopracoperta")}
                onClick={() => setTechnicalView("sopracoperta")}
              >
                Sopracoperta
              </button>
            </div>
          </div>

          {technicalView === "brossura" && <BrossuraPreview form={form} calc={calc} />}
          {technicalView === "cartonata" && <CartonataPreview calc={calc} />}
          {technicalView === "sopracoperta" && <SopracopertaPreview form={form} calc={calc} />}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={sectionClassName}>
              <Text variant="caption">Formato aperto brossura</Text>
              <Text className="font-bold text-brand-primary">{formatMillimeters(calc.k16)}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Formato rivestimento cartonata</Text>
              <Text className="font-bold text-brand-primary">{formatMillimeters(calc.o23)}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Formato aperto sopracoperta</Text>
              <Text className="font-bold text-brand-primary">{formatMillimeters(calc.o29)}</Text>
            </div>
            <div className={sectionClassName}>
              <Text variant="caption">Altezza tecnica corrente</Text>
              <Text className="font-bold text-brand-primary">
                {technicalView === "brossura" && formatMillimeters(calc.l16)}
                {technicalView === "cartonata" && formatMillimeters(calc.p23)}
                {technicalView === "sopracoperta" && formatMillimeters(calc.p29)}
              </Text>
            </div>
          </div>
        </Card>
      </div>
      </div>

      {viewMode === "sidebar" && (
        <aside className="h-fit">
          <div className="xl:fixed xl:right-8 xl:top-24 xl:w-[360px] xl:z-20">
            <Card className="flex max-h-[calc(100vh-7rem)] flex-col p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Text className="text-xs font-bold uppercase tracking-wide text-brand-primary">Sidebar Tavole</Text>
                <Eye size={14} className="text-brand-primary" />
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <button className={technicalButtonClassName(technicalView === "brossura")} onClick={() => openTechnical("brossura")}>
                  Bross.
                </button>
                <button className={technicalButtonClassName(technicalView === "cartonata")} onClick={() => openTechnical("cartonata")}>
                  Cart.
                </button>
                <button className={technicalButtonClassName(technicalView === "sopracoperta")} onClick={() => openTechnical("sopracoperta")}>
                  Sopra.
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-2">
                  <BrossuraPreview form={form} calc={calc} compact />
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-2">
                  <CartonataPreview calc={calc} compact />
                </div>
                <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-2">
                  <SopracopertaPreview form={form} calc={calc} compact />
                </div>
              </div>
            </Card>
          </div>
        </aside>
      )}

      {viewMode === "floating" && (
        <>
          <button
            className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-3 text-sm font-semibold text-text-secondary shadow-card hover:bg-bg-subtle"
            onClick={() => setQuickToolsOpen((prev) => !prev)}
          >
            {quickToolsOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            Tavole
          </button>

          <div
            className={[
              "fixed bottom-20 right-5 z-40 w-[320px] rounded-[var(--radius-xl)] border border-border-default bg-bg-surface p-3 shadow-elevated transition-all duration-200",
              quickToolsOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            ].join(" ")}
          >
            <div className="mb-2 flex items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wide text-brand-primary">Visualizzatore rapido</Text>
              <Eye size={14} className="text-brand-primary" />
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <button className={technicalButtonClassName(technicalView === "brossura")} onClick={() => setTechnicalView("brossura")}>
                Bross.
              </button>
              <button className={technicalButtonClassName(technicalView === "cartonata")} onClick={() => setTechnicalView("cartonata")}>
                Cart.
              </button>
              <button className={technicalButtonClassName(technicalView === "sopracoperta")} onClick={() => setTechnicalView("sopracoperta")}>
                Sopra.
              </button>
            </div>
            <div className="mb-3 overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted p-1">
              {technicalView === "brossura" && <BrossuraPreview form={form} calc={calc} compact />}
              {technicalView === "cartonata" && <CartonataPreview calc={calc} compact />}
              {technicalView === "sopracoperta" && <SopracopertaPreview form={form} calc={calc} compact />}
            </div>
            <Button variant="accent" size="sm" className="w-full" onClick={() => openTechnical(technicalView)}>
              Vai alla tavola
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
