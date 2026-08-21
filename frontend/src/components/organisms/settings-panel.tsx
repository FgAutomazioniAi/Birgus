"use client";

import { Bot, CheckCircle2, Loader2, Mail, Palette, PlugZap, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { useTheme } from "@/components/organisms/theme-provider";
import { useModuleAccess } from "@/lib/module-access";
import type { ThemeId } from "@/lib/themes";

interface AiProviderSettings {
  baseUrl: string;
  chatModel: string;
  provider: string;
  source: "database" | "environment";
  temperature: number;
  timeoutMs: number;
}

interface AiModelItem {
  id: string;
  type?: string;
}

interface MailProviderSettings {
  provider: "smtp" | "resend";
  from: string;
  source: "database" | "environment";
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpConfigured: boolean;
  resendConfigured: boolean;
}

const defaultAiProviderSettings: AiProviderSettings = {
  baseUrl: "http://vllm:8000/v1",
  chatModel: "birgus-vl",
  provider: "openai_compatible",
  source: "environment",
  temperature: 0,
  timeoutMs: 600000,
};

const defaultMailProviderSettings: MailProviderSettings = {
  provider: "smtp",
  from: "",
  source: "environment",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpConfigured: false,
  resendConfigured: false,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((payload as { message?: unknown }).message ?? "Richiesta non riuscita."));
  }
  return payload as T;
}

