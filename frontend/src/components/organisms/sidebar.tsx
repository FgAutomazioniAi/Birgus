"use client";

import { Archive, CalendarDays, ChevronDown, FileSearch, FolderKanban, GitBranch, LogOut, Map, Ruler, Settings, ShieldCheck, TrendingUp, UserRound, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { IconButton } from "@/components/atoms";
import { NavItem } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";
import { useLanguage } from "@/components/organisms/language-provider";

const menuItems = [
  { icon: FolderKanban, label: "Progetti", path: APP_ROUTES.projects, moduleKey: "project_management" },
  { icon: Users, label: "Clienti", path: APP_ROUTES.clients, moduleKey: "project_management" },
  // DDT_READER_FEATURE_START
  { icon: FileSearch, label: "DDT Reader", path: APP_ROUTES.ddtReader, moduleKey: "ddt_processing" },
  // DDT_READER_FEATURE_END
  { icon: Ruler, label: "Measure Report", path: APP_ROUTES.measureReport, moduleKey: "measure_report" },
  { icon: Map, label: "Mappa clienti", path: APP_ROUTES.customerMap, moduleKey: "customer_map" },
  { icon: TrendingUp, label: "Priorità offerte", path: APP_ROUTES.offerPriority, moduleKey: "offer_priority" },
  { icon: Wrench, label: "Proposte manutenzione", path: APP_ROUTES.maintenanceProposals, moduleKey: "maintenance_proposals" },
  { icon: CalendarDays, label: "Calendario manutenzioni", path: APP_ROUTES.maintenanceCalendar, moduleKey: "maintenance_calendar" },
];

const folders = [
  { label: "Anagrafica", icon: Users, items: ["Clienti", "Mappa clienti"] },
  { label: "Operatività", icon: FolderKanban, items: ["Progetti", "DDT Reader", "Measure Report"] },
  { label: "Pianificazione", icon: CalendarDays, items: ["Priorità offerte", "Proposte manutenzione", "Calendario manutenzioni"] },
];

export interface SidebarProps {
  collapsed: boolean;
  enabledModuleKeys: string[];
  isSuperadmin: boolean;
  onClose: () => void;
  open: boolean;
  userName: string;
}

export function Sidebar({ collapsed, enabledModuleKeys, isSuperadmin, onClose, open, userName }: SidebarProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [openFolders, setOpenFolders] = useState<string[]>(["Anagrafica"]);
  const visibleMenuItems = menuItems.filter((item) =>
    !item.moduleKey || enabledModuleKeys.includes(item.moduleKey),
  );
  const primaryItems = [
    ...(isSuperadmin && enabledModuleKeys.includes("superadmin_center") ? [{ icon: ShieldCheck, label: "Superadmin", path: APP_ROUTES.superadmin }] : []),
    ...(enabledModuleKeys.includes("workflow_management") ? [{ icon: GitBranch, label: "Workflow", path: APP_ROUTES.workflows }] : []),
    ...(enabledModuleKeys.includes("document_archive") ? [{ icon: Archive, label: "Archivio", path: APP_ROUTES.archive }] : []),
  ];
  const isActive = (path: string) => path === APP_ROUTES.projects ? pathname === path || pathname.startsWith("/projects") : pathname === path || pathname.startsWith(`${path}/`);

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
          <div className={["flex items-center p-4", collapsed ? "lg:justify-center" : ""].join(" ")}>
            {!collapsed ? (
              <Link href={APP_ROUTES.dashboard} onClick={onClose} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-text-primary hover:bg-bg-subtle"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary text-text-inverse"><UserRound size={18} /></span><span className="min-w-0 truncate text-sm font-semibold">{userName}</span></Link>
            ) : (
              <Link href={APP_ROUTES.dashboard} onClick={onClose} title={userName} className="hidden h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-text-inverse lg:flex"><UserRound size={18} /></Link>
            )}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4">
            {primaryItems.map((item) => <NavItem key={item.label} href={item.path} icon={item.icon} isActive={isActive(item.path)} label={item.label === "Workflow" ? t("nav.workflows") : item.label === "Archivio" ? t("nav.archive") : item.label} collapsed={collapsed} onClick={onClose} />)}
            {folders.map((folder) => {
              const items = visibleMenuItems.filter((item) => folder.items.includes(item.label));
              if (!items.length) return null;
              const openFolder = openFolders.includes(folder.label);
              return <div key={folder.label} className="pt-2">
                <button type="button" onClick={() => setOpenFolders((current) => current.includes(folder.label) ? current.filter((label) => label !== folder.label) : [...current, folder.label])} title={collapsed ? folder.label : undefined} className={["flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-bg-subtle", collapsed ? "lg:justify-center lg:px-0" : ""].join(" ")}><folder.icon size={18} />{!collapsed && <><span className="flex-1 text-left">{folder.label}</span><ChevronDown size={16} className={openFolder ? "rotate-180 transition-transform" : "transition-transform"} /></>}</button>
                {openFolder && !collapsed ? <div className="ml-4 mt-1 space-y-1 border-l border-border-subtle pl-2">{items.map((item) => <NavItem key={item.label} href={item.path} icon={item.icon} isActive={isActive(item.path)} label={item.label === "Progetti" ? t("nav.projects") : item.label === "Clienti" ? t("nav.clients") : item.label === "Mappa clienti" ? t("nav.customerMap") : item.label === "Priorità offerte" ? t("nav.offerPriority") : item.label === "Proposte manutenzione" ? t("nav.maintenanceProposals") : item.label === "Calendario manutenzioni" ? t("nav.maintenanceCalendar") : item.label} collapsed={false} onClick={onClose} />)}</div> : null}
              </div>;
            })}
          </nav>

          <div className="border-t border-border-subtle p-4">
            <NavItem href={APP_ROUTES.settings} icon={Settings} isActive={isActive(APP_ROUTES.settings)} label="Impostazioni Admin" collapsed={collapsed} onClick={onClose} />
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
