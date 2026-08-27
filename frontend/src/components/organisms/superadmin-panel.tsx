"use client";

import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Label, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { cn } from "@/lib/cn";

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

const passwordMeetsPolicy = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value);

const generatePassword = (): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  const take = (source: string) => source[crypto.getRandomValues(new Uint32Array(1))[0] % source.length] ?? "A";
  const result = [take(upper), take(lower), take(digits), take(symbols)];
  while (result.length < 16) {
    result.push(take(all));
  }
  return result.sort(() => crypto.getRandomValues(new Uint32Array(1))[0] - 2 ** 31).join("");
};

const userFullName = (user: UserDto) => `${user.firstName} ${user.lastName ?? ""}`.trim() || user.email;

function StatePill({ tone, children }: { tone: "success" | "muted" | "warn" | "danger"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold",
        tone === "success" && "bg-status-success-bg text-status-success-text",
        tone === "muted" && "bg-bg-muted text-text-muted",
        tone === "warn" && "bg-status-warn-bg text-status-warn-text",
        tone === "danger" && "bg-status-danger-bg text-status-danger-text",
      )}
    >
      {children}
    </span>
  );
}

function RadioChoice({
  checked,
  children,
  disabled,
  name,
  onChange,
}: {
  checked: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  name: string;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-[var(--radius-sm)] border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors",
        checked && "border-brand-primary bg-status-info-bg text-text-primary",
        disabled && "opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-surface",
          checked && "border-brand-primary",
        )}
        aria-hidden="true"
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-brand-primary" /> : null}
      </span>
      <span className="truncate">{children}</span>
    </label>
  );
}