export function SettingsPanel() {
  const { options, theme, setTheme } = useTheme();
  const { hasModule } = useModuleAccess();
  const canConfigureAiProvider = hasModule("conversational_assistant");
  const canConfigureMailProvider = hasModule("notification_center");
  const selectedTheme = options.find((option) => option.id === theme) ?? options[0];
  const [aiSettings, setAiSettings] = useState<AiProviderSettings>(defaultAiProviderSettings);
  const [models, setModels] = useState<AiModelItem[]>([]);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mailSettings, setMailSettings] = useState<MailProviderSettings>(defaultMailProviderSettings);
  const [mailSecretPatch, setMailSecretPatch] = useState({ smtpPass: "", resendApiKey: "" });
  const [mailStatus, setMailStatus] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingMailSettings, setLoadingMailSettings] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatingMail, setValidatingMail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMail, setSavingMail] = useState(false);

  useEffect(() => {
    if (!canConfigureAiProvider) {
      setLoadingSettings(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const payload = await fetchJson<{ settings: AiProviderSettings }>("/api/settings/ai-provider");
        setAiSettings(payload.settings);
      } catch (error) {
        setAiError(error instanceof Error ? error.message : "Impossibile leggere le impostazioni AI.");
      } finally {
        setLoadingSettings(false);
      }
    };

    void loadSettings();
  }, [canConfigureAiProvider]);

  useEffect(() => {
    if (!canConfigureMailProvider) {
      setLoadingMailSettings(false);
      return;
    }

    const loadMailSettings = async () => {
      try {
        const payload = await fetchJson<{ settings: MailProviderSettings }>("/api/settings/mail-provider");
        setMailSettings(payload.settings);
      } catch (error) {
        setMailError(error instanceof Error ? error.message : "Impossibile leggere le impostazioni email.");
      } finally {
        setLoadingMailSettings(false);
      }
    };

    void loadMailSettings();
  }, [canConfigureMailProvider]);

  const modelOptions = useMemo(() => {
    const ids = new Set<string>();
    const optionsFromModels = models
      .map((model) => model.id)
      .filter((id) => id.trim().length > 0)
      .map((id) => {
        ids.add(id);
        return { value: id, label: id };
      });

    if (aiSettings.chatModel && !ids.has(aiSettings.chatModel)) {
      return [{ value: aiSettings.chatModel, label: aiSettings.chatModel }, ...optionsFromModels];
    }

    return optionsFromModels;
  }, [aiSettings.chatModel, models]);

  const buildAiProviderPayload = () => ({
    baseUrl: aiSettings.baseUrl,
    chatModel: aiSettings.chatModel,
    temperature: Number(aiSettings.temperature),
    timeoutMs: Number(aiSettings.timeoutMs),
  });

  const buildMailProviderPayload = () => ({
    provider: mailSettings.provider,
    from: mailSettings.from,
    smtpHost: mailSettings.smtpHost,
    smtpPort: Number(mailSettings.smtpPort),
    smtpSecure: Boolean(mailSettings.smtpSecure),
    smtpUser: mailSettings.smtpUser,
    ...(mailSecretPatch.smtpPass.trim() ? { smtpPass: mailSecretPatch.smtpPass } : {}),
    ...(mailSecretPatch.resendApiKey.trim() ? { resendApiKey: mailSecretPatch.resendApiKey } : {}),
  });

  const handleLoadModels = async () => {
    setLoadingModels(true);
    setAiError(null);
    setAiStatus(null);
    try {
      const payload = await fetchJson<{ models: AiModelItem[] }>("/api/settings/ai-provider/models", {
        method: "POST",
        body: JSON.stringify(buildAiProviderPayload()),
      });
      setModels(payload.models);
      if (payload.models.length === 1) {
        const onlyModel = payload.models[0]?.id ?? "";
        setAiSettings((prev) => ({ ...prev, chatModel: onlyModel }));
        setAiStatus(`Modello caricato: ${onlyModel}`);
      } else {
        setAiStatus(payload.models.length > 0 ? `Trovati ${payload.models.length} modelli.` : "Provider raggiunto, nessun modello elencato.");
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Discovery modelli fallita.");
    } finally {
      setLoadingModels(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setAiError(null);
    setAiStatus(null);
    try {
      const payload = await fetchJson<{ ok: boolean; model: string | null; error: string | null }>("/api/settings/ai-provider/validate", {
        method: "POST",
        body: JSON.stringify(buildAiProviderPayload()),
      });
      if (!payload.ok) {
        throw new Error(payload.error ?? "Connessione AI non valida.");
      }
      setAiStatus(`Connessione valida. Modello: ${payload.model ?? aiSettings.chatModel}`);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Validazione fallita.");
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setAiError(null);
    setAiStatus(null);
    try {
      const payload = await fetchJson<{ settings: AiProviderSettings }>("/api/settings/ai-provider", {
        method: "PATCH",
        body: JSON.stringify(buildAiProviderPayload()),
      });
      setAiSettings(payload.settings);
      setAiStatus("Configurazione AI salvata.");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Salvataggio fallito.");
    } finally {
      setSaving(false);
    }
  };

  const handleValidateMail = async () => {
    setValidatingMail(true);
    setMailError(null);
    setMailStatus(null);
    try {
      const payload = await fetchJson<{ ok: boolean; error: string | null }>("/api/settings/mail-provider/validate", {
        method: "POST",
        body: JSON.stringify(buildMailProviderPayload()),
      });
      if (!payload.ok) {
        throw new Error(payload.error ?? "Configurazione email non valida.");
      }
      setMailStatus("Configurazione email valida.");
    } catch (error) {
      setMailError(error instanceof Error ? error.message : "Validazione email fallita.");
    } finally {
      setValidatingMail(false);
    }
  };

  const handleSaveMail = async () => {
    setSavingMail(true);
    setMailError(null);
    setMailStatus(null);
    try {
      const payload = await fetchJson<{ settings: MailProviderSettings }>("/api/settings/mail-provider", {
        method: "PATCH",
        body: JSON.stringify(buildMailProviderPayload()),
      });
      setMailSettings(payload.settings);
      setMailSecretPatch({ smtpPass: "", resendApiKey: "" });
      setMailStatus("Configurazione email salvata.");
    } catch (error) {
      setMailError(error instanceof Error ? error.message : "Salvataggio email fallito.");
    } finally {
      setSavingMail(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            Impostazioni
          </Text>
          <PageHelpHint text="Modifica le preferenze visive dell'app." />
        </div>
        <Text variant="muted">Personalizza le tue preferenze</Text>
      </div>

      <Card className="space-y-4 p-4 lg:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-bold text-text-primary" htmlFor="theme-selector">
            <Palette size={16} className="text-brand-primary" />
            Palette colore
          </label>
          <SelectDropdown
            id="theme-selector"
            className="w-full sm:w-72"
            value={theme}
            onChange={(value) => setTheme(value as ThemeId)}
            options={options.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-bg-muted px-3 py-2">
          <span className="text-xs font-bold text-text-secondary">{selectedTheme.label}</span>
          <span className="text-xs text-text-muted">{selectedTheme.description}</span>
          <div className="ml-auto flex items-center gap-2">
            {selectedTheme.swatches.map((swatch) => (
              <span
                key={`${selectedTheme.id}-${swatch}`}
                className="h-4 w-4 rounded-full border border-border-default"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      </Card>

      {canConfigureAiProvider ? (
      <Card className="space-y-5 p-4 lg:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2">
                AI provider
              </Text>
            </div>
            <Text variant="muted">
              Provider OpenAI-compatible usato da workflow, orchestrazione e LangChain.
            </Text>
          </div>
          <span className="rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-2 py-1 text-xs font-bold text-text-secondary">
            {aiSettings.source === "database" ? "database" : ".env"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="ai-provider-base-url">Base URL</Label>
            <Input
              id="ai-provider-base-url"
              name="ai-provider-base-url"
              value={aiSettings.baseUrl}
              disabled={loadingSettings}
              placeholder="http://192.168.1.50:8000/v1"
              onChange={(event) => setAiSettings((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="ai-provider-chat-model">VLLM model</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SelectDropdown
                id="ai-provider-chat-model"
                className="min-w-0 flex-1"
                value={aiSettings.chatModel}
                placeholder="Seleziona modello"
                options={modelOptions.length > 0 ? modelOptions : [{ value: aiSettings.chatModel, label: aiSettings.chatModel || "birgus-vl" }]}
                onChange={(value) => setAiSettings((prev) => ({ ...prev, chatModel: value }))}
              />
              <Button className="shrink-0" variant="outline" onClick={handleLoadModels} disabled={loadingSettings || loadingModels}>
                {loadingModels ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Load models
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-provider-timeout-ms">Timeout ms</Label>
            <Input
              id="ai-provider-timeout-ms"
              name="ai-provider-timeout-ms"
              type="number"
              min={1000}
              max={900000}
              value={aiSettings.timeoutMs}
              disabled={loadingSettings}
              onChange={(event) => setAiSettings((prev) => ({ ...prev, timeoutMs: Number(event.target.value) }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-provider-temperature">Temperature</Label>
            <Input
              id="ai-provider-temperature"
              name="ai-provider-temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={aiSettings.temperature}
              disabled={loadingSettings}
              onChange={(event) => setAiSettings((prev) => ({ ...prev, temperature: Number(event.target.value) }))}
            />
          </div>
        </div>

        {aiStatus ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-status-success-border bg-status-success-bg px-3 py-2 text-sm font-semibold text-status-success-text">
            <CheckCircle2 size={16} />
            {aiStatus}
          </div>
        ) : null}
        {aiError ? (
          <div className="rounded-[var(--radius-md)] border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm font-semibold text-status-danger-text">
            {aiError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleValidate} disabled={loadingSettings || validating}>
            {validating ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            Valida
          </Button>
          <Button onClick={handleSave} disabled={loadingSettings || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salva
          </Button>
        </div>
      </Card>
      ) : null}

      {canConfigureMailProvider ? (
      <Card className="space-y-5 p-4 lg:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2">
                Email provider
              </Text>
            </div>
            <Text variant="muted">Provider usato dai workflow per inviare email e allegati.</Text>
          </div>
          <span className="rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-2 py-1 text-xs font-bold text-text-secondary">
            {mailSettings.source === "database" ? "database" : ".env"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mail-provider-kind">Provider</Label>
            <SelectDropdown
              id="mail-provider-kind"
              value={mailSettings.provider}
              disabled={loadingMailSettings}
              options={[
                { value: "smtp", label: "SMTP" },
                { value: "resend", label: "Resend API" },
              ]}
              onChange={(value) => setMailSettings((prev) => ({ ...prev, provider: value as MailProviderSettings["provider"] }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mail-provider-from">From</Label>
            <Input
              id="mail-provider-from"
              name="mail-provider-from"
              value={mailSettings.from}
              disabled={loadingMailSettings}
              placeholder="support@azienda.it"
              onChange={(event) => setMailSettings((prev) => ({ ...prev, from: event.target.value }))}
            />
          </div>

          {mailSettings.provider === "smtp" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="mail-provider-smtp-host">SMTP host</Label>
                <Input
                  id="mail-provider-smtp-host"
                  name="mail-provider-smtp-host"
                  value={mailSettings.smtpHost}
                  disabled={loadingMailSettings}
                  placeholder="smtp.azienda.it"
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpHost: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mail-provider-smtp-port">SMTP port</Label>
                <Input
                  id="mail-provider-smtp-port"
                  name="mail-provider-smtp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={mailSettings.smtpPort}
                  disabled={loadingMailSettings}
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpPort: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mail-provider-smtp-user">SMTP user</Label>
                <Input
                  id="mail-provider-smtp-user"
                  name="mail-provider-smtp-user"
                  value={mailSettings.smtpUser}
                  disabled={loadingMailSettings}
                  placeholder="utente"
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpUser: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mail-provider-smtp-pass">SMTP password</Label>
                <Input
                  id="mail-provider-smtp-pass"
                  name="mail-provider-smtp-pass"
                  type="password"
                  value={mailSecretPatch.smtpPass}
                  disabled={loadingMailSettings}
                  placeholder={mailSettings.smtpConfigured ? "Lascia vuoto per non cambiare" : "Password"}
                  onChange={(event) => setMailSecretPatch((prev) => ({ ...prev, smtpPass: event.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                <input
                  id="mail-provider-smtp-secure"
                  name="mail-provider-smtp-secure"
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                  checked={mailSettings.smtpSecure}
                  disabled={loadingMailSettings}
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpSecure: event.target.checked }))}
                />
                SMTP SSL diretto
              </label>
            </>
          ) : (
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="mail-provider-resend-api-key">Resend API key</Label>
              <Input
                id="mail-provider-resend-api-key"
                name="mail-provider-resend-api-key"
                type="password"
                value={mailSecretPatch.resendApiKey}
                disabled={loadingMailSettings}
                placeholder={mailSettings.resendConfigured ? "Lascia vuoto per non cambiare" : "re_..."}
                onChange={(event) => setMailSecretPatch((prev) => ({ ...prev, resendApiKey: event.target.value }))}
              />
            </div>
          )}
        </div>

        {mailStatus ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-status-success-border bg-status-success-bg px-3 py-2 text-sm font-semibold text-status-success-text">
            <CheckCircle2 size={16} />
            {mailStatus}
          </div>
        ) : null}
        {mailError ? (
          <div className="rounded-[var(--radius-md)] border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm font-semibold text-status-danger-text">
            {mailError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleValidateMail} disabled={loadingMailSettings || validatingMail}>
            {validatingMail ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            Valida
          </Button>
          <Button onClick={handleSaveMail} disabled={loadingMailSettings || savingMail}>
            {savingMail ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salva
          </Button>
        </div>
      </Card>
      ) : null}
    </div>
  );
}
