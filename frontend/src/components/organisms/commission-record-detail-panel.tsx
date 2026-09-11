"use client";

import { ArrowLeft, Building2, ClipboardList, FileText, Flag } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";
import { APP_ROUTES } from "@/lib/routes";

interface CommissionRecordDetail {
  id: string;
  code: string;
  title: string;
  description: string | null;
  statusLabel: string | null;
  companyName: string | null;
  currentChecklistId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function CommissionRecordDetailPanel({ id }: { id: string }) {
  const [record, setRecord] = useState<CommissionRecordDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/commission-intake/records/${id}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { record?: CommissionRecordDetail; message?: string };
      if (!response.ok || !payload.record) throw new Error(payload.message ?? "Impossibile caricare la commessa.");
      setRecord(payload.record);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossibile caricare la commessa."); }
    finally { setIsLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  if (isLoading) return <div className="px-4 py-8 text-sm text-text-muted">Caricamento commessa...</div>;
  if (!record) return <Card className="p-5"><Text variant="muted">Commessa non disponibile.</Text></Card>;
  return <div className="space-y-5"><header className="flex flex-col gap-3 border-b border-border-subtle pb-3 md:flex-row md:items-start md:justify-between"><div><Link href={APP_ROUTES.commissions} className="inline-flex h-9 items-center gap-2 text-sm font-bold text-text-secondary hover:text-text-primary"><ArrowLeft size={16} />Torna alle commesse</Link><Text as="h1" variant="h1" className="mt-2">{record.title}</Text><p className="mt-1 text-sm text-text-muted">{record.code}</p></div>{record.currentChecklistId ? <Link href={APP_ROUTES.dataCollectionChecklist(record.id)}><Button><ClipboardList size={16} />Apri checklist</Button></Link> : null}</header><div className="grid gap-4 md:grid-cols-2"><DetailCard icon={<ClipboardList size={18} />} label="Commessa / Cantiere" value={record.code} /><DetailCard icon={<Building2 size={18} />} label="Azienda collegata" value={record.companyName ?? "-"} /><DetailCard icon={<Flag size={18} />} label="Stato commessa" value={record.statusLabel ?? "-"} /><DetailCard icon={<FileText size={18} />} label="Nome lavoro" value={record.title} /></div><Card className="p-5"><Text as="h2" variant="h2" className="text-base">Descrizione lavoro</Text><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{record.description ?? "Nessuna descrizione inserita."}</p></Card></div>;
}

function DetailCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <Card className="p-4"><div className="flex items-center gap-2 text-brand-primary">{icon}<span className="text-xs font-bold uppercase">{label}</span></div><p className="mt-3 text-sm font-semibold text-text-primary">{value}</p></Card>; }
