"use client";

import { Bell, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/atoms";
import { UserChip } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { APP_ROUTES } from "@/lib/routes";

export interface TopNavProps {
  collapsed: boolean;
  currentUser: {
    id: string;
    nome: string;
    ruolo: string;
    enabledModuleKeys: string[];
  };
  onMenuClick: () => void;
  onToggleCollapse: () => void;
}

interface NotificationItem {
  createdAt: string;
  id: number;
  message: string;
  readAt: string | null;
  reference: string | null;
  title: string;
  type: string;
}

interface QueuedOperation {
  completedAt: string | null;
  currentStepLabel: string | null;
  errorMessage: string | null;
  id: string;
  label: string;
  queuedAt: string;
  startedAt: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  workflowKey: string;
  workflowId: string;
}

const formatNotificationDate = (isoDate: string, language: "it" | "en") =>
  new Date(isoDate).toLocaleString(language === "it" ? "it-IT" : "en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
export function TopNav({ collapsed, currentUser, onMenuClick, onToggleCollapse }: TopNavProps) {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [operations, setOperations] = useState<QueuedOperation[]>([]);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationsEnabled = currentUser.enabledModuleKeys.includes("notification_center");

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const loadNotifications = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setIsNotificationsLoading(true);
      }

      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Errore caricamento notifiche");
      }

      const payload = (await response.json()) as NotificationItem[];
      setNotifications(payload);
    } catch {
      if (!silent) {
        setNotifications([]);
      }
    } finally {
      if (!silent) {
        setIsNotificationsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!notificationsEnabled) {
      setShowNotifications(false);
      setNotifications([]);
      setIsNotificationsLoading(false);
      return;
    }

    void loadNotifications();
    const interval = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [notificationsEnabled]);

  useEffect(() => {
    let active = true;

    const loadOperations = async () => {
      try {
        const response = await fetch("/api/operations/my-queue", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = await response.json() as { operations?: QueuedOperation[] };
        if (active) {
          setOperations(Array.isArray(payload.operations) ? payload.operations.slice(0, 3) : []);
        }
      } catch {
        // The header must remain quiet if the operation feed is temporarily unavailable.
      }
    };

    void loadOperations();
    const interval = window.setInterval(() => void loadOperations(), 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleNotificationClick = () => {
    if (!notificationsEnabled) {
      return;
    }

    const nextValue = !showNotifications;
    setShowNotifications(nextValue);
    if (nextValue) {
      void loadNotifications();
      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })));
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    }
  };

  const handleClearNotifications = async () => {
    const previousNotifications = notifications;
    setNotifications([]);
    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: "cancella" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: t("notifications.clearFailed") }))) as { message?: string };
        throw new Error(payload.message ?? t("notifications.clearFailed"));
      }

      toast.success(t("notifications.cleared"));
    } catch (error) {
      setNotifications(previousNotifications);
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : t("notifications.clearFailed");
      toast.error(message);
    }
  };

  const handleOpenPersonalDashboard = () => {
    router.push(APP_ROUTES.personalDashboard);
  };

  const handleOpenOperation = (operation: QueuedOperation) => {
    router.push(`${APP_ROUTES.workflows}?workflowId=${encodeURIComponent(operation.workflowId)}&runId=${encodeURIComponent(operation.id)}`);
  };

  const userName = currentUser.nome;
  const hasUnreadNotifications = notifications.some((notification) => !notification.readAt);
  const operationStatus = (status: QueuedOperation["status"]) => {
    switch (status) {
      case "RUNNING": return t("operations.queue.running");
      case "COMPLETED": return t("operations.queue.completed");
      case "FAILED": return t("operations.queue.failed");
      case "CANCELED": return t("operations.queue.canceled");
      default: return t("operations.queue.queued");
    }
  };
  const operationStatusClass = (status: QueuedOperation["status"]) => {
    if (status === "COMPLETED") return "text-status-success-text";
    if (status === "FAILED" || status === "CANCELED") return "text-status-danger-text";
    if (status === "RUNNING") return "text-brand-primary";
    return "text-text-muted";
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border-default bg-bg-surface">
      <div className="flex h-full items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-4">
          <IconButton onClick={onMenuClick} className="lg:hidden">
            <Menu size={24} />
          </IconButton>

          <button
            onClick={onToggleCollapse}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
            className="group hidden items-center gap-2 rounded-lg px-3 py-2 text-text-muted transition-all hover:bg-status-info-bg hover:text-brand-primary lg:flex"
          >
            {collapsed ? (
              <PanelLeft size={20} className="group-hover:text-blue-600" />
            ) : (
              <PanelLeftClose size={20} className="group-hover:text-blue-600" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {operations.length > 0 ? (
            <div className="hidden h-9 items-stretch gap-1 border-r border-border-default pr-4 2xl:flex" aria-label={t("operations.queue.title")}>
              {operations.map((operation) => (
                <button
                  key={operation.id}
                  type="button"
                  title={operation.label}
                  onClick={() => handleOpenOperation(operation)}
                  className="flex w-36 min-w-0 items-center gap-2 border border-border-subtle bg-bg-page px-2 text-left transition-colors hover:border-brand-primary hover:bg-bg-muted"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${operation.status === "COMPLETED" ? "bg-status-success-text" : operation.status === "FAILED" || operation.status === "CANCELED" ? "bg-status-danger-text" : operation.status === "RUNNING" ? "bg-brand-primary" : "bg-text-muted"}`} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[11px] font-semibold text-text-primary">{operation.label}</p>
                    <p className={`truncate text-[10px] font-semibold ${operationStatusClass(operation.status)}`}>{operationStatus(operation.status)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <div className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-border-default" role="group" aria-label={t("language.switch")}>
            <button
              type="button"
              className={`h-8 px-2 text-xs font-bold ${language === "it" ? "bg-brand-primary text-text-inverse" : "text-text-secondary hover:bg-bg-subtle"}`}
              onClick={() => setLanguage("it")}
              aria-pressed={language === "it"}
            >
              IT
            </button>
            <button
              type="button"
              className={`h-8 px-2 text-xs font-bold ${language === "en" ? "bg-brand-primary text-text-inverse" : "text-text-secondary hover:bg-bg-subtle"}`}
              onClick={() => setLanguage("en")}
              aria-pressed={language === "en"}
            >
              EN
            </button>
          </div>
          {notificationsEnabled ? (
            <>
              <div className="relative" ref={notificationRef}>
                <IconButton className="relative" onClick={handleNotificationClick}>
                  <Bell size={20} />
                  {hasUnreadNotifications && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-bg-surface bg-brand-accent" />
                  )}
                </IconButton>

                {showNotifications && (
                  <div className="absolute right-0 top-12 max-h-[420px] w-[360px] overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-4 shadow-elevated">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">{t("notifications.title")}</p>
                      <button
                        type="button"
                        onClick={() => void handleClearNotifications()}
                        className="rounded-md border border-border-default px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary"
                      >
                        {t("notifications.clear")}
                      </button>
                    </div>

                    {isNotificationsLoading ? (
                      <p className="mt-3 text-sm text-text-muted">{t("notifications.loading")}</p>
                    ) : notifications.length === 0 ? (
                      <p className="mt-3 text-sm text-text-muted">{t("notifications.empty")}</p>
                    ) : (
                      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                        {notifications.map((notification) => (
                          <div key={notification.id} className="rounded-lg border border-border-subtle bg-bg-muted px-3 py-2">
                            <p className="text-xs font-semibold text-text-primary">{notification.title}</p>
                            <p className="mt-1 text-xs leading-5 text-text-secondary">{notification.message}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                              {formatNotificationDate(notification.createdAt, language)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mx-1 hidden h-8 w-px bg-border-default sm:block" />
            </>
          ) : null}

          <button onClick={handleOpenPersonalDashboard} title={t("nav.personalDashboard")}>
            <UserChip name={userName} />
          </button>
        </div>
      </div>
    </header>
  );
}
