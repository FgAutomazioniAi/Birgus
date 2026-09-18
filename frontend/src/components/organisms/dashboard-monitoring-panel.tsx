"use client";

import { Activity, ChevronDown, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, Text } from "@/components/atoms";
import { ScheduledWorkflowExecutionsPanel } from "@/components/organisms/scheduled-workflow-executions-panel";

type WorkflowRun = {
  id: string;
  status: string;
  triggerSource: string | null;
  queuedAt: string;
  errorMessage: string | null;
  user: string;
};
type MonitoringResponse = {
  workflowGroups: Array<{
    workflowId: string;
    workflowLabel: string;
    total: number;
    lastRunAt: string;
    runs: WorkflowRun[];
  }>;
  sensitiveEvents: Array<{
    id: number;
    action: string;
    createdAt: string;
    user: string;
  }>;
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";
const statusClass = (status: string) =>
  status === "COMPLETED"
    ? "text-status-success"
    : status === "FAILED"
      ? "text-status-danger"
      : "text-status-warning";

export function DashboardMonitoringPanel() {
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{ user?: { roleKeys?: string[] } }>)
          : null,
      )
      .then(async (session) => {
        const canMonitor = (session?.user?.roleKeys ?? []).some((role) =>
          ["developer", "superuser", "admin"].includes(
            role.trim().toLowerCase(),
          ),
        );
        if (!canMonitor || !active) return;
        setEnabled(true);
        try {
          const response = await fetch("/api/dashboard/monitoring", {
            cache: "no-store",
          });
          if (!response.ok)
            throw new Error("Impossibile caricare le attività monitorate.");
          const payload = (await response.json()) as MonitoringResponse;
          if (active) setData(payload);
        } catch (error) {
          if (active)
            setLoadError(
              error instanceof Error
                ? error.message
                : "Impossibile caricare le attività monitorate.",
            );
        }
      })
      .catch(() => {
        if (active)
          setLoadError("Impossibile verificare l'accesso al monitoraggio.");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;
  const isLoading = !data && !loadError;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={20} className="text-brand-primary" />
        <Text as="h2" variant="h2">
          Monitoraggio attività
        </Text>
      </div>
      <ScheduledWorkflowExecutionsPanel />
      {loadError ? (
        <Card className="border-status-danger-border p-4">
          <Text variant="muted">{loadError}</Text>
        </Card>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-text-primary">
                Esecuzioni workflow
              </div>
              <Text variant="caption">
                Raggruppate per workflow; apri una scheda per il dettaglio.
              </Text>
            </div>
            <span className="rounded-full bg-bg-muted px-2 py-1 text-xs font-semibold text-text-secondary">
              {data?.workflowGroups.length ?? 0}
            </span>
          </div>
          {isLoading ? (
            <Text variant="caption">Caricamento attività...</Text>
          ) : data?.workflowGroups.length === 0 ? (
            <Text variant="caption">
              Nessuna esecuzione dei ruoli monitorati.
            </Text>
          ) : data ? (
            <div className="space-y-2">
              {data.workflowGroups.map((group) => (
                <details
                  key={group.workflowId}
                  className="rounded-[var(--radius-sm)] border border-border-subtle bg-bg-muted/40"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block font-semibold text-text-primary">
                        {group.workflowLabel}
                      </span>
                      <span className="text-xs text-text-muted">
                        Ultima esecuzione {formatDate(group.lastRunAt)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                      {group.total}
                      <ChevronDown size={16} />
                    </span>
                  </summary>
                  <div className="border-t border-border-subtle px-3 py-2">
                    {group.runs.map((run) => (
                      <div
                        key={run.id}
                        className="grid gap-1 border-b border-border-subtle py-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <span className="text-sm text-text-secondary">
                          {run.user} · {formatDate(run.queuedAt)}
                          {run.triggerSource ? ` · ${run.triggerSource}` : ""}
                        </span>
                        <span
                          className={`text-sm font-semibold ${statusClass(run.status)}`}
                        >
                          {run.status}
                          {run.errorMessage ? " · errore" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Text variant="caption">Attività non disponibile.</Text>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert size={18} className="text-brand-primary" />
            <div className="text-base font-semibold text-text-primary">
              Modifiche sensibili
            </div>
          </div>
          {isLoading ? (
            <Text variant="caption">Caricamento attività...</Text>
          ) : data?.sensitiveEvents.length === 0 ? (
            <Text variant="caption">Nessuna modifica sensibile recente.</Text>
          ) : data ? (
            <div className="space-y-3">
              {data.sensitiveEvents.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-border-subtle pb-3 last:border-0 last:pb-0"
                >
                  <div className="text-sm font-semibold text-text-primary">
                    {event.action}
                  </div>
                  <Text variant="caption">
                    {event.user} · {formatDate(event.createdAt)}
                  </Text>
                </div>
              ))}
            </div>
          ) : (
            <Text variant="caption">Attività non disponibile.</Text>
          )}
        </Card>
      </div>
    </section>
  );
}
