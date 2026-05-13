"use client";

import { Bell, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/atoms";
import { UserChip } from "@/components/molecules";
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

const formatNotificationDate = (isoDate: string) =>
  new Date(isoDate).toLocaleString("it-IT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });

export function TopNav({ collapsed, currentUser, onMenuClick, onToggleCollapse }: TopNavProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const notificationsEnabled = currentUser.enabledModuleKeys.includes("notification_center");

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationRef.current) {
        return;
      }

      if (!notificationRef.current.contains(event.target as Node)) {
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
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
    } catch {
      // no-op
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    try {
      setIsLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push(APP_ROUTES.login);
      router.refresh();
      setIsLoggingOut(false);
    }
  };

  const userName = `${currentUser.nome} VL`;
  const hasUnreadNotifications = notifications.some((notification) => !notification.readAt);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border-default bg-bg-surface">
      <div className="flex h-full items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-4">
          <IconButton onClick={onMenuClick} className="lg:hidden">
            <Menu size={24} />
          </IconButton>

          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Espandi menu laterale" : "Comprimi menu laterale"}
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
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Comunicazioni</p>
                      <button
                        type="button"
                        onClick={() => void handleClearNotifications()}
                        className="rounded-md border border-border-default px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary"
                      >
                        Pulisci
                      </button>
                    </div>

                    {isNotificationsLoading ? (
                      <p className="mt-3 text-sm text-text-muted">Caricamento comunicazioni...</p>
                    ) : notifications.length === 0 ? (
                      <p className="mt-3 text-sm text-text-muted">Hai zero comunicazioni.</p>
                    ) : (
                      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                        {notifications.map((notification) => (
                          <div key={notification.id} className="rounded-lg border border-border-subtle bg-bg-muted px-3 py-2">
                            <p className="text-xs font-semibold text-text-primary">{notification.title}</p>
                            <p className="mt-1 text-xs leading-5 text-text-secondary">{notification.message}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-text-muted">
                              {formatNotificationDate(notification.createdAt)}
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

          <button onClick={() => void handleLogout()} disabled={isLoggingOut} title="Esci">
            <UserChip name={userName} role={currentUser.ruolo} />
          </button>
        </div>
      </div>
    </header>
  );
}
