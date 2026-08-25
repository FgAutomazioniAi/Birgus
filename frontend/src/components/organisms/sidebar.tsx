"use client";

import { Archive, CalendarDays, FileSearch, FolderKanban, GitBranch, LogOut, Map, Ruler, Settings, ShieldCheck, TrendingUp, Truck, Users, Wrench } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { IconButton } from "@/components/atoms";
import { BirgusLogo, NavItem } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";
import { useLanguage } from "@/components/organisms/language-provider";

const menuItems = [
  { icon: FolderKanban, label: "Progetti", path: APP_ROUTES.projects, moduleKey: "project_management" },
  { icon: Users, label: "Clienti", path: APP_ROUTES.clients, moduleKey: "project_management" },
  { icon: Truck, label: "Spedizioni", path: APP_ROUTES.spedizioni, moduleKey: "shipment_management" },
  // DDT_READER_FEATURE_START
  { icon: FileSearch, label: "DDT Reader", path: APP_ROUTES.ddtReader, moduleKey: "ddt_processing" },
  // DDT_READER_FEATURE_END
  { icon: Ruler, label: "Measure Report", path: APP_ROUTES.measureReport, moduleKey: "measure_report" },
  { icon: Map, label: "Mappa clienti", path: APP_ROUTES.customerMap, moduleKey: "customer_map" },
  { icon: TrendingUp, label: "Priorita offerte", path: APP_ROUTES.offerPriority, moduleKey: "offer_priority" },
  { icon: Wrench, label: "Proposte manutenzione", path: APP_ROUTES.maintenanceProposals, moduleKey: "maintenance_proposals" },
  { icon: CalendarDays, label: "Calendario manutenzioni", path: APP_ROUTES.maintenanceCalendar, moduleKey: "maintenance_calendar" },
  { icon: GitBranch, label: "Workflow", path: APP_ROUTES.workflows, moduleKey: "workflow_management" },
  { icon: Archive, label: "Archivio", path: APP_ROUTES.archive, moduleKey: "document_archive" },
  { icon: ShieldCheck, label: "Superadmin", path: APP_ROUTES.superadmin, moduleKey: "superadmin_center", superadminOnly: true },
  { icon: Settings, label: "Impostazioni", path: APP_ROUTES.settings },
];

export interface SidebarProps {
  collapsed: boolean;
  enabledModuleKeys: string[];
  isSuperadmin: boolean;
  onClose: () => void;
  open: boolean;
}

export function Sidebar({ collapsed, enabledModuleKeys, isSuperadmin, onClose, open }: SidebarProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const visibleMenuItems = menuItems.filter((item) =>
    (!item.moduleKey || enabledModuleKeys.includes(item.moduleKey))
    && (!item.superadminOnly || isSuperadmin),
  );

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      onClose();
      router.push(APP_ROUTES.login);
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-bg-overlay lg:hidden" onClick={onClose} />}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border-default bg-bg-surface transition-all duration-300",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-20" : "lg:w-64",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className={["flex items-center p-6", collapsed ? "lg:justify-center" : ""].join(" ")}>
            {!collapsed ? (
              <BirgusLogo className="h-12 w-auto max-w-[440px]" />
            ) : (
              <div className="hidden h-10 w-10 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-1 lg:flex">
                <img src="/favicon.ico" alt="Logo compatto" className="h-8 w-8 object-contain" />
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-4">
            {visibleMenuItems.map((item) => {
              const isProjectsRoute = item.path === APP_ROUTES.projects;
              const isActive = isProjectsRoute
                ? pathname === APP_ROUTES.projects || pathname.startsWith("/projects")
                : pathname === item.path || pathname.startsWith(`${item.path}/`);

              return (
                <NavItem
                  key={item.label}
                  href={item.path}
                  icon={item.icon}
                  isActive={isActive}
                  label={item.label === "Progetti" ? t("nav.projects")
                    : item.label === "Clienti" ? t("nav.clients")
                      : item.label === "Spedizioni" ? t("nav.shipments")
                        : item.label === "Mappa clienti" ? t("nav.customerMap")
                          : item.label === "Priorita offerte" ? t("nav.offerPriority")
                            : item.label === "Proposte manutenzione" ? t("nav.maintenanceProposals")
                              : item.label === "Calendario manutenzioni" ? t("nav.maintenanceCalendar")
                                : item.label === "Workflow" ? t("nav.workflows")
                                  : item.label === "Archivio" ? t("nav.archive")
                                    : item.label === "Impostazioni" ? t("nav.settings") : item.label}
                  collapsed={collapsed}
                  onClick={onClose}
                />
              );
            })}
          </nav>

          <div className="border-t border-border-subtle p-4">
            <IconButton
              className={[
                "h-12 w-full justify-start gap-3 px-4 py-3 text-sm font-medium",
                "text-text-muted hover:bg-status-danger-bg hover:text-status-danger-text",
                collapsed ? "lg:justify-center lg:px-0" : "",
              ].join(" ")}
              title={collapsed ? t("nav.exit") : undefined}
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              <LogOut size={20} />
              {!collapsed && <span>{t("nav.exit")}</span>}
            </IconButton>
          </div>
        </div>
      </aside>
    </>
  );
}
