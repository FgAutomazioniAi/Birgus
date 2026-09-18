"use client";

import {
  Database,
  Loader2,
  Pencil,
  Plus,
  ServerCog,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Checkbox, Input, Label, Text } from "@/components/atoms";
import { BirgusDialog } from "@/components/molecules";

type DatabaseConnection = {
  id: string;
  name: string;
  dbType: "sqlserver";
  host: string;
  port: number;
  databaseName: string;
  sourceView?: string | null;
  username: string;
  trustServerCertificate: boolean;
  isEnabled: boolean;
  passwordConfigured: boolean;
};
type Draft = Omit<DatabaseConnection, "id" | "passwordConfigured"> & {
  password: string;
};
type ModuleBinding = {
  moduleKey: "commission_registry";
  connectionId: string;
  connectionName: string;
};

const emptyDraft = (): Draft => ({
  name: "",
  dbType: "sqlserver",
  host: "",
  port: 1433,
  databaseName: "",
  sourceView: "",
  username: "",
  password: "",
  trustServerCertificate: false,
  isEnabled: true,
});

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      String(
        (payload as { message?: unknown }).message ??
          "Operazione non riuscita.",
      ),
    );
  return payload as T;
}

export function ExternalDatabaseConnectionsSettings() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [commissionConnectionId, setCommissionConnectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogStep, setDialogStep] = useState<"closed" | "type" | "config">(
    "closed",
  );
  const [editing, setEditing] = useState<DatabaseConnection | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<DatabaseConnection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [result, bindingsResult] = await Promise.all([
        request<{ connections: DatabaseConnection[] }>(
          "/api/settings/external-database-connections",
        ),
        request<{ bindings: ModuleBinding[] }>(
          "/api/settings/external-database-connections/module-bindings",
        ),
      ]);
      setConnections(result.connections);
      setCommissionConnectionId(
        bindingsResult.bindings.find(
          (binding) => binding.moduleKey === "commission_registry",
        )?.connectionId ?? "",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossibile caricare le connessioni database.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setDialogStep("type");
  };
  const openEdit = (connection: DatabaseConnection) => {
    setEditing(connection);
    setDraft({
      name: connection.name,
      dbType: connection.dbType,
      host: connection.host,
      port: connection.port,
      databaseName: connection.databaseName,
      sourceView: connection.sourceView ?? "",
      username: connection.username,
      password: "",
      trustServerCertificate: connection.trustServerCertificate,
      isEnabled: connection.isEnabled,
    });
    setDialogStep("config");
  };
  const save = async () => {
    if (!editing && !draft.password.trim()) {
      toast.error("Inserisci la password SQL Server.");
      return;
    }
    setSaving(true);
    try {
      const result = await request<{ connection: DatabaseConnection }>(
        editing
          ? `/api/settings/external-database-connections/${editing.id}`
          : "/api/settings/external-database-connections",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(draft) },
      );
      setConnections((items) =>
        editing
          ? items.map((item) =>
              item.id === result.connection.id ? result.connection : item,
            )
          : [...items, result.connection].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      setDialogStep("closed");
      toast.success(
        editing
          ? "Connessione aggiornata."
          : "Connessione SQL Server aggiunta.",
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Salvataggio non riuscito.",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async (connection: DatabaseConnection) => {
    try {
      await request<void>(
        `/api/settings/external-database-connections/${connection.id}`,
        { method: "DELETE" },
      );
      setConnections((items) =>
        items.filter((item) => item.id !== connection.id),
      );
      toast.success("Connessione eliminata.");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Eliminazione non riuscita.",
      );
    }
  };
  const testConnection = async (connection: DatabaseConnection) => {
    setTestingId(connection.id);
    try {
      await request<{ ok: boolean }>(
        `/api/settings/external-database-connections/${connection.id}/test`,
        { method: "POST" },
      );
      toast.success("Connessione SQL Server riuscita.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Test connessione non riuscito.",
      );
    } finally {
      setTestingId(null);
    }
  };

  const saveCommissionBinding = async () => {
    try {
      await request<{ ok: boolean }>(
        "/api/settings/external-database-connections/module-bindings/commission-registry",
        {
          method: "PUT",
          body: JSON.stringify({
            connectionId: commissionConnectionId || null,
          }),
        },
      );
      toast.success("Database associato alle Commesse aggiornato.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Associazione database non riuscita.",
      );
    }
  };

  return (
    <>
      <Card className="self-start space-y-3 p-4 md:col-span-2 xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2" className="text-base">
                Connessioni database
              </Text>
            </div>
            <Text variant="caption" className="mt-1 block">
              Collega le fonti dati esterne del workspace.
            </Text>
          </div>
          <Button type="button" size="sm" onClick={openNew}>
            <Plus size={16} />
            Aggiungi connessione
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
            <Loader2 size={16} className="animate-spin" />
            Caricamento connessioni…
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[var(--radius-md)] border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm font-semibold text-status-danger-text">
            {error}
          </div>
        ) : null}
        {!loading && !error && connections.length === 0 ? (
          <Text variant="caption">
            Nessuna connessione configurata. Aggiungi il primo SQL Server quando
            hai i parametri di accesso.
          </Text>
        ) : null}
        <div className="space-y-2">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-3"
            >
              <ServerCog size={18} className="text-brand-primary" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-text-primary">
                  {connection.name}
                </div>
                <div className="truncate text-xs text-text-muted">
                  SQL Server · Server: {connection.host} · Porta:{" "}
                  {connection.port} · Database: {connection.databaseName} ·{" "}
                  {connection.isEnabled ? "Attiva" : "Disattiva"}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!connection.isEnabled || testingId === connection.id}
                onClick={() => void testConnection(connection)}
              >
                {testingId === connection.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                Test
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openEdit(connection)}
              >
                <Pencil size={15} />
                Modifica
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 px-0 text-status-danger-text"
                title="Elimina connessione"
                onClick={() => setRemoving(connection)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <Card className="self-start space-y-3 p-4 md:col-span-2 xl:col-span-2">
        <div>
          <Text as="h2" variant="h2" className="text-base">
            Database per i moduli
          </Text>
          <Text variant="caption" className="mt-1 block">
            Ogni modulo usa una sola connessione. Gli utenti autorizzati
            potranno consultare solo quella vista.
          </Text>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-1">
            <Label htmlFor="commission-database-binding" className="text-xs">
              Commesse
            </Label>
            <select
              id="commission-database-binding"
              value={commissionConnectionId}
              onChange={(event) =>
                setCommissionConnectionId(event.target.value)
              }
              className="h-9 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-page px-3 text-sm text-text-primary"
            >
              <option value="">Nessun database associato</option>
              {connections
                .filter((connection) => connection.isEnabled)
                .map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
            </select>
          </div>
          <Button type="button" onClick={() => void saveCommissionBinding()}>
            Salva associazione
          </Button>
        </div>
      </Card>
      {dialogStep !== "closed" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Configura connessione database"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogStep("closed");
          }}
        >
          <div className="w-full max-w-lg border border-border-default bg-bg-surface p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database size={20} className="text-brand-primary" />
                  <Text as="h2" variant="h2">
                    {dialogStep === "type"
                      ? "Tipo di database"
                      : editing
                        ? "Modifica connessione"
                        : "Configura SQL Server"}
                  </Text>
                </div>
                <Text variant="caption" className="mt-1 block">
                  {dialogStep === "type"
                    ? "Scegli il database da collegare al workspace."
                    : "La password vuota conserva quella già configurata."}
                </Text>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0"
                title="Chiudi"
                onClick={() => setDialogStep("closed")}
              >
                <X size={16} />
              </Button>
            </div>
            {dialogStep === "type" ? (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setDialogStep("config")}
                  className="flex w-full items-center gap-3 border border-brand-primary bg-bg-muted p-4 text-left"
                >
                  <ServerCog size={22} className="text-brand-primary" />
                  <span>
                    <span className="block font-semibold text-text-primary">
                      Microsoft SQL Server
                    </span>
                    <span className="text-sm text-text-muted">
                      Disponibile ora
                    </span>
                  </span>
                </button>
                <Text variant="caption">
                  Altri motori potranno essere aggiunti senza modificare le
                  connessioni esistenti.
                </Text>
              </div>
            ) : (
              <DatabaseForm
                draft={draft}
                onChange={setDraft}
                saving={saving}
                editing={Boolean(editing)}
                onBack={() =>
                  editing ? setDialogStep("closed") : setDialogStep("type")
                }
                onSave={() => void save()}
              />
            )}
          </div>
        </div>
      ) : null}
      <BirgusDialog
        open={removing !== null}
        message={
          removing
            ? `Eliminare definitivamente la connessione "${removing.name}"? Sarà rimossa solo la configurazione Birgus; il database SQL Server esterno non verrà toccato.`
            : ""
        }
        confirmLabel="Elimina"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const connection = removing;
          setRemoving(null);
          if (connection) void remove(connection);
        }}
      />
    </>
  );
}

