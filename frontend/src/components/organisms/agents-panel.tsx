"use client";

import { RefreshCcw, Save, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Text } from "@/components/atoms";
import { PageHelpHint, SearchField } from "@/components/molecules";
import { cn } from "@/lib/cn";
import type { ProjectAgentListItem } from "@/lib/types";

interface ProjectAgentsResponse {
  agents?: ProjectAgentListItem[];
}

interface GroupedProjectAgents {
  modules: Array<{
    moduleKey: string;
    moduleName: string;
    agents: ProjectAgentListItem[];
  }>;
  projectId: string;
  projectName: string;
}

const MODULE_LABELS: Record<string, string> = {
  agent_management: "Gestione Agenti",
  ddt_processing: "DDT Reader",
  document_archive: "Archiviazione Documenti",
  project_management: "Gestione Progetti",
  shipment_management: "Gestione Spedizioni",
};

const prettifyModuleName = (moduleKey: string, moduleName: string): string => {
  if (MODULE_LABELS[moduleKey]) {
    return MODULE_LABELS[moduleKey];
  }

  const source = (moduleName || moduleKey).trim();
  if (!source) {
    return "Modulo";
  }

  return source
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const truncatePrompt = (prompt: string): string => {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (compact.length <= 120) {
    return compact;
  }

  return `${compact.slice(0, 117)}...`;
};

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function AgentsPanel() {
  const [agents, setAgents] = useState<ProjectAgentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<ProjectAgentListItem | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/agents", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento agenti");
      }

      const payload = (await response.json()) as ProjectAgentsResponse;
      setAgents(payload.agents ?? []);
    } catch {
      toast.error("Impossibile caricare gli agenti del workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAgents();
  }, []);

  const filteredAgents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return agents;
    }

    return agents.filter((agent) => {
      const haystack = [
        agent.projectName,
        agent.moduleKey,
        agent.moduleName,
        agent.key,
        agent.name,
        agent.label,
        agent.activePrompt,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [agents, searchTerm]);

  const groupedProjects = useMemo<GroupedProjectAgents[]>(() => {
    const projectMap = new Map<string, GroupedProjectAgents>();

    for (const agent of filteredAgents) {
      const projectEntry = projectMap.get(agent.projectId) ?? {
        projectId: agent.projectId,
        projectName: agent.projectName,
        modules: [],
      };

      let moduleEntry = projectEntry.modules.find((item) => item.moduleKey === agent.moduleKey);
      if (!moduleEntry) {
        moduleEntry = {
          moduleKey: agent.moduleKey,
          moduleName: prettifyModuleName(agent.moduleKey, agent.moduleName),
          agents: [],
        };
        projectEntry.modules.push(moduleEntry);
      }

      moduleEntry.agents.push(agent);
      projectMap.set(agent.projectId, projectEntry);
    }

    return Array.from(projectMap.values())
      .sort((left, right) => left.projectName.localeCompare(right.projectName, "it"))
      .map((project) => ({
        ...project,
        modules: [...project.modules].sort((left, right) => left.moduleName.localeCompare(right.moduleName, "it")),
      }));
  }, [filteredAgents]);

  const openAgentModal = (agent: ProjectAgentListItem) => {
    setSelectedAgent(agent);
    setDraftPrompt(agent.activePrompt);
  };

  const closeAgentModal = (force = false) => {
    if (!force && (isSaving || isResetting)) {
      return;
    }

    setSelectedAgent(null);
    setDraftPrompt("");
  };

  const syncAgentInState = (agentId: string, nextPrompt: string, nextUpdatedAt: string) => {
    setAgents((current) =>
      current.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              activePrompt: nextPrompt,
              updatedAt: nextUpdatedAt,
            }
          : agent,
      ),
    );

    setSelectedAgent((current) =>
      current && current.id === agentId
        ? {
            ...current,
            activePrompt: nextPrompt,
            updatedAt: nextUpdatedAt,
          }
        : current,
    );
  };

  const savePrompt = async () => {
    if (!selectedAgent) {
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePrompt: draftPrompt }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Errore salvataggio prompt");
      }

      const payload = (await response.json()) as {
        activePrompt: string;
        updatedAt: string;
      };

      syncAgentInState(selectedAgent.id, payload.activePrompt, payload.updatedAt);
      toast.success("Prompt aggiornato correttamente.");
      closeAgentModal(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore salvataggio prompt.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetPrompt = async () => {
    if (!selectedAgent) {
      return;
    }

    try {
      setIsResetting(true);
      const response = await fetch(`/api/agents/${selectedAgent.id}/reset-prompt`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Errore reset prompt");
      }

      const payload = (await response.json()) as {
        activePrompt: string;
        updatedAt: string;
      };

      setDraftPrompt(payload.activePrompt);
      syncAgentInState(selectedAgent.id, payload.activePrompt, payload.updatedAt);
      toast.success("Prompt ripristinato all'originale.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore reset prompt.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            Agenti
          </Text>
          <PageHelpHint text="Visualizza gli agenti per progetto e modifica il prompt attivo quando serve." />
        </div>
        <Text variant="muted">
          Gestione centralizzata degli agenti collegati ai moduli di progetto.
        </Text>
      </header>

      <Card className="space-y-4 p-4 lg:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Text as="h2" variant="h2" className="text-lg">
              Catalogo agenti
            </Text>
            <Text variant="caption">
              Ogni agente appartiene a un progetto ed e associato formalmente a un modulo applicativo.
            </Text>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <SearchField
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Cerca per progetto, modulo, nome agente o prompt"
              className="w-full lg:w-[360px]"
            />
            <Button variant="outline" onClick={() => void loadAgents()}>
              <RefreshCcw size={16} />
              Aggiorna
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted p-6 text-center">
            <Text variant="muted">Caricamento agenti...</Text>
          </div>
        ) : groupedProjects.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted p-6 text-center">
            <Text variant="muted">Nessun agente configurato per i progetti presenti nel workspace.</Text>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedProjects.map((project) => (
              <Card key={project.projectId} className="overflow-hidden border-border-subtle">
                <div className="border-b border-border-subtle bg-bg-muted/60 px-4 py-3 lg:px-5">
                  <Text className="text-sm font-extrabold uppercase tracking-wide text-brand-primary">
                    {project.projectName}
                  </Text>
                  <Text variant="caption">
                    Moduli con agenti configurati: {project.modules.length}
                  </Text>
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-5 xl:grid-cols-3">
                  {project.modules.map((moduleGroup) => (
                    <div
                      key={`${project.projectId}-${moduleGroup.moduleKey}`}
                      className="rounded-[var(--radius-lg)] border border-border-default bg-bg-surface p-4 shadow-card"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Text className="truncate text-sm font-bold text-text-primary">
                            {moduleGroup.moduleName}
                          </Text>
                          <Text variant="caption">{moduleGroup.agents.length} agenti</Text>
                        </div>
                        <Sparkles size={16} className="text-brand-primary" />
                      </div>

                      <div className="mt-4 grid gap-3">
                        {moduleGroup.agents.map((agent) => (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => openAgentModal(agent)}
                            className={cn(
                              "rounded-[var(--radius-md)] border px-3 py-3 text-left transition-all",
                              "border-border-default bg-bg-muted/50 hover:border-brand-accent/70 hover:bg-bg-subtle",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <Text className="truncate text-sm font-bold text-text-primary">{agent.label}</Text>
                                <Text variant="caption" className="mt-0.5 block truncate">
                                  {agent.key}
                                </Text>
                              </div>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                                  agent.isEnabled
                                    ? "bg-status-success-bg text-status-success-text"
                                    : "bg-status-danger-bg text-status-danger-text",
                                )}
                              >
                                {agent.isEnabled ? "On" : "Off"}
                              </span>
                            </div>
                            <Text className="mt-3 text-xs leading-5 text-text-secondary">
                              {truncatePrompt(agent.activePrompt)}
                            </Text>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-[var(--radius-xl)] border border-border-default bg-bg-surface p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Text className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                  {prettifyModuleName(selectedAgent.moduleKey, selectedAgent.moduleName)}
                </Text>
                <Text as="h3" variant="h2" className="mt-1 text-lg">
                  {selectedAgent.label}
                </Text>
                <Text variant="caption" className="mt-1 block">
                  Progetto: {selectedAgent.projectName} · Chiave: {selectedAgent.key}
                </Text>
              </div>
              <Button variant="outline" size="sm" onClick={() => closeAgentModal()} disabled={isSaving || isResetting}>
                <X size={16} />
                Chiudi
              </Button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <Text className="text-xs font-bold uppercase tracking-wide text-text-muted">Prompt attivo</Text>
                <textarea
                  value={draftPrompt}
                  onChange={(event) => setDraftPrompt(event.target.value)}
                  rows={16}
                  className="w-full rounded-[var(--radius-lg)] border border-border-default bg-bg-surface px-4 py-3 text-sm text-text-secondary outline-none transition-all focus:border-brand-primary focus:ring-2 focus:ring-ring-primary"
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-border-default bg-bg-muted/60 p-4">
                  <Text className="text-xs font-bold uppercase tracking-wide text-text-muted">Stato</Text>
                  <Text className="mt-1 text-sm font-semibold text-text-primary">
                    {selectedAgent.isEnabled ? "Agente abilitato" : "Agente disabilitato"}
                  </Text>
                  <Text variant="caption" className="mt-2 block">
                    Ultimo aggiornamento: {formatDateTime(selectedAgent.updatedAt)}
                  </Text>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-border-default bg-bg-muted/60 p-4">
                  <Text className="text-xs font-bold uppercase tracking-wide text-text-muted">Prompt originale</Text>
                  <Text className="mt-2 text-xs leading-5 text-text-secondary">
                    {truncatePrompt(selectedAgent.originalPrompt)}
                  </Text>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => void resetPrompt()} disabled={isSaving || isResetting}>
                <RefreshCcw size={16} />
                {isResetting ? "Ripristino..." : "Resetta all'originale"}
              </Button>
              <Button onClick={() => void savePrompt()} disabled={isSaving || isResetting}>
                <Save size={16} />
                {isSaving ? "Salvataggio..." : "Salva prompt"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
