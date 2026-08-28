"use client";

import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";

interface Intervention {
  id: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CANCELED";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  message: string;
  createdAt: string;
  workflowId: string;
  workflowLabel: string;
  assignedUser: { name: string } | null;
}

const priorityClass: Record<Intervention["priority"], string> = {
  low: "text-text-muted",
  normal: "text-brand-primary",
  high: "text-status-warning-text",
  urgent: "text-status-danger-text",
};

export function HumanInterventionsPanel() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Intervention[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [isDecidingId, setIsDecidingId] = useState<string | null>(null);

  const loadCount = async () => {
    const response = await fetch("/api/workflow-interventions/open-count", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json() as { count?: number };
    setCount(typeof payload.count === "number" ? payload.count : 0);
  };
  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/workflow-interventions?scope=mine", { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare gli interventi.");
      const payload = await response.json() as { interventions?: Intervention[] };
      setItems(Array.isArray(payload.interventions) ? payload.interventions : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore caricamento interventi.");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    void loadCount();
    const interval = window.setInterval(() => void loadCount(), 10_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => { if (isOpen) void loadItems(); }, [isOpen]);

  const decide = async (id: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUIRED") => {
    setIsDecidingId(id);
    try {
      const response = await fetch(`/api/workflow-interventions/${id}/decision`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: noteById[id]?.trim() || null }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Decisione non registrata.");
      setItems((current) => current.filter((item) => item.id !== id));
      setCount((current) => Math.max(0, current - 1));
      toast.success("Decisione registrata. Il workflow riprende dal nodo successivo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decisione non registrata.");
    } finally {
      setIsDecidingId(null);
    }
  };

  return (
    <>
      <Card className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Clock3 className="h-5 w-5 shrink-0 text-status-warning-text" />
          <div className="min-w-0"><Text className="font-semibold">Interventi da gestire</Text><Text variant="caption">Decisioni umane che tengono in attesa un workflow.</Text></div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setIsOpen(true)}>
          Apri coda{count > 0 ? ` (${count})` : ""}
        </Button>
      </Card>
      {isOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-label="Interventi da gestire">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border-default bg-bg-surface shadow-elevated">
            <div className="flex items-center justify-between border-b border-border-default px-5 py-4"><div><Text as="h2" variant="h2" className="text-lg">Interventi da gestire</Text><Text variant="caption">Le decisioni riprendono il workflow senza ripetere gli step precedenti.</Text></div><button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-2 text-text-muted hover:bg-bg-muted" aria-label="Chiudi">x</button></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {isLoading ? <Text variant="muted">Caricamento interventi...</Text> : null}
              {!isLoading && items.length === 0 ? <Text variant="muted">Non ci sono interventi aperti.</Text> : null}
              <div className="divide-y divide-border-subtle">
                {items.map((item) => (
                  <section key={item.id} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-text-primary">{item.title}</p><p className="mt-1 text-sm text-text-secondary">{item.message}</p><p className="mt-2 text-xs text-text-muted">{item.workflowLabel} · {new Date(item.createdAt).toLocaleString("it-IT")}{item.assignedUser ? ` · ${item.assignedUser.name}` : ""}</p></div><span className={`text-xs font-bold uppercase ${priorityClass[item.priority]}`}>{item.priority}</span></div>
                    <textarea value={noteById[item.id] ?? ""} onChange={(event) => setNoteById((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Nota decisione (facoltativa)" rows={2} className="mt-3 w-full rounded-md border border-border-default bg-bg-page px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary" />
                    <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="accent" disabled={isDecidingId === item.id} onClick={() => void decide(item.id, "APPROVED")}><CheckCircle2 size={15} />Approva</Button><Button size="sm" variant="outline" disabled={isDecidingId === item.id} onClick={() => void decide(item.id, "CHANGES_REQUIRED")}>Richiedi modifiche</Button><Button size="sm" variant="outline" disabled={isDecidingId === item.id} onClick={() => void decide(item.id, "REJECTED")}><XCircle size={15} />Rifiuta</Button></div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