function DatabaseForm({
  draft,
  onChange,
  saving,
  editing,
  onBack,
  onSave,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  saving: boolean;
  editing: boolean;
  onBack: () => void;
  onSave: () => void;
}) {
  const patch = (value: Partial<Draft>) => onChange({ ...draft, ...value });
  return (
    <div className="mt-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="external-db-name" className="text-xs">
            Nome connessione
          </Label>
          <Input
            id="external-db-name"
            value={draft.name}
            className="h-9"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="external-db-host" className="text-xs">
            Server / host
          </Label>
          <Input
            id="external-db-host"
            value={draft.host}
            className="h-9"
            onChange={(event) => patch({ host: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="external-db-port" className="text-xs">
            Porta
          </Label>
          <Input
            id="external-db-port"
            type="number"
            min={1}
            max={65535}
            value={draft.port}
            className="h-9"
            onChange={(event) => patch({ port: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="external-db-database" className="text-xs">
            Database
          </Label>
          <Input
            id="external-db-database"
            value={draft.databaseName}
            className="h-9"
            onChange={(event) => patch({ databaseName: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="external-db-user" className="text-xs">
            Utente SQL
          </Label>
          <Input
            id="external-db-user"
            value={draft.username}
            className="h-9"
            autoComplete="off"
            onChange={(event) => patch({ username: event.target.value })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="external-db-source-view" className="text-xs">
            Vista sorgente (facoltativa)
          </Label>
          <Input
            id="external-db-source-view"
            value={draft.sourceView ?? ""}
            className="h-9"
            placeholder="dbo.vista"
            onChange={(event) => patch({ sourceView: event.target.value })}
          />
          <Text variant="caption">
            Lascia vuoto per connetterti solo al database.
          </Text>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="external-db-password" className="text-xs">
            Password {editing ? "(lascia vuoto per non cambiarla)" : ""}
          </Label>
          <Input
            id="external-db-password"
            type="password"
            value={draft.password}
            className="h-9"
            autoComplete="new-password"
            onChange={(event) => patch({ password: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Checkbox
          id="external-db-trust-certificate"
          checked={draft.trustServerCertificate}
          onChange={(event) =>
            patch({ trustServerCertificate: event.target.checked })
          }
          label="Considera attendibile il certificato del server"
        />
        <Checkbox
          id="external-db-enabled"
          checked={draft.isEnabled}
          onChange={(event) => patch({ isEnabled: event.target.checked })}
          label="Connessione attiva"
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}Salva
          connessione
        </Button>
      </div>
    </div>
  );
}
