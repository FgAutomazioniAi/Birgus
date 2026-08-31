"use client";

import { Archive, ChevronLeft, ChevronRight, FolderKanban, GitBranch, Settings, UserRound, Users } from "lucide-react";
import { useState } from "react";

import { Card, Text } from "@/components/atoms";
import { HumanInterventionsPanel } from "@/components/organisms/human-interventions-panel";
import { PersonalDashboardPanel } from "@/components/organisms/personal-dashboard-panel";
import { useModuleAccess } from "@/lib/module-access";
import { APP_ROUTES } from "@/lib/routes";

const shortcuts = [
  { key: "workflow_management", label: "Workflow", href: APP_ROUTES.workflows, icon: GitBranch },
  { key: "document_archive", label: "Archivio", href: APP_ROUTES.archive, icon: Archive },
  { key: "project_management", label: "Progetti", href: APP_ROUTES.projects, icon: FolderKanban },
  { key: "project_management", label: "Clienti", href: APP_ROUTES.clients, icon: Users },
];

export function WorkspaceDashboardPanel() {
  const { hasModule } = useModuleAccess();
  const [personalOpen, setPersonalOpen] = useState(false);
  if (personalOpen) return <div className="relative"><button type="button" title="Torna alla dashboard" onClick={() => setPersonalOpen(false)} className="fixed right-0 top-1/2 z-20 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-border-default bg-bg-surface text-text-secondary hover:bg-bg-muted"><UserRound size={18} /></button><PersonalDashboardPanel showInterventions={false} /></div>;
  return <div className="relative space-y-6"><button type="button" title="Impostazioni personali" onClick={() => setPersonalOpen(true)} className="fixed right-0 top-1/2 z-20 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-border-default bg-bg-surface text-text-secondary hover:bg-bg-muted"><Settings size={18} /><ChevronRight className="sr-only" /></button><header><Text as="h1" variant="h1">Dashboard</Text><Text variant="muted">Interventi e strumenti disponibili nel workspace.</Text></header><HumanInterventionsPanel /><section><Text as="h2" variant="h2">Accessi rapidi</Text><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.filter((item) => hasModule(item.key)).map((item) => <a key={item.label} href={item.href} className="flex min-h-24 items-center gap-3 rounded-md border border-border-default bg-bg-surface p-4 hover:border-brand-primary"><item.icon size={20} className="text-brand-primary" /><span className="font-semibold text-text-primary">{item.label}</span></a>)}</div></section></div>;
}
