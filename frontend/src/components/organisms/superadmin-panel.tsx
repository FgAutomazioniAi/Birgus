"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Label, Text } from "@/components/atoms";
import { SelectDropdown } from "@/components/molecules";

type WorkspaceDto = {
  id: string;
  code: string;
  name: string;
  organizationCode: string;
  organizationName: string;
  isActive: boolean;
};

type UserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  isActive: boolean;
  workspaceCount: number;
  superadmin: boolean;
};

type RoleDto = {
  key: string;
  label: string;
};

type ModuleDto = {
  key: string;
  name: string;
};

type MembershipDto = {
  workspaceId: string;
  workspaceCode: string;
  workspaceName: string;
  status: string;
  roleKeys: string[];
};

type UserModuleStateDto = {
  moduleKey: string;
  workspaceEnabled: boolean;
  overrideMode: "ALLOW" | "DENY" | null;
  effectiveEnabled: boolean;
};

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as { message?: string } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? payload.message : undefined;
    throw new Error(message ?? "Operazione non riuscita.");
  }

  return payload as T;
};

export function SuperadminPanel() {
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [modules, setModules] = useState<ModuleDto[]>([]);

  const [search, setSearch] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [memberships, setMemberships] = useState<MembershipDto[]>([]);
  const [userModules, setUserModules] = useState<UserModuleStateDto[]>([]);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>([]);

  const [passwordResetValue, setPasswordResetValue] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRoleKeys, setCreateRoleKeys] = useState<string[]>(["operator"]);
  const [isSaving, setIsSaving] = useState(false);

  const selectedUser = useMemo(() => users.find((item) => item.id === selectedUserId) ?? null, [users, selectedUserId]);
  const workspaceOptions = useMemo(
    () => workspaces.map((workspace) => ({
      value: workspace.id,
      label: `${workspace.organizationCode}/${workspace.code}`,
    })),
    [workspaces],
  );
  const overridableModules = useMemo(
    () => modules.filter((module) => module.key !== "superadmin_center"),
    [modules],
  );
  const userOptions = useMemo(
    () => users.map((user) => ({
      value: user.id,
      label: `${user.firstName} ${user.lastName ?? ""} (${user.email})`,
    })),
    [users],
  );

  const loadBase = async () => {
    setLoading(true);
    try {
      const [workspacePayload, userPayload, rolePayload, modulePayload] = await Promise.all([
        fetchJson<{ workspaces: WorkspaceDto[] }>("/api/superadmin/workspaces"),
        fetchJson<{ users: UserDto[] }>(`/api/superadmin/users?search=${encodeURIComponent(search.trim())}${selectedWorkspaceId ? `&workspaceId=${encodeURIComponent(selectedWorkspaceId)}` : ""}`),
        fetchJson<{ roles: RoleDto[] }>("/api/superadmin/roles"),
        fetchJson<{ modules: ModuleDto[] }>("/api/superadmin/modules"),
      ]);

      setWorkspaces(workspacePayload.workspaces ?? []);
      setUsers(userPayload.users ?? []);
      if (selectedUserId && !(userPayload.users ?? []).some((user) => user.id === selectedUserId)) {
        setSelectedUserId("");
      }
      setRoles(rolePayload.roles ?? []);
      setModules(modulePayload.modules ?? []);

      const fallbackWorkspaceId = workspacePayload.workspaces?.[0]?.id ?? "";
      if (!selectedWorkspaceId && fallbackWorkspaceId) {
        setSelectedWorkspaceId(fallbackWorkspaceId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Caricamento non riuscito.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserContext = async (userId: string, workspaceId: string) => {
    if (!userId || !workspaceId) {
      setMemberships([]);
      setUserModules([]);
      setSelectedRoleKeys([]);
      return;
    }

    try {
      const [membershipPayload, modulesPayload] = await Promise.all([
        fetchJson<{ memberships: MembershipDto[] }>(`/api/superadmin/users/${encodeURIComponent(userId)}/memberships`),
        fetchJson<{ modules: UserModuleStateDto[] }>(
          `/api/superadmin/users/${encodeURIComponent(userId)}/modules?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
      ]);

      setMemberships(membershipPayload.memberships ?? []);
      setUserModules(modulesPayload.modules ?? []);

      const membership = (membershipPayload.memberships ?? []).find((item) => item.workspaceId === workspaceId) ?? null;
      setSelectedRoleKeys(membership?.roleKeys ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Caricamento contesto utente non riuscito.";
      toast.error(message);
    }
  };

  useEffect(() => {
    void loadBase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedWorkspaceId) {
      void loadBase();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId]);

  useEffect(() => {
    void loadUserContext(selectedUserId, selectedWorkspaceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, selectedWorkspaceId]);

  const handleRefreshUsers = async () => {
    await loadBase();
  };

  const handleToggleCreateRole = (roleKey: string) => {
    setCreateRoleKeys((current) => (
      current.includes(roleKey)
        ? current.filter((item) => item !== roleKey)
        : [...current, roleKey]
    ));
  };

  const handleCreateUser = async () => {
    if (!selectedWorkspaceId) {
      toast.error("Seleziona un workspace.");
      return;
    }

    if (!createEmail.trim() || !createFirstName.trim()) {
      toast.error("Inserisci almeno email e nome.");
      return;
    }

    if (createPassword.trim().length < 5) {
      toast.error("La password deve avere almeno 5 caratteri.");
      return;
    }

    if (createRoleKeys.length === 0) {
      toast.error("Seleziona almeno un ruolo.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = await fetchJson<{ userId: string; email: string }>("/api/superadmin/users", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          email: createEmail.trim().toLowerCase(),
          firstName: createFirstName.trim(),
          lastName: createLastName.trim() || null,
          password: createPassword,
          roleKeys: createRoleKeys,
        }),
      });
      await loadBase();
      setSelectedUserId(payload.userId);
      setCreateEmail("");
      setCreateFirstName("");
      setCreateLastName("");
      setCreatePassword("");
      setCreateRoleKeys(["operator"]);
      toast.success(`Utente creato: ${payload.email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Creazione utente non riuscita.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetUserStatus = async (isActive: boolean) => {
    if (!selectedUserId) {
      toast.error("Seleziona un utente.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson(`/api/superadmin/users/${encodeURIComponent(selectedUserId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
      await loadBase();
      await loadUserContext(selectedUserId, selectedWorkspaceId);
      toast.success(isActive ? "Utente attivato." : "Utente disattivato.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aggiornamento stato utente non riuscito.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserId) {
      toast.error("Seleziona un utente.");
      return;
    }

    if (passwordResetValue.trim().length < 5) {
      toast.error("La password deve avere almeno 5 caratteri.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson(`/api/superadmin/users/${encodeURIComponent(selectedUserId)}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: passwordResetValue }),
      });
      toast.success("Password utente aggiornata e sessioni revocate.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset password non riuscito.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!selectedUserId) {
      toast.error("Seleziona un utente.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson(`/api/superadmin/users/${encodeURIComponent(selectedUserId)}/revoke-sessions`, {
        method: "POST",
      });
      toast.success("Sessioni utente revocate.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Revoca sessioni non riuscita.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTwoFactor = async () => {
    if (!selectedUserId) {
      toast.error("Seleziona un utente.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson(`/api/superadmin/users/${encodeURIComponent(selectedUserId)}/reset-2fa`, {
        method: "POST",
      });
      toast.success("2FA utente resettato e sessioni revocate.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset 2FA non riuscito.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetModuleOverride = async (moduleKey: string, mode: "ALLOW" | "DENY") => {
    if (!selectedUserId || !selectedWorkspaceId) {
      toast.error("Seleziona workspace e utente.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson("/api/superadmin/module-overrides", {
        method: "PUT",
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          userId: selectedUserId,
          moduleKey,
          mode,
          reason: `Override impostato da superadmin (${mode}).`,
        }),
      });
      await loadUserContext(selectedUserId, selectedWorkspaceId);
      toast.success(`Override ${mode} salvato su ${moduleKey}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Override modulo non riuscito.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearModuleOverride = async (moduleKey: string) => {
    if (!selectedUserId || !selectedWorkspaceId) {
      toast.error("Seleziona workspace e utente.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson("/api/superadmin/module-overrides", {
        method: "DELETE",
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          userId: selectedUserId,
          moduleKey,
          confirmText: "cancella",
        }),
      });
      await loadUserContext(selectedUserId, selectedWorkspaceId);
      toast.success(`Override rimosso su ${moduleKey}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rimozione override non riuscita.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRole = (roleKey: string) => {
    setSelectedRoleKeys((current) => (
      current.includes(roleKey)
        ? current.filter((item) => item !== roleKey)
        : [...current, roleKey]
    ));
  };

  const handleSaveRoles = async () => {
    if (!selectedUserId || !selectedWorkspaceId) {
      toast.error("Seleziona workspace e utente.");
      return;
    }

    if (selectedRoleKeys.length === 0) {
      toast.error("Seleziona almeno un ruolo.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson("/api/superadmin/workspace-roles", {
        method: "PUT",
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          userId: selectedUserId,
          roleKeys: selectedRoleKeys,
        }),
      });
      await loadUserContext(selectedUserId, selectedWorkspaceId);
      toast.success("Ruoli workspace aggiornati.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aggiornamento ruoli non riuscito.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-[var(--radius-md)] bg-bg-muted p-2 text-brand-primary">
          <ShieldCheck size={20} />
        </div>
        <div>
          <Text as="h1" variant="h1">Superadmin Center</Text>
          <Text variant="muted">Gestione globale utenti, permessi e operazioni sensibili cross-workspace.</Text>
        </div>
      </div>

      <Card className="p-4 lg:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <div>
            <Label htmlFor="superadmin-user-search">Cerca utente</Label>
            <Input
              id="superadmin-user-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="nome, cognome o email"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="superadmin-workspace">Workspace</Label>
            <SelectDropdown
              id="superadmin-workspace"
              value={selectedWorkspaceId}
              onChange={(nextValue) => setSelectedWorkspaceId(nextValue)}
              options={workspaceOptions}
              placeholder="Seleziona workspace"
              disabled={loading || isSaving}
              allowEmpty
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="superadmin-user">Utente</Label>
            <SelectDropdown
              id="superadmin-user"
              value={selectedUserId}
              onChange={(nextValue) => setSelectedUserId(nextValue)}
              options={userOptions}
              placeholder="Seleziona utente"
              disabled={loading || isSaving}
              allowEmpty
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void handleRefreshUsers()} disabled={loading || isSaving} className="h-11 w-full">
              Aggiorna
            </Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-text-muted">
          {loading ? "Caricamento..." : `${users.length} utenti caricati · ${workspaces.length} workspace`}
        </div>
      </Card>

      <Card className="p-4 lg:p-5">
        <Text as="h2" variant="h2">Crea utente</Text>
        <p className="mt-1 text-sm text-text-muted">Creazione rapida utente nel workspace selezionato.</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              value={createEmail}
              onChange={(event) => setCreateEmail(event.target.value)}
              className="mt-1"
              placeholder="nuovo.utente@azienda.it"
            />
          </div>
          <div>
            <Label htmlFor="create-password">Password iniziale</Label>
            <Input
              id="create-password"
              value={createPassword}
              onChange={(event) => setCreatePassword(event.target.value)}
              className="mt-1"
              placeholder="almeno 5 caratteri"
            />
          </div>
          <div>
            <Label htmlFor="create-first-name">Nome</Label>
            <Input
              id="create-first-name"
              value={createFirstName}
              onChange={(event) => setCreateFirstName(event.target.value)}
              className="mt-1"
              placeholder="Nome"
            />
          </div>
          <div>
            <Label htmlFor="create-last-name">Cognome</Label>
            <Input
              id="create-last-name"
              value={createLastName}
              onChange={(event) => setCreateLastName(event.target.value)}
              className="mt-1"
              placeholder="Cognome"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <label key={`create-${role.key}`} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={createRoleKeys.includes(role.key)}
                onChange={() => handleToggleCreateRole(role.key)}
                disabled={isSaving}
              />
              <span>{role.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <Button onClick={() => void handleCreateUser()} disabled={isSaving || !selectedWorkspaceId}>
            Crea utente
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-4 lg:p-5">
          <Text as="h2" variant="h2">Gestione credenziali/sessioni</Text>
          {selectedUser ? (
            <p className="mt-1 text-sm text-text-muted">
              {selectedUser.firstName} {selectedUser.lastName ?? ""} - {selectedUser.email} · stato: {selectedUser.isActive ? "Attivo" : "Disattivo"}
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-muted">Seleziona un utente per procedere.</p>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="superadmin-password-reset">Nuova password forzata</Label>
              <Input
                id="superadmin-password-reset"
                value={passwordResetValue}
                onChange={(event) => setPasswordResetValue(event.target.value)}
                className="mt-1"
                placeholder="almeno 5 caratteri"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedUser?.isActive ? "outline" : "primary"}
                onClick={() => void handleSetUserStatus(!(selectedUser?.isActive ?? false))}
                disabled={isSaving || !selectedUserId}
              >
                {selectedUser?.isActive ? "Disattiva utente" : "Attiva utente"}
              </Button>
              <Button onClick={() => void handleResetPassword()} disabled={isSaving || !selectedUserId}>Reset credenziali</Button>
              <Button variant="outline" onClick={() => void handleRevokeSessions()} disabled={isSaving || !selectedUserId}>
                Reset sessioni
              </Button>
              <Button variant="outline" onClick={() => void handleResetTwoFactor()} disabled={isSaving || !selectedUserId}>
                Reset 2FA
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 lg:p-5">
          <Text as="h2" variant="h2">Ruoli per workspace</Text>
          <p className="mt-1 text-sm text-text-muted">Override permessi via assegnazione ruoli nel workspace selezionato.</p>

          {memberships.length > 0 && (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-border-subtle bg-bg-muted p-2 text-xs text-text-muted">
              {memberships.map((item) => (
                <div key={item.workspaceId}>
                  {item.workspaceCode}: {item.status} · ruoli [{item.roleKeys.join(", ") || "nessuno"}]
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {roles.map((role) => (
              <label key={role.key} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-subtle px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedRoleKeys.includes(role.key)}
                  onChange={() => handleToggleRole(role.key)}
                  disabled={!selectedUserId || !selectedWorkspaceId || isSaving}
                />
                <span>{role.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <Button onClick={() => void handleSaveRoles()} disabled={isSaving || !selectedUserId || !selectedWorkspaceId}>
              Salva ruoli workspace
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-4 lg:p-5">
        <Text as="h2" variant="h2">Override moduli</Text>
        <p className="mt-1 text-sm text-text-muted">ALLOW bypassa lo stato workspace, DENY forza disabilitazione utente.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="px-2 py-2 font-semibold">Modulo</th>
                <th className="px-2 py-2 font-semibold">Workspace</th>
                <th className="px-2 py-2 font-semibold">Override</th>
                <th className="px-2 py-2 font-semibold">Effettivo</th>
                <th className="px-2 py-2 font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {overridableModules.map((module) => {
                const state = userModules.find((item) => item.moduleKey === module.key) ?? null;
                return (
                  <tr key={module.key}>
                    <td className="px-2 py-2 font-mono text-xs">{module.key}</td>
                    <td className="px-2 py-2">{state ? (state.workspaceEnabled ? "ON" : "OFF") : "-"}</td>
                    <td className="px-2 py-2">{state?.overrideMode ?? "-"}</td>
                    <td className="px-2 py-2">{state ? (state.effectiveEnabled ? "ON" : "OFF") : "-"}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          onClick={() => void handleSetModuleOverride(module.key, "ALLOW")}
                          disabled={isSaving || !selectedUserId || !selectedWorkspaceId}
                        >
                          Allow
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleSetModuleOverride(module.key, "DENY")}
                          disabled={isSaving || !selectedUserId || !selectedWorkspaceId}
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleClearModuleOverride(module.key)}
                          disabled={isSaving || !selectedUserId || !selectedWorkspaceId}
                        >
                          Clear
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
