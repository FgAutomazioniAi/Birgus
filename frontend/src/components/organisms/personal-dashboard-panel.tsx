"use client";

import { BellRing, Copy, Link2, Mail, Palette, Send, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { HumanInterventionsPanel } from "@/components/organisms/human-interventions-panel";
import { useTheme } from "@/components/organisms/theme-provider";
import { isToastPosition, toastPositionOptions, useToasterPreferences, type ToastPosition } from "@/components/organisms/toaster-provider";
import { cn } from "@/lib/cn";
import { useModuleAccess } from "@/lib/module-access";
import type { ThemeId } from "@/lib/themes";

interface ProfileResponse {
  ok: boolean;
  user: {
    email: string;
    fullName: string;
    id: string;
    roleLabel: string;
    memberSince: string;
    passwordUpdatedAt: string;
    twoFactorEnabled: boolean;
  };
}

interface ConnectedApp {
  id: string;
  provider: "telegram";
  recipientId: string;
  username: string | null;
  label: string;
  isDefault: boolean;
  verifiedAt: string | null;
}

interface ConnectedAppsResponse {
  apps: ConnectedApp[];
  connectableApps: Array<{
    provider: "telegram";
    label: string;
    description: string;
    status: "connected" | "available";
  }>;
}

export function PersonalDashboardPanel() {
  const { language, t } = useLanguage();
  const { options: themeOptions, theme, setTheme } = useTheme();
  const { enabled: notificationPopupsEnabled, position: toastPosition, setEnabled: setNotificationPopupsEnabled, setPosition: setToastPosition } = useToasterPreferences();
  const { hasModule } = useModuleAccess();
  const canManageWorkflowChannels = hasModule("workflow_management");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [selectedConnectableApp, setSelectedConnectableApp] = useState<"telegram">("telegram");
  const [telegramLink, setTelegramLink] = useState<{ code: string; expiresAt: string; botUsername: string | null } | null>(null);
  const [profile, setProfile] = useState<ProfileResponse["user"] | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const selectedTheme = themeOptions.find((option) => option.id === theme) ?? themeOptions[0];

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const [profileResponse, appsResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          canManageWorkflowChannels
            ? fetch("/api/connected-apps", { cache: "no-store" })
            : Promise.resolve(null),
        ]);

        if (!profileResponse.ok) {
          throw new Error("Impossibile caricare il profilo.");
        }

        const payload = (await profileResponse.json()) as ProfileResponse;
        setProfile(payload.user);
        if (appsResponse?.ok) {
          const appsPayload = (await appsResponse.json()) as ConnectedAppsResponse;
          setConnectedApps(appsPayload.apps ?? []);
        }
      } catch {
        toast.error("Errore caricamento dashboard personale.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, [canManageWorkflowChannels]);

  const isChangePasswordDisabled = useMemo(() => {
    if (isSubmitting) {
      return true;
    }

    return !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim();
  }, [confirmPassword, currentPassword, isSubmitting, newPassword]);

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("La conferma password non coincide.");
      return;
    }

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error("La nuova password deve avere almeno 8 caratteri, una maiuscola e un numero.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: "Cambio password non riuscito." }))) as { message?: string };
        throw new Error(payload.message ?? "Cambio password non riuscito.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfile((prev) => (prev ? { ...prev, passwordUpdatedAt: new Date().toISOString() } : prev));
      toast.success("Password aggiornata correttamente.");
    } catch (error) {
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Cambio password non riuscito.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTelegramLink = async () => {
    try {
      setIsSavingApp(true);
      const response = await fetch("/api/connected-apps/telegram/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ message: "Generazione codice Telegram non riuscita." }))) as { message?: string };
        throw new Error(payload.message ?? "Generazione codice Telegram non riuscita.");
      }

      const payload = (await response.json()) as { link: { code: string; expiresAt: string; botUsername: string | null } };
      setTelegramLink(payload.link);
      toast.success("Codice Telegram generato.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generazione codice Telegram non riuscita.");
    } finally {
      setIsSavingApp(false);
    }
  };

  const handleCopyTelegramCommand = async () => {
    if (!telegramLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`/link ${telegramLink.code}`);
      toast.success("Comando Telegram copiato.");
    } catch {
      toast.error("Impossibile copiare il comando.");
    }
  };

  const handleRemoveApp = async (appId: string) => {
    try {
      const response = await fetch(`/api/connected-apps/${appId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Rimozione collegamento non riuscita.");
      }
      setConnectedApps((current) => current.filter((app) => app.id !== appId));
      toast.success("Collegamento rimosso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rimozione collegamento non riuscita.");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center gap-2"><Text as="h1" variant="h1">{t("account.title")}</Text><PageHelpHint text={t("account.help")} /></div>
        <Card className="p-6">
          <Text variant="muted">{t("account.loading")}</Text>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center gap-2"><Text as="h1" variant="h1">{t("account.title")}</Text><PageHelpHint text={t("account.help")} /></div>
        <Card className="p-6">
          <Text variant="muted">{t("account.none")}</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <div className="flex items-center gap-2"><Text as="h1" variant="h1">{t("account.title")}</Text><PageHelpHint text={t("account.help")} /></div>
        <Text variant="muted">{t("account.subtitle")}</Text>
      </div>

      {hasModule("workflow_management") ? <HumanInterventionsPanel /> : null}

      <div className={cn("grid gap-4", canManageWorkflowChannels ? "xl:grid-cols-[minmax(360px,1.15fr)_minmax(330px,0.95fr)_minmax(280px,0.8fr)]" : "xl:grid-cols-[minmax(0,1.15fr)_minmax(330px,0.85fr)]")}>
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
            <Palette size={16} />
          </div>
          <div>
            <Text as="h2" variant="h2">{t("account.preferences")}</Text>
            <Text variant="caption">{t("account.preferencesHint")}</Text>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-text-primary" htmlFor="dashboard-theme-selector">
              <Palette size={15} className="text-brand-primary" />
              {t("account.palette")}
            </label>
            <SelectDropdown
              id="dashboard-theme-selector"
              className="mt-2 w-full"
              size="sm"
              value={theme}
              onChange={(value) => setTheme(value as ThemeId)}
              options={themeOptions.map((option) => ({ value: option.id, label: option.label }))}
            />
            <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
              <span className="min-w-0 flex-1 truncate">{selectedTheme.description}</span>
              <div className="flex shrink-0 gap-1">
                {selectedTheme.swatches.map((swatch) => <span key={`${selectedTheme.id}-${swatch}`} className="h-4 w-4 rounded-full border border-border-default" style={{ backgroundColor: swatch }} />)}
              </div>
            </div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-text-primary"><BellRing size={15} className="text-brand-primary" />{t("account.notifications")}</div>
                <Text variant="caption" className="mt-1 block">{t("account.notificationsHint")}</Text>
              </div>
              <button type="button" role="switch" aria-checked={notificationPopupsEnabled} aria-label={t("account.notificationsOn")} title={t("account.notificationsOn")} onClick={() => setNotificationPopupsEnabled(!notificationPopupsEnabled)} className={cn("relative inline-flex h-6 w-[3.25rem] shrink-0 items-center rounded-full border p-0.5 shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary", notificationPopupsEnabled ? "border-brand-primary bg-brand-primary" : "border-border-default bg-bg-page")}>
                <span aria-hidden="true" className={cn("absolute text-[9px] font-bold leading-none", notificationPopupsEnabled ? "left-2 text-text-inverse" : "right-1.5 text-text-muted")}>{notificationPopupsEnabled ? "ON" : "OFF"}</span>
                <span aria-hidden="true" className={cn("relative z-10 h-5 w-5 rounded-full border border-black/10 bg-white shadow-sm transition-transform", notificationPopupsEnabled ? "translate-x-6" : "translate-x-0")} />
              </button>
            </div>
            <label className="mt-3 block text-xs font-bold text-text-primary" htmlFor="dashboard-toast-position">{t("account.notificationsPosition")}</label>
            <SelectDropdown id="dashboard-toast-position" className="mt-2 w-full" size="sm" value={toastPosition} disabled={!notificationPopupsEnabled} onChange={(value) => { if (isToastPosition(value)) setToastPosition(value as ToastPosition); }} options={toastPositionOptions(language)} />
          </div>
        </div>
      </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
              <UserRound size={16} />
            </div>
            <Text as="h2" variant="h2" className="text-base">{t("account.profile")}</Text>
          </div>
          <div className="space-y-1.5">
            <Text variant="body" className="text-text-primary">{profile.fullName}</Text>
            <Text variant="caption">{t("account.role")}: {profile.roleLabel}</Text>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-brand-primary" />
              <Text variant="caption" className="break-all">{profile.email}</Text>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-3">
            <Text className="text-xs font-semibold text-text-primary">{t("account.changePassword")}</Text>
            <form className="mt-2 grid gap-2 sm:grid-cols-2" onSubmit={(event) => void handleChangePassword(event)}>
              <Input
                id="current-password"
                name="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder={t("account.currentPassword")}
                autoComplete="current-password"
                className="h-9"
              />
              <Input
                id="new-password"
                name="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={t("account.newPassword")}
                autoComplete="new-password"
                className="h-9"
              />
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t("account.confirmNewPassword")}
                autoComplete="new-password"
                className="h-9 sm:col-span-2"
              />
              <Button type="submit" size="sm" className="justify-self-start" disabled={isChangePasswordDisabled}>
                {isSubmitting ? t("account.updating") : t("superadmin.updatePassword")}
              </Button>
            </form>
          </div>
        </Card>

      {canManageWorkflowChannels ? <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
              <Link2 size={16} />
            </div>
            <div>
              <Text as="h2" variant="h2" className="text-base">{t("account.connectedApps")}</Text>
              <Text variant="caption">{t("account.connectedAppsHint")}</Text>
            </div>
          </div>
          <div className="space-y-2">
            <select
              id="connectable-app"
              name="connectable-app"
              value={selectedConnectableApp}
              onChange={(event) => setSelectedConnectableApp(event.target.value as "telegram")}
              className="h-9 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary outline-none focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-ring-primary"
            >
              <option value="telegram">Telegram</option>
            </select>

            {selectedConnectableApp === "telegram" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Send size={15} className="text-brand-primary" />
                  <Text variant="caption">{t("account.telegramHint")}</Text>
                </div>
                <Button type="button" size="sm" onClick={() => void handleCreateTelegramLink()} disabled={isSavingApp}>
                  {isSavingApp ? t("account.generating") : t("account.generateCode")}
                </Button>
                {telegramLink ? (
                  <div className="space-y-2 rounded-[var(--radius-md)] border border-brand-primary/30 bg-status-info-bg p-2.5">
                    <Text variant="caption">{t("account.sendWithin")}</Text>
                    <div className="flex items-center justify-between gap-2">
                      <code className="min-w-0 break-all text-sm font-bold text-text-primary">/link {telegramLink.code}</code>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void handleCopyTelegramCommand()} aria-label={t("account.copyTelegram")} title={t("account.copyTelegram")}>
                        <Copy size={15} />
                      </Button>
                    </div>
                    {telegramLink.botUsername ? (
                      <a className="text-xs font-semibold text-brand-primary hover:underline" href={`https://t.me/${telegramLink.botUsername}?start=${encodeURIComponent(telegramLink.code)}`} target="_blank" rel="noreferrer">
                        {t("account.openTelegram", { name: telegramLink.botUsername })}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {connectedApps.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-border-default p-2.5">
                <Text variant="muted">{t("account.noApps")}</Text>
              </div>
            ) : connectedApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3">
                <div className="min-w-0">
                  <Text className="font-bold">{app.label}</Text>
                  <Text variant="caption" className="break-all">
                    {app.verifiedAt ? t("account.connected") : t("account.toVerify")}
                  </Text>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemoveApp(app.id)}
                  aria-label={t("account.remove", { name: app.label })}
                  title={t("account.remove", { name: app.label })}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        </Card> : null}
      </div>

    </div>
  );
}
