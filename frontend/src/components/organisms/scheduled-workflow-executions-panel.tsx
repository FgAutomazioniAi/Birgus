"use client";

import { CalendarClock, Pause, Play, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";

type WorkflowSchedule = {
  id: string;
  workflowLabel: string;
  label: string | null;
  repeatEverySeconds: number;
  status: "ACTIVE" | "PAUSED";
  nextRunAt: string;
  lastError: string | null;
};

const intervalLabel = (seconds: number): string => {
  if (seconds % 604_800 === 0) return `Ogni ${seconds / 604_800} sett.`;
  if (seconds % 86_400 === 0) return `Ogni ${seconds / 86_400} g.`;
  return `Ogni ${seconds / 3_600} ore`;
};

export function ScheduledWorkflowExecutionsPanel() {
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canConfigure, setCanConfigure] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/workflow-schedules/mine", {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Impossibile caricare le pianificazioni.");
      const payload = (await response.json()) as {
        schedules?: WorkflowSchedule[];
      };
      setSchedules(Array.isArray(payload.schedules) ? payload.schedules : []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossibile caricare le pianificazioni.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{ user?: { roleKeys?: string[] } }>)
          : null,
      )
      .then((session) =>
        setCanConfigure(
          (session?.user?.roleKeys ?? []).some((role) =>
            ["developer", "superuser", "admin"].includes(role),
          ),
        ),
      );
  }, []);

  const updateSchedule = async (
    schedule: WorkflowSchedule,
    paused: boolean,
  ) => {
    if (!canConfigure) return;
    try {
      setBusyId(schedule.id);
      const response = await fetch(`/api/workflow-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      if (!response.ok)
        throw new Error("Aggiornamento pianificazione non riuscito.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Aggiornamento pianificazione non riuscito.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const removeSchedule = async (schedule: WorkflowSchedule) => {
    if (!canConfigure) return;
    try {
      setBusyId(schedule.id);
      const response = await fetch(`/api/workflow-schedules/${schedule.id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw new Error("Eliminazione pianificazione non riuscita.");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Eliminazione pianificazione non riuscita.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = schedules.filter(
    (item) => item.status === "ACTIVE",
  ).length;
  return (
    <>
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarClock size={17} className="text-brand-primary" />
            <Text as="h2" variant="h2" className="text-base">
              Workflow pianificati
            </Text>
          </div>
          <Text variant="caption" className="mt-1 block">
            {isLoading ? "Caricamento..." : `${activeCount} attivi`}
          </Text>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsOpen(true);
            void load();
          }}
        >
          Visualizza
        </Button>
      </Card>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-bg-overlay p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scheduled-workflows-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busyId)
              setIsOpen(false);
          }}
        >
          <Card className="flex max-h-[80vh] w-full max-w-2xl flex-col p-0 shadow-elevated">
            <header className="flex items-start justify-between gap-4 border-b border-border-default px-5 py-4">
              <div>
                <Text as="h2" variant="h2" id="scheduled-workflows-title">
                  Workflow pianificati
                </Text>
                <Text variant="caption" className="mt-1 block">
                  Pianificazioni create da questo account.
                </Text>
              </div>
              <button
                type="button"
                title="Chiudi"
                disabled={Boolean(busyId)}
                onClick={() => setIsOpen(false)}
                className="rounded-[var(--radius-sm)] p-1.5 text-text-muted hover:bg-bg-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </header>
            <div className="min-h-0 space-y-2 overflow-y-auto p-4">
              {isLoading ? (
                <Text variant="muted">Caricamento...</Text>
              ) : schedules.length === 0 ? (
                <Text variant="muted">Nessun workflow pianificato.</Text>
              ) : (
                schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3"
                  >
                    <CalendarClock
                      size={16}
                      className="shrink-0 text-brand-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {schedule.label || schedule.workflowLabel}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {intervalLabel(schedule.repeatEverySeconds)} · Prossima:{" "}
                        {new Date(schedule.nextRunAt).toLocaleString("it-IT", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      {schedule.lastError ? (
                        <p className="mt-1 text-xs text-status-danger-text">
                          {schedule.lastError}
                        </p>
                      ) : null}
                    </div>
                    {canConfigure ? (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={busyId === schedule.id}
                          onClick={() =>
                            void updateSchedule(
                              schedule,
                              schedule.status === "ACTIVE",
                            )
                          }
                          className="rounded-[var(--radius-sm)] p-2 text-text-muted hover:bg-bg-muted hover:text-brand-primary"
                          title={
                            schedule.status === "ACTIVE"
                              ? "Sospendi"
                              : "Riattiva"
                          }
                        >
                          {schedule.status === "ACTIVE" ? (
                            <Pause size={15} />
                          ) : (
                            <Play size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === schedule.id}
                          onClick={() => void removeSchedule(schedule)}
                          className="rounded-[var(--radius-sm)] p-2 text-text-muted hover:bg-status-danger-bg hover:text-status-danger-text"
                          title="Elimina"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
