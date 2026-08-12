"use client";

import { KeyRound, Mail, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";

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

export function PersonalDashboardPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse["user"] | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Impossibile caricare il profilo.");
        }

        const payload = (await response.json()) as ProfileResponse;
        setProfile(payload.user);
      } catch {
        toast.error("Errore caricamento dashboard personale.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
  }, []);

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

    if (newPassword.length < 5) {
      toast.error("La nuova password deve avere almeno 5 caratteri.");
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

      <Card className="space-y-4 p-5 lg:p-6">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-status-info-bg text-brand-primary">
            <KeyRound size={16} />
          </div>
          <Text as="h2" variant="h2">Cambio password</Text>
        </div>

        <form className="grid gap-3 md:grid-cols-3" onSubmit={(event) => void handleChangePassword(event)}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Password attuale"
            autoComplete="current-password"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Nuova password"
            autoComplete="new-password"
          />
          <Input
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
