"use client";

import { BellRing, Bot, CheckCircle2, FileSearch, Loader2, Mail, Palette, PlugZap, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Label, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { useTheme } from "@/components/organisms/theme-provider";
import { useLanguage } from "@/components/organisms/language-provider";
import { aiProviderErrorMessage } from "@/lib/language";
import {
  isToastPosition,
  TOAST_POSITION_OPTIONS,
  useToasterPreferences,
  type ToastPosition,
} from "@/components/organisms/toaster-provider";
import { useModuleAccess } from "@/lib/module-access";
import type { ThemeId } from "@/lib/themes";

interface AiProviderSettings {
  availableProviders: Array<{ id: string; label: string; protocol: string }>;
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

interface WorkspaceModuleSettings {
  moduleKey: string;
  enabled: boolean;
}

const defaultAiProviderSettings: AiProviderSettings = {
  availableProviders: [{ id: "vllm", label: "vLLM", protocol: "openai_compatible" }],
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

class ApiRequestError extends Error {
  public constructor(public readonly code: string | null, message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface OcrModuleToggleResponse {
  ocrRuntime?: {
    error: string | null;
    running: boolean;
  } | null;
}

interface OcrRuntimeStatus {
  containerRunning: boolean;
  state: "stopped" | "idle" | "starting" | "ready" | "failed";
  modelLoaded: boolean;
  error: string | null;
}

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
    const body = payload as { code?: unknown; message?: unknown };
    throw new ApiRequestError(
      typeof body.code === "string" ? body.code : null,
      String(body.message ?? "Request failed."),
    );
  }
  return payload as T;
}

export function SettingsPanel() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { options, theme, setTheme } = useTheme();
  const { position: toastPosition, setPosition: setToastPosition } = useToasterPreferences();
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
  const [ocrModuleEnabled, setOcrModuleEnabled] = useState<boolean | null>(null);
  const [loadingOcrModule, setLoadingOcrModule] = useState(true);
  const [savingOcrModule, setSavingOcrModule] = useState(false);
  const [ocrModuleError, setOcrModuleError] = useState<string | null>(null);
  const [ocrModuleStatus, setOcrModuleStatus] = useState<string | null>(null);

  const describeAiProviderError = (error: unknown) => {
    if (error instanceof ApiRequestError) {
      return aiProviderErrorMessage(language, error.code);
    }
    return t("settings.ai.providerFailed");
  };

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
        setAiError(error instanceof Error ? error.message : t("settings.ai.loadFailed"));
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

  useEffect(() => {
    let active = true;

    const loadOcrModule = async () => {
      try {
        const payload = await fetchJson<{ modules: WorkspaceModuleSettings[] }>("/api/modules/workspace-settings");
        const ocrModule = payload.modules.find((item) => item.moduleKey === "ddt_processing");
        if (active) {
          setOcrModuleEnabled(ocrModule?.enabled ?? null);
        }
      } catch {
        // The endpoint is intentionally unavailable to users without module configuration permission.
      } finally {
        if (active) {
          setLoadingOcrModule(false);
        }
      }
    };

    void loadOcrModule();
    return () => {
      active = false;
    };
  }, []);

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
    provider: aiSettings.provider,
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
        setAiStatus(t("settings.ai.modelsOne", { model: onlyModel }));
      } else {
        setAiStatus(payload.models.length > 0
          ? t("settings.ai.modelsMany", { count: payload.models.length })
          : t("settings.ai.modelsEmpty"));
      }
    } catch (error) {
      setAiError(describeAiProviderError(error));
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
        throw new ApiRequestError(payload.error, payload.error ?? "AI_PROVIDER_REQUEST_FAILED");
      }
      setAiStatus(t("settings.ai.valid", { model: payload.model ?? aiSettings.chatModel }));
    } catch (error) {
      setAiError(describeAiProviderError(error));
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
      setAiStatus(t("settings.ai.saved"));
    } catch (error) {
      setAiError(describeAiProviderError(error));
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

  const handleToggleOcrModule = async () => {
    if (ocrModuleEnabled === null) {
      return;
    }

    const enabled = !ocrModuleEnabled;
    setSavingOcrModule(true);
    setOcrModuleError(null);
    setOcrModuleStatus(null);
    try {
      const response = await fetchJson<OcrModuleToggleResponse>(`/api/modules/ddt_processing/${enabled ? "enable" : "disable"}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setOcrModuleEnabled(enabled);
      if (!enabled && response.ocrRuntime) {
        if (response.ocrRuntime.error) {
          setOcrModuleError(t("settings.ocr.stopFailed"));
        } else {
          setOcrModuleStatus(response.ocrRuntime.running
            ? t("settings.ocr.stopFailed")
            : t("settings.ocr.containerStopped"));
        }
      } else if (enabled && response.ocrRuntime?.running) {
        setOcrModuleStatus(t("settings.ocr.starting"));
        void waitForOcrReadiness();
      }
      router.refresh();
    } catch (error) {
      setOcrModuleError(error instanceof Error ? error.message : "Impossibile aggiornare il modulo OCR.");
    } finally {
      setSavingOcrModule(false);
    }
  };

  const waitForOcrReadiness = async () => {
    const notificationId = toast.loading(t("settings.ocr.starting"));

    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const runtime = await fetchJson<OcrRuntimeStatus>("/api/modules/ddt_processing/runtime");
        if (runtime.state === "ready") {
          setOcrModuleStatus(t("settings.ocr.ready"));
          toast.success(t("settings.ocr.ready"), { id: notificationId });
          return;
        }
        if (runtime.state === "failed") {
          const message = runtime.error
            ? `${t("settings.ocr.readyFailed")} ${runtime.error}`
            : t("settings.ocr.readyFailed");
          setOcrModuleError(message);
          toast.error(message, { id: notificationId });
          return;
        }
      } catch {
        // The container is still booting; the following attempt will retry.
      }

      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }

    const message = t("settings.ocr.readyTimeout");
    setOcrModuleError(message);
    toast.error(message, { id: notificationId });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            {t("settings.title")}
          </Text>
          <PageHelpHint text={t("settings.help")} />
        </div>
        <Text variant="caption">{t("settings.subtitle")}</Text>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
      <Card className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-text-primary" htmlFor="theme-selector">
            <Palette size={16} className="text-brand-primary" />
            {t("settings.palette")}
          </label>
          <SelectDropdown
            id="theme-selector"
            className="w-44"
            size="sm"
            value={theme}
            onChange={(value) => setTheme(value as ThemeId)}
            options={options.map((option) => ({ value: option.id, label: option.label }))}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="text-xs font-bold text-text-secondary">{selectedTheme.label}</span>
          <span className="text-xs text-text-muted">{selectedTheme.description}</span>
          <div className="ml-auto flex items-center gap-1">
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

      <Card className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-text-primary" htmlFor="toast-position-selector">
            <BellRing size={16} className="text-brand-primary" />
            {t("settings.notificationsPosition")}
          </label>
          <SelectDropdown
            id="toast-position-selector"
            className="w-44"
            size="sm"
            value={toastPosition}
            onChange={(value) => {
              if (isToastPosition(value)) {
                setToastPosition(value as ToastPosition);
              }
            }}
            options={TOAST_POSITION_OPTIONS}
          />
        </div>
      </Card>

      {!loadingOcrModule && ocrModuleEnabled !== null ? (
        <Card className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSearch size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2" className="text-base">{t("settings.ocr.title")}</Text>
              </div>
              <Text variant="caption">{t("settings.ocr.description")}</Text>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-text-secondary" htmlFor="ocr-module-enabled">
              <input
                id="ocr-module-enabled"
                name="ocr-module-enabled"
                type="checkbox"
                role="switch"
                className="h-4 w-4 accent-[var(--brand-primary)]"
                checked={ocrModuleEnabled}
                disabled={savingOcrModule}
                onChange={() => void handleToggleOcrModule()}
              />
              {savingOcrModule ? t("auth.updating") : ocrModuleEnabled ? t("settings.active") : t("settings.inactive")}
            </label>
          </div>
          {ocrModuleError ? (
            <div className="rounded-[var(--radius-md)] border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm font-semibold text-status-danger-text">
              {ocrModuleError}
            </div>
          ) : null}
          {ocrModuleStatus ? (
            <div className="rounded-[var(--radius-md)] border border-status-success-border bg-status-success-bg px-3 py-2 text-sm font-semibold text-status-success-text">
              {ocrModuleStatus}
            </div>
          ) : null}
        </Card>
      ) : null}
      </div>

      {canConfigureAiProvider ? (
      <Card className="space-y-3 p-3 lg:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2" className="text-base">
                {t("settings.ai.title")}
              </Text>
            </div>
            <Text variant="caption">
              {t("settings.ai.description")}
            </Text>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="ai-provider-kind">Provider</Label>
            <SelectDropdown
              id="ai-provider-kind"
              value={aiSettings.provider}
              disabled={loadingSettings}
              size="sm"
              options={aiSettings.availableProviders.map((provider) => ({ value: provider.id, label: provider.label }))}
              onChange={(value) => setAiSettings((prev) => ({ ...prev, provider: value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs" htmlFor="ai-provider-base-url">Base URL</Label>
            <Input
              id="ai-provider-base-url"
              name="ai-provider-base-url"
              value={aiSettings.baseUrl}
              disabled={loadingSettings}
              className="h-9 px-3"
              placeholder="http://127.0.0.1:xxxx/v1"
              onChange={(event) => setAiSettings((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </div>

          <div className="space-y-1 md:col-span-2 xl:col-span-2">
            <Label className="text-xs" htmlFor="ai-provider-chat-model">{t("settings.ai.model")}</Label>
            <div className="flex gap-2">
              <SelectDropdown
                id="ai-provider-chat-model"
                className="min-w-0 flex-1"
                size="sm"
                value={aiSettings.chatModel}
                placeholder={t("settings.ai.selectModel")}
                options={modelOptions.length > 0 ? modelOptions : [{ value: aiSettings.chatModel, label: aiSettings.chatModel || t("settings.ai.noModels") }]}
                onChange={(value) => setAiSettings((prev) => ({ ...prev, chatModel: value }))}
              />
              <Button className="shrink-0" size="sm" variant="outline" onClick={handleLoadModels} disabled={loadingSettings || loadingModels}>
                {loadingModels ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {t("settings.ai.loadModels")}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="ai-provider-timeout-ms">Timeout ms</Label>
            <Input
              id="ai-provider-timeout-ms"
              name="ai-provider-timeout-ms"
              type="number"
              min={1000}
              max={900000}
              value={aiSettings.timeoutMs}
              disabled={loadingSettings}
              className="h-9 px-3"
              onChange={(event) => setAiSettings((prev) => ({ ...prev, timeoutMs: Number(event.target.value) }))}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="ai-provider-temperature">Temperature</Label>
            <Input
              id="ai-provider-temperature"
              name="ai-provider-temperature"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={aiSettings.temperature}
              disabled={loadingSettings}
              className="h-9 px-3"
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
          <Button size="sm" variant="outline" onClick={handleValidate} disabled={loadingSettings || validating}>
            {validating ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            {t("settings.validate")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loadingSettings || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t("settings.save")}
          </Button>
        </div>
      </Card>
      ) : null}

      {canConfigureMailProvider ? (
      <Card className="space-y-3 p-3 lg:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-brand-primary" />
              <Text as="h2" variant="h2" className="text-base">
                {t("settings.mail.title")}
              </Text>
            </div>
            <Text variant="caption">{t("settings.mail.description")}</Text>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="mail-provider-kind">Provider</Label>
            <SelectDropdown
              id="mail-provider-kind"
              value={mailSettings.provider}
              disabled={loadingMailSettings}
              size="sm"
              options={[
                { value: "smtp", label: "SMTP" },
                { value: "resend", label: "Resend API" },
              ]}
              onChange={(value) => setMailSettings((prev) => ({ ...prev, provider: value as MailProviderSettings["provider"] }))}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor="mail-provider-from">From</Label>
            <Input
              id="mail-provider-from"
              name="mail-provider-from"
              value={mailSettings.from}
              disabled={loadingMailSettings}
              className="h-9 px-3"
              placeholder="support@azienda.it"
              onChange={(event) => setMailSettings((prev) => ({ ...prev, from: event.target.value }))}
            />
          </div>

          {mailSettings.provider === "smtp" ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="mail-provider-smtp-host">SMTP host</Label>
                <Input
                  id="mail-provider-smtp-host"
                  name="mail-provider-smtp-host"
                  value={mailSettings.smtpHost}
                  disabled={loadingMailSettings}
                  className="h-9 px-3"
                  placeholder="smtp.azienda.it"
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpHost: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="mail-provider-smtp-port">SMTP port</Label>
                <Input
                  id="mail-provider-smtp-port"
                  name="mail-provider-smtp-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={mailSettings.smtpPort}
                  disabled={loadingMailSettings}
                  className="h-9 px-3"
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpPort: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="mail-provider-smtp-user">SMTP user</Label>
                <Input
                  id="mail-provider-smtp-user"
                  name="mail-provider-smtp-user"
                  value={mailSettings.smtpUser}
                  disabled={loadingMailSettings}
                  className="h-9 px-3"
                  placeholder="utente"
                  onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpUser: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="mail-provider-smtp-pass">SMTP password</Label>
                <Input
                  id="mail-provider-smtp-pass"
                  name="mail-provider-smtp-pass"
                  type="password"
                  value={mailSecretPatch.smtpPass}
                  disabled={loadingMailSettings}
                  className="h-9 px-3"
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
            <div className="space-y-1 md:col-span-2 xl:col-span-3">
              <Label className="text-xs" htmlFor="mail-provider-resend-api-key">Resend API key</Label>
              <Input
                id="mail-provider-resend-api-key"
                name="mail-provider-resend-api-key"
                type="password"
                value={mailSecretPatch.resendApiKey}
                disabled={loadingMailSettings}
                className="h-9 px-3"
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
          <Button size="sm" variant="outline" onClick={handleValidateMail} disabled={loadingMailSettings || validatingMail}>
            {validatingMail ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            Valida
          </Button>
          <Button size="sm" onClick={handleSaveMail} disabled={loadingMailSettings || savingMail}>
            {savingMail ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salva
          </Button>
        </div>
      </Card>
      ) : null}
    </div>
  );
}
