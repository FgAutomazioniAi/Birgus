"use client";

import { Eye, FileSearch, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { PageHelpHint, SelectDropdown } from "@/components/molecules";
import { APP_ROUTES } from "@/lib/routes";
import { appendWorkspaceId } from "@/lib/workspace";

import type { MeasureReportConfig, MeasureReportDocument } from "./types";

const PROCESSING_STATUSES = new Set(["queued", "ai_processing"]);

type ApiErrorPayload = {
  code?: string;
  detail?: string;
  message?: string;
};

class AuthSessionExpiredError extends Error {
  public constructor(message = "Sessione non valida o scaduta.") {
    super(message);
    this.name = "AuthSessionExpiredError";
  }
}

const AUTH_ERROR_CODES = new Set([
  "AUTH_SESSION_INVALID",
  "AUTH_TOKEN_REQUIRED",
  "AUTH_BEARER_INVALID",
]);

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object") {
    const maybePayload = payload as ApiErrorPayload;
    if (typeof maybePayload.detail === "string" && maybePayload.detail.trim().length > 0) {
      return maybePayload.detail;
    }
    if (typeof maybePayload.message === "string" && maybePayload.message.trim().length > 0) {
      return maybePayload.message;
    }
  }

  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  return fallback;
};

const readPayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
};

const requestJson = async <T,>(input: RequestInfo | URL, init: RequestInit, fallbackErrorMessage: string): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await readPayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      const code =
        payload && typeof payload === "object" && "code" in payload && typeof (payload as ApiErrorPayload).code === "string"
          ? (payload as ApiErrorPayload).code ?? null
          : null;

      if (!code || AUTH_ERROR_CODES.has(code)) {
        throw new AuthSessionExpiredError(getErrorMessage(payload, "Sessione non valida o scaduta."));
      }
    }

    throw new Error(getErrorMessage(payload, fallbackErrorMessage));
  }

  return payload as T;
};

const statusLabel = (status: string): string => {
  switch (status) {
    case "uploaded":
      return "Caricato";
    case "queued":
      return "In coda";
    case "ai_processing":
      return "Analisi AI in corso";
    case "ready":
      return "Analisi pronta";
    case "error":
      return "Errore";
    default:
      return status;
  }
};

const statusClasses = (status: string): string => {
  switch (status) {
    case "ready":
      return "bg-status-success-bg text-status-success-text ring-1 ring-status-success-text/20";
    case "error":
      return "bg-status-danger-bg text-status-danger-text ring-1 ring-status-danger-text/20";
    case "queued":
    case "ai_processing":
      return "bg-status-warn-bg text-status-warn-text ring-1 ring-status-warn-text/20";
    default:
      return "bg-status-info-bg text-status-info-text ring-1 ring-status-info-text/20";
  }
};

const isPdfFile = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" || lowerName.endsWith(".pdf");
};

