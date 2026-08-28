"use client";

import { Bot, CheckCircle2, Cpu, FileSearch, Loader2, Mail, PlugZap, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Checkbox, Input, Label, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { aiProviderErrorMessage } from "@/lib/language";
import { cn } from "@/lib/cn";
import { useModuleAccess } from "@/lib/module-access";

interface AiProviderSettings {
  availableProviders: Array<{ id: string; label: string; protocol: string }>;
  baseUrl: string;
  chatModel: string;
  provider: string;
  source: "database" | "environment";
  temperature: number;
  timeoutMs: number;
  maxOutputTokens: number;
  topP: number;
  topK: number;
  minP: number;
  repetitionPenalty: number;
  seed: number | null;
  contextTokenLimit: number | null;
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
  maxOutputTokens: 512,
  topP: 1,
  topK: -1,
  minP: 0,
  repetitionPenalty: 1,
  seed: null,
  contextTokenLimit: null,
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
    shared?: boolean;
  } | null;
}

interface OcrRuntimeStatus {
  containerRunning: boolean;
  state: "stopped" | "idle" | "starting" | "ready" | "failed";
  modelLoaded: boolean;
  error: string | null;
}

interface VllmRuntimeStatus {
  configuredMaxModelLen: number | null;
  containerRunning: boolean;
  targetContainer: string;
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
  const { hasModule } = useModuleAccess();
  const canConfigureAiProvider = hasModule("conversational_assistant");
  const canConfigureMailProvider = hasModule("notification_center");
  const canControlAiRuntime = hasModule("ai_runtime_control");
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
  const [testingOcrModule, setTestingOcrModule] = useState(false);
  const [ocrModuleError, setOcrModuleError] = useState<string | null>(null);
  const [ocrModuleStatus, setOcrModuleStatus] = useState<string | null>(null);
  const [vllmRuntime, setVllmRuntime] = useState<VllmRuntimeStatus | null>(null);
  const [vllmMaxModelLen, setVllmMaxModelLen] = useState<number>(8192);
  const [loadingVllmRuntime, setLoadingVllmRuntime] = useState(false);
  const [savingVllmRuntime, setSavingVllmRuntime] = useState(false);
  const [vllmRuntimeError, setVllmRuntimeError] = useState<string | null>(null);

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
    if (!canControlAiRuntime) {
      setVllmRuntime(null);
      return;
    }