export function SuperadminPanel() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [modules, setModules] = useState<ModuleDto[]>([]);

  const [search, setSearch] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);

  const [memberships, setMemberships] = useState<MembershipDto[]>([]);
  const [userModules, setUserModules] = useState<UserModuleStateDto[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState("operator");

  const [passwordResetValue, setPasswordResetValue] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [createRoleKey, setCreateRoleKey] = useState("operator");
  const [addWorkspaceId, setAddWorkspaceId] = useState("");
  const [addWorkspaceRoleKey, setAddWorkspaceRoleKey] = useState("operator");
  const [isSaving, setIsSaving] = useState(false);

  const selectedUser = useMemo(() => users.find((item) => item.id === selectedUserId) ?? null, [users, selectedUserId]);
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );
  const selectedWorkspaceMembership = useMemo(
    () => memberships.find((membership) => membership.workspaceId === selectedWorkspaceId) ?? null,
    [memberships, selectedWorkspaceId],
  );
  const availableWorkspaceOptions = useMemo(() => {
    const membershipWorkspaceIds = new Set(memberships.map((membership) => membership.workspaceId));
    return workspaces
      .filter((workspace) => !membershipWorkspaceIds.has(workspace.id))
      .map((workspace) => ({
        value: workspace.id,
        label: `${workspace.organizationCode}/${workspace.code}`,
      }));
  }, [memberships, workspaces]);

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
      label: `${userFullName(user)} (${user.email})`,
    })),
    [users],
  );

  const loadBase = async (params?: { keepLoading?: boolean; searchOverride?: string }) => {
    if (!params?.keepLoading) {
      setLoading(true);
    }
    try {
      const userQuery = new URLSearchParams();
      const effectiveSearch = params?.searchOverride ?? search;
      if (effectiveSearch.trim()) {
        userQuery.set("search", effectiveSearch.trim());
      }
      if (selectedWorkspaceId) {
        userQuery.set("workspaceId", selectedWorkspaceId);
      }

      const [workspacePayload, userPayload, rolePayload, modulePayload] = await Promise.all([
        fetchJson<{ workspaces: WorkspaceDto[] }>("/api/superadmin/workspaces"),
        fetchJson<{ users: UserDto[] }>(`/api/superadmin/users${userQuery.toString() ? `?${userQuery.toString()}` : ""}`),
        fetchJson<{ roles: RoleDto[] }>("/api/superadmin/roles"),
        fetchJson<{ modules: ModuleDto[] }>("/api/superadmin/modules"),
      ]);

      const nextWorkspaces = workspacePayload.workspaces ?? [];
      const nextUsers = userPayload.users ?? [];
      setWorkspaces(nextWorkspaces);
      setUsers(nextUsers);
      setRoles(rolePayload.roles ?? []);
      setModules(modulePayload.modules ?? []);

      if (!selectedWorkspaceId && nextWorkspaces[0]?.id) {
        setSelectedWorkspaceId(nextWorkspaces[0].id);
      }
      if (selectedUserId && !nextUsers.some((user) => user.id === selectedUserId)) {
        setSelectedUserId("");
        setUserModalOpen(false);
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
      setSelectedRoleKey("operator");
      return;
    }

    try {
      const [membershipPayload, modulesPayload] = await Promise.all([
        fetchJson<{ memberships: MembershipDto[] }>(`/api/superadmin/users/${encodeURIComponent(userId)}/memberships`),
        fetchJson<{ modules: UserModuleStateDto[] }>(
          `/api/superadmin/users/${encodeURIComponent(userId)}/modules?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
      ]);

      const nextMemberships = membershipPayload.memberships ?? [];
      setMemberships(nextMemberships);
      setUserModules(modulesPayload.modules ?? []);

      const membership = nextMemberships.find((item) => item.workspaceId === workspaceId) ?? null;
      setSelectedRoleKey(membership?.roleKeys[0] ?? "operator");
      setAddWorkspaceId((current) => (
        current && nextMemberships.some((item) => item.workspaceId === current) ? "" : current
      ));
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
      void loadBase({ keepLoading: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId]);

  useEffect(() => {
    void loadUserContext(selectedUserId, selectedWorkspaceId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, selectedWorkspaceId]);

  const openUserManagement = (userId: string) => {
    setSelectedUserId(userId);
    setPasswordResetValue("");
    setShowResetPassword(false);
    setUserModalOpen(true);
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
    if (!passwordMeetsPolicy(createPassword)) {
      toast.error("La password deve avere almeno 8 caratteri, una maiuscola e un numero.");
      return;
    }
    if (!createRoleKey) {
      toast.error("Seleziona un ruolo.");
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
          roleKeys: [createRoleKey],
        }),
      });
      setSearch("");
      await loadBase({ keepLoading: true, searchOverride: "" });
      setCreateEmail("");
      setCreateFirstName("");
      setCreateLastName("");
      setCreatePassword("");
      setCreateRoleKey("operator");
      openUserManagement(payload.userId);
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
      await loadBase({ keepLoading: true });
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
    if (!passwordMeetsPolicy(passwordResetValue)) {
      toast.error("La password deve avere almeno 8 caratteri, una maiuscola e un numero.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson(`/api/superadmin/users/${encodeURIComponent(selectedUserId)}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: passwordResetValue }),
      });
      setPasswordResetValue("");
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

  const handleAddWorkspace = async () => {
    if (!selectedUserId || !addWorkspaceId || !addWorkspaceRoleKey) {
      toast.error("Seleziona workspace e ruolo.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson(`/api/superadmin/users/${encodeURIComponent(selectedUserId)}/workspaces`, {
        method: "POST",
        body: JSON.stringify({
          workspaceId: addWorkspaceId,
          roleKey: addWorkspaceRoleKey,
        }),
      });
      setSelectedWorkspaceId(addWorkspaceId);
      setAddWorkspaceId("");
      setAddWorkspaceRoleKey("operator");
      await loadBase({ keepLoading: true });
      await loadUserContext(selectedUserId, addWorkspaceId);
      toast.success("Utente associato al workspace.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Associazione workspace non riuscita.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedUserId || !selectedWorkspaceId) {
      toast.error("Seleziona workspace e utente.");
      return;
    }
    if (!selectedRoleKey) {
      toast.error("Seleziona un ruolo.");
      return;
    }

    try {
      setIsSaving(true);
      await fetchJson("/api/superadmin/workspace-roles", {
        method: "PUT",
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          userId: selectedUserId,
          roleKeys: [selectedRoleKey],
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Text as="h1" variant="h1">Superadmin Center</Text>
            <PageHelpHint text={t("superadmin.help")} />
          </div>
            <Text variant="muted">{t("superadmin.subtitle")}</Text>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-sm">
          <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-3 py-2">
            <div className="font-semibold text-text-primary">{users.length}</div>
            <div className="text-xs text-text-muted">{t("superadmin.users")}</div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-3 py-2">
            <div className="font-semibold text-text-primary">{workspaces.length}</div>
            <div className="text-xs text-text-muted">{t("superadmin.workspace")}</div>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-3 py-2">
            <div className="font-semibold text-text-primary">{roles.length}</div>
            <div className="text-xs text-text-muted">{t("superadmin.roles")}</div>
          </div>
        </div>
      </div>

      <Card className="p-4 lg:p-5">
        <div className="grid max-w-[760px] gap-3 sm:grid-cols-[minmax(240px,360px)_minmax(220px,260px)] lg:grid-cols-[minmax(260px,340px)_minmax(220px,260px)_auto] lg:items-end">
          <div>
            <Label htmlFor="superadmin-user-search">{t("superadmin.searchUser")}</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                id="superadmin-user-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadBase({ keepLoading: true });
                  }
                }}
                placeholder={t("superadmin.searchPlaceholder")}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="superadmin-workspace">{t("superadmin.operatingWorkspace")}</Label>
            <SelectDropdown
              id="superadmin-workspace"
              value={selectedWorkspaceId}
              onChange={(nextValue) => setSelectedWorkspaceId(nextValue)}
              options={workspaceOptions}
              placeholder={t("superadmin.allWorkspaces")}
              disabled={loading || isSaving}
              allowEmpty
              className="mt-1"
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <Button onClick={() => void loadBase({ keepLoading: true })} disabled={loading || isSaving} className="h-11 w-full sm:w-auto">
              <RefreshCw size={16} />
              {t("superadmin.refresh")}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span>{loading ? t("common.loading") : t("superadmin.updated")}</span>
          {selectedWorkspace ? <span>Workspace: {selectedWorkspace.organizationCode}/{selectedWorkspace.code}</span> : <span>{t("superadmin.allWorkspaces")}</span>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-4 lg:px-5">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2">{t("superadmin.usersTitle")}</Text>
            </div>
            <SelectDropdown
              value={selectedUserId}
              onChange={(nextUserId) => {
                if (nextUserId) {
                  openUserManagement(nextUserId);
                } else {
                  setSelectedUserId("");
                }
              }}
              options={userOptions}
              placeholder={t("superadmin.selectUser")}
              disabled={loading || isSaving}
              allowEmpty
              size="sm"
              className="w-full max-w-xs"
            />
          </div>

          <div className="divide-y divide-border-subtle">
            {users.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-text-muted">
                {t("superadmin.noUsers")}
              </div>
            ) : users.map((user) => (
              <div key={user.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">{userFullName(user)}</p>
                    <StatePill tone={user.isActive ? "success" : "danger"}>{user.isActive ? t("superadmin.active") : t("superadmin.inactive")}</StatePill>
                    {user.superadmin ? <StatePill tone="warn">Superadmin</StatePill> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span className="truncate">{user.email}</span>
                    <span>{user.workspaceCount} {t("superadmin.workspace")}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button size="sm" onClick={() => openUserManagement(user.id)} disabled={isSaving}>
                    <MoreHorizontal size={16} />
                    {t("superadmin.manage")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 lg:p-5">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-brand-primary" />
            <Text as="h2" variant="h2">{t("superadmin.createUser")}</Text>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {t("superadmin.createHint")}
          </p>

          <div className="mt-4 space-y-3">
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="create-first-name">{t("superadmin.firstName")}</Label>
                <Input
                  id="create-first-name"
                  value={createFirstName}
                  onChange={(event) => setCreateFirstName(event.target.value)}
                  className="mt-1"
                  placeholder={t("superadmin.firstName")}
                />
              </div>
              <div>
                <Label htmlFor="create-last-name">{t("superadmin.lastName")}</Label>
                <Input
                  id="create-last-name"
                  value={createLastName}
                  onChange={(event) => setCreateLastName(event.target.value)}
                  className="mt-1"
                  placeholder={t("superadmin.lastName")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="create-password">{t("superadmin.initialPassword")}</Label>
              <div className="relative mt-1">
                <Input
                  id="create-password"
                  type={showCreatePassword ? "text" : "password"}
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  className="pr-20"
                  placeholder={t("superadmin.passwordHint")}
                  autoComplete="new-password"
                />
                <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    className="p-1 text-text-muted hover:text-text-primary"
                    title={t("superadmin.generatePassword")}
                    onClick={() => {
                      setCreatePassword(generatePassword());
                      setShowCreatePassword(true);
                    }}
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-text-muted hover:text-text-primary"
                    title={showCreatePassword ? t("superadmin.hidePassword") : t("superadmin.showPassword")}
                    onClick={() => setShowCreatePassword((value) => !value)}
                  >
                    {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <Label>{t("superadmin.initialRole")}</Label>
              <div className="mt-2 grid gap-2">
                {roles.map((role) => (
                  <RadioChoice
                    key={`create-${role.key}`}
                    name="create-user-role"
                    checked={createRoleKey === role.key}
                    disabled={isSaving}
                    onChange={() => setCreateRoleKey(role.key)}
                  >
                    {role.label}
                  </RadioChoice>
                ))}
              </div>
            </div>

            <Button onClick={() => void handleCreateUser()} disabled={isSaving || !selectedWorkspaceId} className="w-full">
              <UserPlus size={16} />
              {t("superadmin.createUser")}
            </Button>
          </div>
        </Card>
      </div>

      {userModalOpen && selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-label={t("superadmin.userManagement")}>
          <section className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-default bg-bg-surface shadow-elevated">
            <header className="flex flex-col gap-3 border-b border-border-default px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="h2" variant="h2">{userFullName(selectedUser)}</Text>
                  <StatePill tone={selectedUser.isActive ? "success" : "danger"}>{selectedUser.isActive ? t("superadmin.active") : t("superadmin.inactive")}</StatePill>
                  {selectedUser.superadmin ? <StatePill tone="warn">Superadmin</StatePill> : null}
                </div>
                <p className="mt-1 truncate text-sm text-text-muted">{selectedUser.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-[var(--radius-md)] p-2 text-text-muted hover:bg-bg-muted hover:text-text-primary"
                  onClick={() => setUserModalOpen(false)}
                  aria-label={t("superadmin.closeUserManagement")}
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-5">
              <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="space-y-4">
                  <section className="rounded-[var(--radius-md)] border border-border-default p-4">
                    <div className="flex items-center gap-2">
                      <KeyRound size={17} className="text-brand-primary" />
                      <h3 className="text-sm font-semibold text-text-primary">{t("superadmin.accessSessions")}</h3>
                    </div>
                    <div className="mt-4 space-y-3">
                      <Button
                        variant={selectedUser.isActive ? "outline" : "primary"}
                        onClick={() => void handleSetUserStatus(!selectedUser.isActive)}
                        disabled={isSaving}
                        className="w-full"
                      >
                        {selectedUser.isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        {selectedUser.isActive ? t("superadmin.disableUser") : t("superadmin.enableUser")}
                      </Button>
                      <Button variant="outline" onClick={() => void handleRevokeSessions()} disabled={isSaving} className="w-full">
                        <RotateCcw size={16} />
                        {t("superadmin.revokeSessions")}
                      </Button>
                      <Button variant="outline" onClick={() => void handleResetTwoFactor()} disabled={isSaving} className="w-full">
                        <ShieldCheck size={16} />
                        Reset 2FA
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-md)] border border-border-default p-4">
                    <h3 className="text-sm font-semibold text-text-primary">{t("superadmin.resetPassword")}</h3>
                    <div className="mt-3">
                      <Label htmlFor="superadmin-password-reset">{t("superadmin.forcedPassword")}</Label>
                      <div className="relative mt-1">
                        <Input
                          id="superadmin-password-reset"
                          type={showResetPassword ? "text" : "password"}
                          value={passwordResetValue}
                          onChange={(event) => setPasswordResetValue(event.target.value)}
                          className="pr-20"
                          placeholder={t("superadmin.passwordHint")}
                          autoComplete="new-password"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                          <button
                            type="button"
                            className="p-1 text-text-muted hover:text-text-primary"
                            title={t("superadmin.generatePassword")}
                            onClick={() => {
                              setPasswordResetValue(generatePassword());
                              setShowResetPassword(true);
                            }}
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-text-muted hover:text-text-primary"
                            title={showResetPassword ? t("superadmin.hidePassword") : t("superadmin.showPassword")}
                            onClick={() => setShowResetPassword((value) => !value)}
                          >
                            {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => void handleResetPassword()} disabled={isSaving || !passwordResetValue} className="mt-3 w-full">
                      <KeyRound size={16} />
                      {t("superadmin.updatePassword")}
                    </Button>
                  </section>

                  <section className="rounded-[var(--radius-md)] border border-border-default p-4">
                    <h3 className="text-sm font-semibold text-text-primary">{t("superadmin.memberships")}</h3>
                    <div className="mt-3 space-y-2 text-xs text-text-muted">
                      {memberships.length === 0 ? (
                        <p>{t("superadmin.noMembership")}</p>
                      ) : memberships.map((item) => (
                        <div key={item.workspaceId} className="rounded-[var(--radius-sm)] bg-bg-muted px-3 py-2">
                          <div className="font-semibold text-text-secondary">{item.workspaceCode}</div>
                          <div>{item.status} - {item.roleKeys.join(", ") || t("superadmin.noRole")}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-border-subtle pt-4">
                      <h4 className="text-xs font-semibold uppercase text-text-muted">{t("superadmin.assignWorkspace")}</h4>
                      <div className="mt-3 space-y-3">
                        <SelectDropdown
                          value={addWorkspaceId}
                          onChange={(nextValue) => setAddWorkspaceId(nextValue)}
                          options={availableWorkspaceOptions}
                          placeholder={t("superadmin.workspace")}
                          disabled={isSaving || availableWorkspaceOptions.length === 0}
                        />
                        <SelectDropdown
                          value={addWorkspaceRoleKey}
                          onChange={(nextValue) => setAddWorkspaceRoleKey(nextValue)}
                          options={roles.map((role) => ({ value: role.key, label: role.label }))}
                          placeholder={t("superadmin.role")}
                          disabled={isSaving || availableWorkspaceOptions.length === 0}
                        />
                        <Button
                          size="sm"
                          onClick={() => void handleAddWorkspace()}
                          disabled={isSaving || !addWorkspaceId || !addWorkspaceRoleKey}
                          className="w-full"
                        >
                          {t("superadmin.assign")}
                        </Button>
                      </div>
                    </div>
                  </section>
                </aside>

                <div className="space-y-5">
                  <section className="rounded-[var(--radius-md)] border border-border-default p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">{t("superadmin.workspaceRole")}</h3>
                        <p className="text-xs text-text-muted">
                          {selectedWorkspaceMembership ? selectedWorkspaceMembership.workspaceName : t("superadmin.notMember")}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => void handleSaveRoles()} disabled={isSaving || !selectedRoleKey}>
                        {t("superadmin.saveRole")}
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {roles.map((role) => (
                        <RadioChoice
                          key={role.key}
                          name="selected-user-role"
                          checked={selectedRoleKey === role.key}
                          disabled={!selectedWorkspaceMembership || isSaving}
                          onChange={() => setSelectedRoleKey(role.key)}
                        >
                          {role.label}
                        </RadioChoice>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-md)] border border-border-default p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{t("superadmin.moduleAccess")}</h3>
                      <p className="text-xs text-text-muted">{t("superadmin.moduleAccessHint")}</p>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-border-subtle text-sm">
                        <thead>
                          <tr className="text-left text-text-muted">
                            <th className="px-2 py-2 font-semibold">{t("superadmin.module")}</th>
                            <th className="px-2 py-2 font-semibold">{t("superadmin.workspace")}</th>
                            <th className="px-2 py-2 font-semibold">{t("superadmin.override")}</th>
                            <th className="px-2 py-2 font-semibold">{t("superadmin.effective")}</th>
                            <th className="px-2 py-2 font-semibold">{t("archive.actions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {overridableModules.map((module) => {
                            const state = userModules.find((item) => item.moduleKey === module.key) ?? null;
                            return (
                              <tr key={module.key}>
                                <td className="px-2 py-2">
                                  <div className="font-medium text-text-primary">{module.name}</div>
                                  <div className="font-mono text-[11px] text-text-muted">{module.key}</div>
                                </td>
                                <td className="px-2 py-2">{state ? <StatePill tone={state.workspaceEnabled ? "success" : "muted"}>{state.workspaceEnabled ? "ON" : "OFF"}</StatePill> : "-"}</td>
                                <td className="px-2 py-2">{state?.overrideMode ? <StatePill tone={state.overrideMode === "ALLOW" ? "success" : "danger"}>{state.overrideMode}</StatePill> : "-"}</td>
                                <td className="px-2 py-2">{state ? <StatePill tone={state.effectiveEnabled ? "success" : "danger"}>{state.effectiveEnabled ? "ON" : "OFF"}</StatePill> : "-"}</td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    <Button size="sm" onClick={() => void handleSetModuleOverride(module.key, "ALLOW")} disabled={isSaving || !selectedWorkspaceMembership}>
                                      Allow
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => void handleSetModuleOverride(module.key, "DENY")} disabled={isSaving || !selectedWorkspaceMembership}>
                                      Deny
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => void handleClearModuleOverride(module.key)} disabled={isSaving || !selectedWorkspaceMembership || !state?.overrideMode}>
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
                  </section>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
