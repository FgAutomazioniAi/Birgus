"use client";

import { Archive, FolderKanban, GitBranch, Settings, UserRound, Users } from "lucide-react";
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
  if (personalOpen) return <PersonalDashboardPanel showInterventions={false} onReturnToPrivateArea={() => setPersonalOpen(false)} />;
  return <div className="space-y-6"><header className="flex items-center justify-between gap-3"><Text as="h1" variant="h1">Area privata</Text><button type="button" title="Impostazioni" onClick={() => setPersonalOpen(true)} className="rounded-md p-2 text-text-muted hover:bg-bg-muted hover:text-text-primary"><Settings size={19} /></button></header><HumanInterventionsPanel /><section><Text as="h2" variant="h2">Accessi rapidi</Text><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.filter((item) => hasModule(item.key)).map((item) => <a key={item.label} href={item.href} className="flex min-h-24 items-center gap-3 rounded-md border border-border-default bg-bg-surface p-4 hover:border-brand-primary"><item.icon size={20} className="text-brand-primary" /><span className="font-semibold text-text-primary">{item.label}</span></a>)}</div></section></div>;
}