    let active = true;
    setLoadingVllmRuntime(true);
    setVllmRuntimeError(null);
    void fetchJson<{ runtime: VllmRuntimeStatus }>("/api/settings/vllm-runtime")
      .then((payload) => {
        if (!active) return;
        setVllmRuntime(payload.runtime);
        if (payload.runtime.configuredMaxModelLen) {
          setVllmMaxModelLen(payload.runtime.configuredMaxModelLen);
        }
      })
      .catch((error) => {
        if (active) setVllmRuntimeError(error instanceof Error ? error.message : t("settings.vllm.loadFailed"));
      })
      .finally(() => {
        if (active) setLoadingVllmRuntime(false);
      });
    return () => {
      active = false;
    };
  }, [canControlAiRuntime]);

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
    maxOutputTokens: Number(aiSettings.maxOutputTokens),
    topP: Number(aiSettings.topP),
    topK: Number(aiSettings.topK),
    minP: Number(aiSettings.minP),
    repetitionPenalty: Number(aiSettings.repetitionPenalty),
    seed: aiSettings.seed === null ? null : Number(aiSettings.seed),
    contextTokenLimit: aiSettings.contextTokenLimit === null ? null : Number(aiSettings.contextTokenLimit),
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
        } else if (response.ocrRuntime.shared) {
          setOcrModuleStatus(t("settings.ocr.sharedRunning"));
        } else {
          setOcrModuleStatus(response.ocrRuntime.running
            ? t("settings.ocr.stopFailed")
            : t("settings.ocr.containerStopped"));
        }
      } else if (enabled) {
        setOcrModuleStatus(t("settings.ocr.started"));
      }
      router.refresh();
    } catch (error) {
      setOcrModuleError(error instanceof Error ? error.message : "Impossibile aggiornare il modulo OCR.");
    } finally {
      setSavingOcrModule(false);
    }
  };

  const handleUpdateVllmMaxModelLen = async () => {
    setSavingVllmRuntime(true);
    setVllmRuntimeError(null);
    try {
      const payload = await fetchJson<{ runtime: VllmRuntimeStatus }>("/api/settings/vllm-runtime/max-model-len", {
        method: "POST",
        body: JSON.stringify({ maxModelLen: Number(vllmMaxModelLen) }),
      });
      setVllmRuntime(payload.runtime);
      setVllmMaxModelLen(payload.runtime.configuredMaxModelLen ?? vllmMaxModelLen);
      toast.success(t("settings.vllm.updated"));
    } catch (error) {
      setVllmRuntimeError(error instanceof Error ? error.message : t("settings.vllm.loadFailed"));
    } finally {
      setSavingVllmRuntime(false);
    }
  };

  const handleTestOcrModule = async () => {
    if (!ocrModuleEnabled || testingOcrModule) {
      if (!ocrModuleEnabled) {
        setOcrModuleError(t("settings.ocr.testDisabled"));
      }
      return;
    }

    setTestingOcrModule(true);
    setOcrModuleError(null);
    setOcrModuleStatus(null);
    try {
      const runtime = await fetchJson<OcrRuntimeStatus>("/api/modules/ddt_processing/runtime");
      if (runtime.state === "ready") {
        setOcrModuleStatus(t("settings.ocr.ready"));
      } else if (runtime.state === "failed") {
        setOcrModuleError(runtime.error ? `${t("settings.ocr.readyFailed")} ${runtime.error}` : t("settings.ocr.readyFailed"));
      } else {
        setOcrModuleStatus(t("settings.ocr.notReady"));
      }
    } catch (error) {
      setOcrModuleError(error instanceof Error ? error.message : t("settings.ocr.readyFailed"));
    } finally {
      setTestingOcrModule(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            {t("settings.title")}
          </Text>
          <PageHelpHint text={t("settings.help")} />
        </div>
        <Text variant="caption">{t("settings.subtitle")}</Text>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,0.62fr)_minmax(360px,1fr)_minmax(420px,1.1fr)]">
      {!loadingOcrModule && ocrModuleEnabled !== null ? (
        <Card className="self-start space-y-3 p-3 md:col-span-1 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileSearch size={18} className="text-brand-primary" />
                <Text as="h2" variant="h2" className="text-base">{t("settings.ocr.title")}</Text>
              </div>
              <Text variant="caption" className="mt-1 block">{t("settings.ocr.description")}</Text>
            </div>
            <button
              id="ocr-module-enabled"
              name="ocr-module-enabled"
              type="button"
              role="switch"
              aria-checked={ocrModuleEnabled}
              aria-label={t("settings.ocr.toggle")}
              title={t("settings.ocr.toggle")}
              disabled={savingOcrModule}
              onClick={() => void handleToggleOcrModule()}
              className="group inline-flex h-9 items-center rounded-md border border-border-default bg-bg-page px-2 text-xs font-semibold text-text-secondary transition-colors hover:border-brand-primary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative inline-flex h-6 w-[3.25rem] items-center rounded-full border p-0.5 shadow-inner transition-colors",
                  ocrModuleEnabled ? "border-brand-primary bg-brand-primary" : "border-border-default bg-bg-surface",
                )}
              >
                <span className={cn("absolute text-[9px] font-bold leading-none transition-opacity", ocrModuleEnabled ? "left-2 text-text-inverse" : "right-1.5 text-text-muted")}>
                  {ocrModuleEnabled ? "ON" : "OFF"}
                </span>
                <span className={cn("relative z-10 h-5 w-5 rounded-full border border-black/10 bg-white shadow-sm transition-transform", ocrModuleEnabled ? "translate-x-6" : "translate-x-0")} />
              </span>
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className={cn("h-2 w-2 rounded-full", ocrModuleEnabled ? "bg-status-success-text" : "bg-text-muted")} aria-hidden="true" />
              <span>{t("settings.ocr.switchHint")}</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleTestOcrModule()} disabled={!ocrModuleEnabled || savingOcrModule || testingOcrModule}>
              {testingOcrModule ? t("settings.ocr.testing") : t("settings.ocr.test")}
            </Button>
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

      {canConfigureAiProvider ? (
      <Card className="self-start space-y-3 p-3 md:col-span-1 xl:col-span-1 [&_input]:h-9">
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

        <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="space-y-1 sm:col-span-2">
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

          <div className="space-y-1 sm:col-span-2">
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

        <details className="border-t border-border-subtle pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-brand-primary marker:hidden">
            <span>{t("settings.ai.generation")}</span>
            <span className="text-[11px] font-normal text-text-muted">{t("settings.ai.generationHint")}</span>
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-max-output-tokens">{t("settings.ai.maxOutputTokens")}</Label>
              <Input id="ai-provider-max-output-tokens" name="ai-provider-max-output-tokens" type="number" min={1} max={8192} value={aiSettings.maxOutputTokens} disabled={loadingSettings} className="h-9 px-3" onChange={(event) => setAiSettings((prev) => ({ ...prev, maxOutputTokens: Number(event.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-context-token-limit">{t("settings.ai.contextTokenLimit")}</Label>
              <Input id="ai-provider-context-token-limit" name="ai-provider-context-token-limit" type="number" min={256} max={8192} value={aiSettings.contextTokenLimit ?? ""} disabled={loadingSettings} className="h-9 px-3" placeholder="8192" onChange={(event) => setAiSettings((prev) => ({ ...prev, contextTokenLimit: event.target.value === "" ? null : Number(event.target.value) }))} />
              <Text variant="caption">{t("settings.ai.contextTokenLimitHint")}</Text>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-top-p">{t("settings.ai.topP")}</Label>
              <Input id="ai-provider-top-p" name="ai-provider-top-p" type="number" min={0} max={1} step={0.01} value={aiSettings.topP} disabled={loadingSettings} className="h-9 px-3" onChange={(event) => setAiSettings((prev) => ({ ...prev, topP: Number(event.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-top-k">{t("settings.ai.topK")}</Label>
              <Input id="ai-provider-top-k" name="ai-provider-top-k" type="number" min={-1} max={1000} step={1} value={aiSettings.topK} disabled={loadingSettings} className="h-9 px-3" onChange={(event) => setAiSettings((prev) => ({ ...prev, topK: Number(event.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-min-p">{t("settings.ai.minP")}</Label>
              <Input id="ai-provider-min-p" name="ai-provider-min-p" type="number" min={0} max={1} step={0.01} value={aiSettings.minP} disabled={loadingSettings} className="h-9 px-3" onChange={(event) => setAiSettings((prev) => ({ ...prev, minP: Number(event.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-repetition-penalty">{t("settings.ai.repetitionPenalty")}</Label>
              <Input id="ai-provider-repetition-penalty" name="ai-provider-repetition-penalty" type="number" min={0.1} max={2} step={0.01} value={aiSettings.repetitionPenalty} disabled={loadingSettings} className="h-9 px-3" onChange={(event) => setAiSettings((prev) => ({ ...prev, repetitionPenalty: Number(event.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="ai-provider-seed">{t("settings.ai.seed")}</Label>
              <Input id="ai-provider-seed" name="ai-provider-seed" type="number" min={0} max={2147483647} step={1} value={aiSettings.seed ?? ""} disabled={loadingSettings} className="h-9 px-3" placeholder={t("settings.ai.seedHint")} onChange={(event) => setAiSettings((prev) => ({ ...prev, seed: event.target.value === "" ? null : Number(event.target.value) }))} />
            </div>
          </div>
        </details>

        {canControlAiRuntime ? (
          <section className="space-y-2 border-t border-border-subtle pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Cpu size={16} className="shrink-0 text-brand-primary" />
                <div>
                  <Text as="h3" variant="body" className="font-semibold">{t("settings.vllm.runtime")}</Text>
                  <Text variant="caption">{t("settings.vllm.runtimeHint")}</Text>
                </div>
              </div>
              {vllmRuntime ? (
                <span className={cn("shrink-0 text-xs font-semibold", vllmRuntime.containerRunning ? "text-status-success-text" : "text-text-muted")}>
                  {vllmRuntime.containerRunning ? t("settings.vllm.containerRunning") : t("settings.vllm.containerStopped")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full space-y-1 sm:w-48">
                <Label className="text-xs" htmlFor="vllm-max-model-len">{t("settings.vllm.contextWindow")}</Label>
                <Input
                  id="vllm-max-model-len"
                  name="vllm-max-model-len"
                  type="number"
                  min={1024}
                  max={32768}
                  step={256}
                  value={vllmMaxModelLen}
                  disabled={loadingVllmRuntime || savingVllmRuntime}
                  className="h-9 px-3"
                  onChange={(event) => setVllmMaxModelLen(Number(event.target.value))}
                />
              </div>
              <Button type="button" size="sm" onClick={() => void handleUpdateVllmMaxModelLen()} disabled={loadingVllmRuntime || savingVllmRuntime}>
                {savingVllmRuntime ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {savingVllmRuntime ? t("settings.vllm.restarting") : t("settings.vllm.applyRestart")}
              </Button>
            </div>
            {vllmRuntimeError ? <Text className="text-xs font-semibold text-status-danger-text">{vllmRuntimeError}</Text> : null}
          </section>
        ) : null}

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
      <Card className="self-start space-y-3 p-3 md:col-span-2 xl:col-span-1 [&_input]:h-9">
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

        <div className="grid gap-3 sm:grid-cols-2">
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
              <Checkbox
                id="mail-provider-smtp-secure"
                name="mail-provider-smtp-secure"
                checked={mailSettings.smtpSecure}
                disabled={loadingMailSettings}
                onChange={(event) => setMailSettings((prev) => ({ ...prev, smtpSecure: event.target.checked }))}
                label="SMTP SSL diretto"
                labelClassName="font-semibold"
              />
            </>
          ) : (
            <div className="space-y-1 sm:col-span-2">
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
    </div>
  );
}
