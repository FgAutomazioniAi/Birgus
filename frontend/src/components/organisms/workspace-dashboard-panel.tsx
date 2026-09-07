"use client";

import { Archive, ClipboardList, FolderKanban, GitBranch, Settings, Users } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/atoms";
import { HumanInterventionsPanel } from "@/components/organisms/human-interventions-panel";
import { useLanguage } from "@/components/organisms/language-provider";
import { PersonalDashboardPanel } from "@/components/organisms/personal-dashboard-panel";
import { useModuleAccess } from "@/lib/module-access";
import { APP_ROUTES } from "@/lib/routes";

const shortcuts = [
  { key: "workflow_management", labelKey: "nav.workflows", href: APP_ROUTES.workflows, icon: GitBranch },
  { key: "document_archive", labelKey: "nav.archive", href: APP_ROUTES.archive, icon: Archive },
  { key: "project_management", labelKey: "nav.projects", href: APP_ROUTES.projects, icon: FolderKanban },
  { key: "project_management", labelKey: "nav.clients", href: APP_ROUTES.clients, icon: Users },
  { key: "commission_registry", labelKey: "nav.commissions", href: APP_ROUTES.commissions, icon: ClipboardList },
  { key: "commission_intake", labelKey: "nav.dataCollectionChecklists", href: APP_ROUTES.dataCollectionChecklists, icon: ClipboardList },
];

export function WorkspaceDashboardPanel() {
  const { hasModule } = useModuleAccess();
  const { t } = useLanguage();
  const [personalOpen, setPersonalOpen] = useState(false);
  if (personalOpen) return <PersonalDashboardPanel showInterventions={false} onReturnToPrivateArea={() => setPersonalOpen(false)} />;
  return <div className="space-y-6"><header className="flex items-center justify-between gap-3"><Text as="h1" variant="h1">{t("dashboard.privateArea")}</Text><button type="button" title={t("dashboard.personalSettings")} onClick={() => setPersonalOpen(true)} className="rounded-md p-2 text-text-muted hover:bg-bg-muted hover:text-text-primary"><Settings size={19} /></button></header><HumanInterventionsPanel /><section><Text as="h2" variant="h2">{t("dashboard.quickAccess")}</Text><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.filter((item) => hasModule(item.key)).map((item) => <a key={item.labelKey} href={item.href} className="flex min-h-24 items-center gap-3 rounded-md border border-border-default bg-bg-surface p-4 hover:border-brand-primary"><item.icon size={20} className="text-brand-primary" /><span className="font-semibold text-text-primary">{t(item.labelKey)}</span></a>)}</div></section></div>;
}
