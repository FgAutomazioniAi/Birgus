"use client";

import { Copy, KeyRound, Link2, Mail, Send, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { useModuleAccess } from "@/lib/module-access";

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
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Text as="h1" variant="h1">Dashboard personale</Text>
        <Card className="p-6">
          <Text variant="muted">Caricamento dati utente...</Text>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Text as="h1" variant="h1">Dashboard personale</Text>
        <Card className="p-6">
          <Text variant="muted">Nessuna informazione disponibile al momento.</Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Text as="h1" variant="h1">Dashboard personale</Text>
        <Text variant="muted">Area account con informazioni utili e impostazioni rapide.</Text>
      </div>

      <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-1">
        <Card className="space-y-3 p-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
            <UserRound size={18} />
          </div>
          <Text as="h2" variant="h2" className="text-base">Profilo</Text>
          <div className="space-y-1.5">
            <Text variant="body" className="text-text-primary">{profile.fullName}</Text>
            <Text variant="caption">Ruolo: {profile.roleLabel}</Text>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-brand-primary" />
              <Text variant="caption" className="break-all">{profile.email}</Text>
            </div>
          </div>
        </Card>
      </div>

      {canManageWorkflowChannels ? <Card className="space-y-4 p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
            <Link2 size={16} />
          </div>
          <div>
            <Text as="h2" variant="h2">Applicativi collegabili</Text>
            <Text variant="caption">Collega i canali personali usati dai workflow.</Text>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3 rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted" htmlFor="connectable-app">
              Applicativo
            </label>
            <select
              id="connectable-app"
              name="connectable-app"
              value={selectedConnectableApp}
              onChange={(event) => setSelectedConnectableApp(event.target.value as "telegram")}
              className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-3 text-sm text-text-secondary outline-none focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-ring-primary"
            >
              <option value="telegram">Telegram</option>
            </select>

            {selectedConnectableApp === "telegram" ? (
              <div className="space-y-3">
                <div className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface p-3">
                  <div className="mb-2 flex items-center gap-2 text-brand-primary">
                    <Send size={15} />
                    <Text className="font-bold">Telegram</Text>
                  </div>
                  <Text variant="caption">
                    Genera un codice e invialo al bot: Birgus associa in automatico il tuo Chat ID al profilo.
                  </Text>
                </div>
                <Button type="button" onClick={() => void handleCreateTelegramLink()} disabled={isSavingApp}>
                  {isSavingApp ? "Generazione..." : "Genera codice"}
                </Button>
                {telegramLink ? (
                  <div className="space-y-2 rounded-[var(--radius-md)] border border-brand-primary/30 bg-status-info-bg p-3">
                    <Text variant="caption">Invia questo messaggio al bot entro 10 minuti.</Text>
                    <div className="flex items-center justify-between gap-2">
                      <code className="min-w-0 break-all text-sm font-bold text-text-primary">/link {telegramLink.code}</code>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void handleCopyTelegramCommand()} aria-label="Copia comando Telegram" title="Copia comando Telegram">
                        <Copy size={15} />
                      </Button>
                    </div>
                    {telegramLink.botUsername ? (
                      <a className="text-xs font-semibold text-brand-primary hover:underline" href={`https://t.me/${telegramLink.botUsername}?start=${encodeURIComponent(telegramLink.code)}`} target="_blank" rel="noreferrer">
                        Apri @{telegramLink.botUsername} e collega l'account
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {connectedApps.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-border-default p-4">
                <Text variant="muted">Nessun applicativo collegato.</Text>
              </div>
            ) : connectedApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3">
                <div className="min-w-0">
                  <Text className="font-bold">{app.label}</Text>
                  <Text variant="caption" className="break-all">
                    {app.verifiedAt ? "Collegato" : "Da verificare"}
                  </Text>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemoveApp(app.id)}
                  aria-label={`Rimuovi ${app.label}`}
                  title={`Rimuovi ${app.label}`}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Card> : null}

      <Card className="space-y-4 p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
            <KeyRound size={16} />
          </div>
          <Text as="h2" variant="h2">Cambio password</Text>
        </div>

        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void handleChangePassword(event)}>
          <Input
            id="current-password"
            name="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Password attuale"
            autoComplete="current-password"
          />
          <Input
            id="new-password"
            name="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Nuova password"
            autoComplete="new-password"
          />
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Conferma nuova password"
            autoComplete="new-password"
          />

          <div className="md:col-span-3">
            <Button type="submit" disabled={isChangePasswordDisabled}>
              {isSubmitting ? "Aggiornamento..." : "Aggiorna password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
