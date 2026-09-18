"use client";

import {
  Archive,
  ClipboardList,
  FolderKanban,
  GitBranch,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Text } from "@/components/atoms";
import { HumanInterventionsPanel } from "@/components/organisms/human-interventions-panel";
import { DashboardMonitoringPanel } from "@/components/organisms/dashboard-monitoring-panel";
import { useLanguage } from "@/components/organisms/language-provider";
import { PersonalDashboardPanel } from "@/components/organisms/personal-dashboard-panel";
import { useModuleAccess } from "@/lib/module-access";
import { APP_ROUTES } from "@/lib/routes";

const shortcuts = [
  {
    key: "workflow_management",
    labelKey: "nav.workflows",
    href: APP_ROUTES.workflows,
    icon: GitBranch,
  },
  {
    key: "document_archive",
    labelKey: "nav.archive",
    href: APP_ROUTES.archive,
    icon: Archive,
  },
  {
    key: "project_management",
    labelKey: "nav.projects",
    href: APP_ROUTES.projects,
    icon: FolderKanban,
  },
  {
    key: "project_management",
    labelKey: "nav.clients",
    href: APP_ROUTES.clients,
    icon: Users,
  },
  {
    key: "commission_registry",
    labelKey: "nav.commissions",
    href: APP_ROUTES.commissions,
    icon: ClipboardList,
  },
  {
    key: "commission_intake",
    labelKey: "nav.dataCollectionChecklists",
    href: APP_ROUTES.quotationPlanning,
    icon: ClipboardList,
  },
  {
    key: "commission_details",
    labelKey: "nav.commissionDetails",
    href: APP_ROUTES.commissionInsights,
    icon: ClipboardList,
  },
];

export function WorkspaceDashboardPanel() {
  const { hasModule } = useModuleAccess();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    "private" | "settings" | "monitoring"
  >("private");
  const [canMonitor, setCanMonitor] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{ user?: { roleKeys?: string[] } }>)
          : null,
      )
      .then((session) =>
        setCanMonitor(
          (session?.user?.roleKeys ?? []).some((role) =>
            ["developer", "superuser", "admin"].includes(
              role.trim().toLowerCase(),
            ),
          ),
        ),
      )
      .catch(() => setCanMonitor(false));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <Text as="h1" variant="h1">
          Dashboard
        </Text>
      </header>
      <div className="border-b border-border-default">
        <div
          className="flex gap-1"
          role="tablist"
          aria-label="Sezioni Dashboard"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "private"}
            onClick={() => setActiveTab("private")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "private" ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
          >
            Area privata
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "settings" ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
          >
            Impostazioni
          </button>
          {canMonitor ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "monitoring"}
              onClick={() => setActiveTab("monitoring")}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === "monitoring" ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
            >
              Monitoraggio attività
            </button>
          ) : null}
        </div>
      </div>
      {activeTab === "private" ? (
        <>
          <HumanInterventionsPanel />
          <section>
            <Text as="h2" variant="h2">
              {t("dashboard.quickAccess")}
            </Text>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {shortcuts
                .filter((item) => hasModule(item.key))
                .map((item) => (
                  <a
                    key={item.labelKey}
                    href={item.href}
                    className="flex min-h-24 items-center gap-3 rounded-md border border-border-default bg-bg-surface p-4 hover:border-brand-primary"
                  >
                    <item.icon size={20} className="text-brand-primary" />
                    <span className="font-semibold text-text-primary">
                      {t(item.labelKey)}
                    </span>
                  </a>
                ))}
            </div>
          </section>
        </>
      ) : null}
      {activeTab === "settings" ? (
        <PersonalDashboardPanel
          showInterventions={false}
          showWorkflowSchedules={false}
        />
      ) : null}
      {activeTab === "monitoring" && canMonitor ? (
        <DashboardMonitoringPanel />
      ) : null}
    </div>
  );
}