export function MeasureReportPanel() {
  const router = useRouter();
  const [documents, setDocuments] = useState<MeasureReportDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState("auto");
  const [config, setConfig] = useState<MeasureReportConfig | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef("");

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const selectedIsProcessing = Boolean(selectedDocument && PROCESSING_STATUSES.has(selectedDocument.status));
  const hasProcessing = documents.some((document) => PROCESSING_STATUSES.has(document.status));

  const redirectToLogin = useCallback(() => {
    setPdfPreviewUrl("");
    router.replace(APP_ROUTES.login);
  }, [router]);

  const handleRequestError = useCallback((requestError: unknown, fallbackMessage: string): string => {
    if (requestError instanceof AuthSessionExpiredError) {
      redirectToLogin();
      return requestError.message;
    }

    if (requestError instanceof Error) {
      return requestError.message;
    }

    return fallbackMessage;
  }, [redirectToLogin]);

  const refreshDocuments = useCallback(async (clearMessages = false) => {
    try {
      const docs = await requestJson<MeasureReportDocument[]>(
        "/api/measure-reports/documents",
        { method: "GET", cache: "no-store" },
        "Impossibile leggere i measure report.",
      );

      setDocuments(docs);
      setSelectedDocId((current) => (current && docs.some((document) => document.id === current) ? current : docs[0]?.id ?? null));

      if (clearMessages) {
        setFeedback("");
        setError("");
      }
    } catch (refreshError) {
      setError(handleRequestError(refreshError, "Impossibile leggere i measure report."));
    }
  }, [handleRequestError]);

  const loadConfig = useCallback(async () => {
    try {
      const nextConfig = await requestJson<MeasureReportConfig>(
        "/api/measure-reports/config",
        { method: "GET", cache: "no-store" },
        "Impossibile leggere la configurazione del modulo.",
      );
      setConfig(nextConfig);
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void refreshDocuments(true);

    const timerId = setInterval(() => {
      void refreshDocuments(false);
    }, 2500);

    return () => {
      clearInterval(timerId);
    };
  }, [loadConfig, refreshDocuments]);

  useEffect(() => {
    if (!selectedDocument) {
      setSelectedDocumentType("auto");
      return;
    }

    setSelectedDocumentType(selectedDocument.document_type_effective ?? selectedDocument.document_type_requested ?? "auto");
  }, [selectedDocument]);

  useEffect(() => {
    let cancelled = false;

    const revokePreviewUrl = () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = "";
      }
    };

    const loadPreview = async () => {
      if (!selectedDocId) {
        revokePreviewUrl();
        setPdfPreviewUrl("");
        return;
      }

      try {
        const response = await fetch(appendWorkspaceId(`/api/measure-reports/documents/${selectedDocId}/file`), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401) {
            const payload = await readPayload(response);
            const code =
              payload && typeof payload === "object" && "code" in payload && typeof (payload as ApiErrorPayload).code === "string"
                ? (payload as ApiErrorPayload).code ?? null
                : null;

            if (!code || AUTH_ERROR_CODES.has(code)) {
              if (!cancelled) {
                revokePreviewUrl();
                setPdfPreviewUrl("");
                redirectToLogin();
              }
              return;
            }
          }

          if (!cancelled) {
            revokePreviewUrl();
            setPdfPreviewUrl("");
          }
          return;
        }

        const blob = await response.blob();
        if (cancelled) {
          return;
        }

        revokePreviewUrl();
        previewObjectUrlRef.current = URL.createObjectURL(blob);
        setPdfPreviewUrl(previewObjectUrlRef.current);
      } catch {
        if (!cancelled) {
          revokePreviewUrl();
          setPdfPreviewUrl("");
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [redirectToLogin, selectedDocId]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFeedback("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isPdfFile(file)) {
      const message = "Puoi caricare solo file PDF.";
      setError(message);
      setSelectedFile(null);
      event.target.value = "";
      toast.error(message);
      return;
    }

    setError("");
    setSelectedFile(file);
  };

  const uploadDocument = async () => {
    setFeedback("");
    setError("");

    if (!selectedFile) {
      const message = "Seleziona prima un PDF.";
      setError(message);
      toast.error(message);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile, selectedFile.name);

      const document = await requestJson<MeasureReportDocument>(
        "/api/measure-reports/documents",
        { method: "POST", body: formData },
        "Errore durante il caricamento del PDF.",
      );

      setFeedback("PDF caricato con successo.");
      setSelectedFile(null);
      setSelectedDocId(document.id);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast.success("PDF caricato con successo.");
      await refreshDocuments();
    } catch (uploadError) {
      const message = handleRequestError(uploadError, "Errore durante il caricamento del PDF.");
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeSelectedDocument = async () => {
    setFeedback("");
    setError("");

    if (!selectedDocId) {
      const message = "Seleziona un documento da analizzare.";
      setError(message);
      toast.error(message);
      return;
    }

    setIsAnalyzing(true);
    try {
      await requestJson<{ queued: boolean; doc_id: string; status: string }>(
        `/api/measure-reports/documents/${selectedDocId}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_type: selectedDocumentType }),
        },
        "Errore durante l'avvio dell'analisi.",
      );

      setFeedback("Analisi avviata: estrazione righe fuori tolleranza in corso.");
      toast.success("Analisi avviata.");
      await refreshDocuments();
    } catch (analyzeError) {
      const message = handleRequestError(analyzeError, "Errore durante l'avvio dell'analisi.");
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteDocument = async (document: MeasureReportDocument) => {
    if (!window.confirm(`Eliminare "${document.original_filename}"?`)) {
      return;
    }

    setDeletingDocId(document.id);
    setFeedback("");
    setError("");

    try {
      await requestJson<{ deleted: boolean }>(
        `/api/measure-reports/documents/${document.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmText: "cancella" }),
        },
        "Errore durante l'eliminazione del documento.",
      );

      if (selectedDocId === document.id) {
        setSelectedDocId(null);
      }

      setFeedback(`Documento "${document.original_filename}" eliminato.`);
      toast.success("Documento eliminato.");
      await refreshDocuments();
    } catch (deleteError) {
      const message = handleRequestError(deleteError, "Errore durante l'eliminazione del documento.");
      setError(message);
      toast.error(message);
    } finally {
      setDeletingDocId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Text as="h1" variant="h1">Measure Report</Text>
          <Text variant="muted">
            Carica i PDF di misurazione, scegli il tipo documento e registra le righe fuori tolleranza come output strutturato.
          </Text>
        </div>
        <PageHelpHint
          text={`Modalita: ${config?.analysis_mode || "auto"}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="space-y-4 p-5">
          <div className="space-y-2">
            <Text as="h2" variant="h2">Carica PDF</Text>
            <Text variant="muted">Il modulo salva il file nel workspace e prepara il workflow backend per l'analisi.</Text>
          </div>

          <Input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={onFileChange} />
          <Button className="w-full" onClick={() => void uploadDocument()} disabled={isUploading}>
            {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Carica documento
          </Button>

          <div className="rounded-[var(--radius-lg)] border border-border-default bg-bg-muted p-3">
            <Text variant="caption">Tipo documento per l'analisi</Text>
            <SelectDropdown
              className="mt-2"
              value={selectedDocumentType}
              onChange={setSelectedDocumentType}
              options={config?.document_types ?? [{ value: "auto", label: "Auto" }]}
            />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => void analyzeSelectedDocument()}
            disabled={!selectedDocument || selectedIsProcessing || hasProcessing || isAnalyzing}
          >
            {isAnalyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
            Avvia analisi
          </Button>

          {feedback ? <Text className="rounded-[var(--radius-md)] bg-status-success-bg px-3 py-2 text-status-success-text">{feedback}</Text> : null}
          {error ? <Text className="rounded-[var(--radius-md)] bg-status-danger-bg px-3 py-2 text-status-danger-text">{error}</Text> : null}
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <Text as="h2" variant="h2">Documenti</Text>
              <Text variant="muted">{documents.length} file nel workspace corrente.</Text>
            </div>
            {selectedDocument ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(selectedDocument.status)}`}>
                {statusLabel(selectedDocument.status)}
              </span>
            ) : null}
          </div>

          <div className="space-y-3">
            {documents.length === 0 ? (
              <Text variant="muted">Ancora nessun documento caricato.</Text>
            ) : null}

            {documents.map((document) => {
              const isSelected = selectedDocId === document.id;

              return (
                <div
                  key={document.id}
                  onClick={() => setSelectedDocId(document.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDocId(document.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={[
                    "w-full rounded-[var(--radius-lg)] border p-4 text-left transition-colors",
                    isSelected
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-border-default bg-bg-surface hover:border-brand-primary/30",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Text className="truncate text-text-primary">{document.original_filename}</Text>
                      <Text variant="caption">
                        Richiesto: {document.document_type_requested} {document.document_type_effective ? `| Effettivo: ${document.document_type_effective}` : ""}
                      </Text>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={deletingDocId === document.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteDocument(document);
                      }}
                    >
                      {deletingDocId === document.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(document.status)}`}>
                      {statusLabel(document.status)}
                    </span>
                    <span className="rounded-full bg-bg-muted px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                      {document.rows_count} righe
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          {!selectedDocument ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted">
              <Text variant="muted">Seleziona un documento per vedere risultato e preview.</Text>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Text as="h2" variant="h2">{selectedDocument.original_filename}</Text>
                <Text variant="muted">
                  Prompt agente: {selectedDocument.prompt_agent_key || "non ancora usato"} | Righe fuori tolleranza: {selectedDocument.rows_count}
                </Text>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3 rounded-[var(--radius-lg)] border border-border-default bg-bg-muted p-4">
                  <Text className="text-text-primary">Output strutturato</Text>
                  <Text variant="muted">{selectedDocument.analysis_summary || "Nessuna sintesi disponibile."}</Text>
                  {selectedDocument.last_error ? (
                    <Text className="rounded-[var(--radius-md)] bg-status-danger-bg px-3 py-2 text-status-danger-text">
                      {selectedDocument.last_error}
                    </Text>
                  ) : null}

                  <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                    {selectedDocument.out_of_tolerance_rows.length === 0 ? (
                      <Text variant="muted">Nessuna riga registrata.</Text>
                    ) : null}

                    {selectedDocument.out_of_tolerance_rows.map((row) => (
                      <div key={`${selectedDocument.id}-${row.row_index}`} className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3">
                        <Text className="text-text-primary">{row.row_text}</Text>
                        {row.note ? <Text variant="caption">Nota: {row.note}</Text> : null}
                        {row.page_hint ? <Text variant="caption">Pagina: {row.page_hint}</Text> : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-[var(--radius-lg)] border border-border-default bg-bg-muted p-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-text-muted" />
                    <Text className="text-text-primary">Preview PDF</Text>
                  </div>

                  {pdfPreviewUrl ? (
                    <iframe
                      title={`Preview ${selectedDocument.original_filename}`}
                      src={pdfPreviewUrl}
                      className="h-[460px] w-full rounded-[var(--radius-md)] border border-border-default bg-white"
                    />
                  ) : (
                    <div className="flex h-[460px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-default bg-bg-surface">
                      <Text variant="muted">Preview non disponibile.</Text>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
