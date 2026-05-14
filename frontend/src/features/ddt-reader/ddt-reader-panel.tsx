"use client";

import { Bot, Clock3, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { PageHelpHint } from "@/components/molecules";
import { cn } from "@/lib/cn";
import { APP_ROUTES } from "@/lib/routes";
import { scheduleUndoableAction } from "@/lib/undoable-action";

import type { DdtReaderArticleItem, DdtReaderConfig, DdtReaderDocument } from "./types";

const PROCESSING_STATUSES = new Set(["queued", "ocr_processing", "ai_processing"]);

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

const requestJson = async <T,>(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackErrorMessage: string,
): Promise<T> => {
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
    case "ocr_processing":
      return "OCR in corso";
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
    case "ocr_processing":
    case "ai_processing":
      return "bg-status-warn-bg text-status-warn-text ring-1 ring-status-warn-text/20";
    default:
      return "bg-status-info-bg text-status-info-text ring-1 ring-status-info-text/20";
  }
};

const movementLabel = (value: string | null | undefined): string => {
  if (value === "entrata") {
    return "Entrata merce";
  }
  if (value === "uscita") {
    return "Uscita merce";
  }
  return "Non determinato";
};

const mainActionLabel = (value: string | null | undefined): string => {
  if (value === "aggiunta_principale") {
    return "Aggiunta al magazzino principale";
  }
  if (value === "rimozione_principale") {
    return "Rimozione dal magazzino principale";
  }
  if (value === "invariato") {
    return "Nessuna variazione magazzino principale";
  }
  return "Sconosciuto";
};

const deltaLabel = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "-";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
};

const formatArticleItems = (items: DdtReaderArticleItem[] | null | undefined): string => {
  if (!items || items.length === 0) {
    return "[]";
  }

  const clean = items.map((item) => ({
    article_type: String(item.article_type ?? "").trim(),
    quantity: Number(item.quantity ?? 0),
    unit: String(item.unit ?? "").trim() || "N/D",
  }));

  return JSON.stringify(clean, null, 2);
};

const formatDuration = (value: number | null | undefined): string => {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const durationMs = Math.max(0, Number(value));
  if (durationMs < 1000) {
    return `${durationMs.toFixed(0)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
};

const isPdfFile = (file: File): boolean => {
  const lowerName = file.name.toLowerCase();
  return file.type === "application/pdf" || lowerName.endsWith(".pdf");
};

export function DdtReaderPanel() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DdtReaderDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lmModel, setLmModel] = useState("non configurato");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");

  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string>("");

  const selectedDocument = useMemo(() => {
    if (selectedDocId === null) {
      return null;
    }

    return documents.find((document) => document.id === selectedDocId) ?? null;
  }, [documents, selectedDocId]);

  const hasProcessing = useMemo(
    () => documents.some((document) => PROCESSING_STATUSES.has(document.status)),
    [documents],
  );

  const selectedIsProcessing = useMemo(() => {
    if (!selectedDocument) {
      return false;
    }
    return PROCESSING_STATUSES.has(selectedDocument.status);
  }, [selectedDocument]);

  const canAnalyze = useMemo(() => {
    if (!selectedDocument) {
      return false;
    }

    return !hasProcessing && !isAnalyzing && !PROCESSING_STATUSES.has(selectedDocument.status);
  }, [hasProcessing, isAnalyzing, selectedDocument]);

  const recentTimings = useMemo(() => {
    return documents
      .filter(
        (document) =>
          typeof document.ocr_duration_ms === "number" || typeof document.inference_duration_ms === "number",
      )
      .sort((left, right) => {
        const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "") || 0;
        const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "") || 0;
        return rightTime - leftTime;
      })
      .slice(0, 6);
  }, [documents]);

  const redirectToLogin = useCallback(() => {
    setPdfPreviewUrl("");
    router.replace(APP_ROUTES.login);
  }, [router]);

  const handleRequestError = useCallback(
    (requestError: unknown, fallbackMessage: string): string => {
      if (requestError instanceof AuthSessionExpiredError) {
        redirectToLogin();
        return requestError.message;
      }

      if (requestError instanceof Error) {
        return requestError.message;
      }

      return fallbackMessage;
    },
    [redirectToLogin],
  );

  const refreshDocuments = useCallback(async (clearMessages = false) => {
    try {
      const docs = await requestJson<DdtReaderDocument[]>(
        "/api/ddt-reader/documents",
        { method: "GET", cache: "no-store" },
        "Impossibile leggere i documenti dal server.",
      );

      setDocuments(docs);
      setSelectedDocId((current) => {
        if (current === null) {
          return null;
        }

        return docs.some((document) => document.id === current) ? current : null;
      });

      if (clearMessages) {
        setFeedback("");
        setError("");
      }
    } catch (refreshError) {
      const message = handleRequestError(refreshError, "Impossibile leggere i documenti dal server.");
      setError(message);
    }
  }, [handleRequestError]);

  const loadConfig = useCallback(async () => {
    try {
      const config = await requestJson<DdtReaderConfig>(
        "/api/ddt-reader/config",
        { method: "GET", cache: "no-store" },
        "Impossibile leggere la configurazione del servizio DDT Reader.",
      );
      setLmModel(config.lm_model || "non configurato");
    } catch {
      setLmModel("non configurato");
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void refreshDocuments(true);

    const timerId = setInterval(() => {
      void refreshDocuments(false);
    }, 2000);

    return () => {
      clearInterval(timerId);
    };
  }, [loadConfig, refreshDocuments]);

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
        const response = await fetch(`/api/ddt-reader/documents/${selectedDocId}/file`, {
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
        previewObjectUrlRef.current = "";
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

      const document = await requestJson<DdtReaderDocument>(
        "/api/ddt-reader/documents",
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
      await requestJson<{ queued: boolean; doc_id: number; status: string }>(
        `/api/ddt-reader/documents/${selectedDocId}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
        "Errore durante l avvio dell analisi.",
      );

      setFeedback("Analisi avviata: OCR + interrogazione LM Studio in corso.");
      toast.success("Analisi avviata.");
      await refreshDocuments();
    } catch (analyzeError) {
      const message = handleRequestError(analyzeError, "Errore durante l avvio dell analisi.");
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteDocument = async (
    document: DdtReaderDocument,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    setFeedback("");
    setError("");

    if (PROCESSING_STATUSES.has(document.status)) {
      const message = "Documento in elaborazione: attendi la fine prima di archiviarlo.";
      setError(message);
      toast.error(message);
      return;
    }

    setDeletingDocId(document.id);
    const previousDocuments = documents;
    const previousSelectedDocId = selectedDocId;
    const nextDocuments = documents.filter((item) => item.id !== document.id);
    setDocuments(nextDocuments);
    if (previousSelectedDocId === document.id) {
      setSelectedDocId(null);
    }

    scheduleUndoableAction({
      pendingMessage: `Documento "${document.original_filename}" in archiviazione...`,
      successMessage: "Documento archiviato.",
      errorMessage: "Errore durante l'archiviazione del documento.",
      rollback: () => {
        setDeletingDocId(null);
        setDocuments(previousDocuments);
        setSelectedDocId(previousSelectedDocId);
      },
      commit: async () => {
        try {
          await requestJson<{ deleted: boolean; doc_id: number }>(
            `/api/ddt-reader/documents/${document.id}`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ confirmText: "cancella" }),
            },
            "Errore durante l'archiviazione del documento.",
          );
          setFeedback("Documento archiviato.");
          await refreshDocuments();
        } catch (deleteError) {
          const message = handleRequestError(deleteError, "Errore durante l'archiviazione del documento.");
          setError(message);
          throw deleteError;
        } finally {
          setDeletingDocId(null);
        }
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Text as="h1" variant="h1">
            DDT Reader
          </Text>
          <PageHelpHint text="Carica un PDF DDT, avvia l'analisi e controlla i dati estratti." />
        </div>
        <Text variant="muted">
          Analizzatore di Documenti di Trasporto
        </Text>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_320px]">
        <Card className="space-y-5 p-4 lg:p-5">
          <div className="space-y-2">
            <Text as="h2" variant="h2" className="text-lg">
              Caricamento DDT (PDF)
            </Text>
            <Text variant="caption">
              Seleziona un PDF e caricalo nel servizio di analisi.
            </Text>
          </div>

          <div className="space-y-3 rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted/60 p-3">
            <label className="text-xs font-bold uppercase tracking-wide text-text-muted" htmlFor="ddt-reader-upload">
              File PDF
            </label>
            <Input
              id="ddt-reader-upload"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={onFileChange}
              className="cursor-pointer file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-status-info-bg file:px-2 file:py-1 file:text-xs file:font-semibold file:text-status-info-text"
            />
            <Button onClick={() => void uploadDocument()} disabled={isUploading} className="w-full sm:w-auto">
              {isUploading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Caricamento...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Carica PDF
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={() => void analyzeSelectedDocument()}
              disabled={!canAnalyze}
              variant="accent"
              className="w-full sm:w-auto"
            >
              {isAnalyzing ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Avvio analisi...
                </>
              ) : (
                <>
                  <Bot size={16} />
                  Applica OCR + Analizza
                </>
              )}
            </Button>
            <Text variant="caption">Seleziona un documento cliccando il riquadro.</Text>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Text className="text-sm font-bold text-text-primary">Documenti caricati</Text>
              <span className="rounded-full border border-border-default bg-bg-muted px-2 py-0.5 text-xs font-semibold text-text-secondary">
                {documents.length}
              </span>
            </div>

            <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted p-5 text-center">
                  <Text variant="muted">Nessun PDF caricato.</Text>
                </div>
              ) : (
                documents.map((document) => {
                  const isSelected = selectedDocId === document.id;
                  const isDeleting = deletingDocId === document.id;
                  const isProcessing = PROCESSING_STATUSES.has(document.status);

                  return (
                    <div
                      key={document.id}
                      className={cn(
                        "cursor-pointer rounded-[var(--radius-lg)] border bg-bg-surface p-3 transition-all",
                        isSelected
                          ? "border-brand-primary ring-2 ring-ring-primary"
                          : "border-border-default hover:border-brand-accent/70",
                      )}
                      onClick={() => {
                        setSelectedDocId(document.id);
                        setFeedback("");
                        setError("");
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <Text className="truncate text-sm font-bold text-text-primary">
                            {document.original_filename}
                          </Text>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                              statusClasses(document.status),
                            )}
                          >
                            {isProcessing && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
                            {statusLabel(document.status)}
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          title="Archivia documento"
                          onClick={(event) => {
                            void deleteDocument(document, event);
                          }}
                          disabled={isDeleting || isProcessing}
                          className="text-text-muted hover:bg-status-danger-bg hover:text-status-danger-text"
                        >
                          {isDeleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-4 lg:p-5">
          <div className="space-y-1">
            <Text as="h2" variant="h2" className="text-lg">
              Risultato Analisi
            </Text>
            <Text variant="caption">
              Modello LM Studio: <span className="font-semibold text-text-secondary">{lmModel}</span>
            </Text>
          </div>

          {(selectedIsProcessing || hasProcessing) && (
            <div className="rounded-[var(--radius-md)] border border-status-warn-text/25 bg-status-warn-bg px-3 py-2 text-sm text-status-warn-text">
              Elaborazione in corso: OCR e analisi DDT con IA.
            </div>
          )}

          {feedback && (
            <div className="rounded-[var(--radius-md)] border border-status-success-text/25 bg-status-success-bg px-3 py-2 text-sm text-status-success-text">
              {feedback}
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-md)] border border-status-danger-text/25 bg-status-danger-bg px-3 py-2 text-sm text-status-danger-text">
              {error}
            </div>
          )}

          {selectedDocument ? (
            <div className="space-y-3 rounded-[var(--radius-lg)] border border-border-subtle bg-bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-brand-primary" />
                <Text className="text-sm font-bold text-text-primary">{selectedDocument.original_filename}</Text>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Text className="text-sm font-bold text-text-primary">Anteprima PDF</Text>
                  <a
                    href={`/api/ddt-reader/documents/${selectedDocument.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand-accent transition-colors hover:text-brand-accent-hover"
                  >
                    Apri in nuova scheda
                  </a>
                </div>
                <div className="h-[380px] overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-bg-surface">
                  {pdfPreviewUrl ? (
                    <iframe
                      key={selectedDocument.id}
                      title={`Anteprima PDF ${selectedDocument.original_filename}`}
                      src={pdfPreviewUrl}
                      className="h-full w-full"
                    />
                  ) : null}
                </div>
              </div>

              <div className="text-sm text-text-secondary">
                {selectedDocument.status === "ready" ? (
                  <div className="space-y-3">
                    <div className="rounded-[var(--radius-md)] border border-brand-primary/35 bg-brand-primary/10 px-3 py-2">
                      <Text className="text-[11px] font-bold uppercase tracking-wide text-brand-primary">Commessa</Text>
                      <Text className="text-sm font-extrabold text-text-primary">
                        {selectedDocument.commessa_reference || "-"}
                      </Text>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-3 py-1.5">
                        <span className="text-xs font-semibold text-text-muted">Tipo DDT</span>
                        <span className="text-xs font-bold text-text-primary">
                          {movementLabel(selectedDocument.movement_type)}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-3 py-1.5">
                        <span className="text-xs font-semibold text-text-muted">Azione</span>
                        <span className="text-xs font-bold text-text-primary">
                          {mainActionLabel(selectedDocument.main_warehouse_action)}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-3 py-1.5">
                        <span className="text-xs font-semibold text-text-muted">Numero bolla/DDT</span>
                        <span className="text-xs font-bold text-text-primary">{selectedDocument.bolla_number || "-"}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-3 py-1.5">
                        <span className="text-xs font-semibold text-text-muted">Nota movimento</span>
                        <span className="text-xs font-bold text-text-primary">{selectedDocument.transfer_note || "-"}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-3 py-1.5">
                        <span className="text-xs font-semibold text-text-muted">Articoli movimentati</span>
                        <span className="text-xs font-bold text-text-primary">{selectedDocument.article_count ?? "-"}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-surface px-3 py-1.5">
                        <span className="text-xs font-semibold text-text-muted">Impatto magazzino</span>
                        <span className="text-xs font-bold text-text-primary">
                          {deltaLabel(selectedDocument.warehouse_delta)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-3 py-2">
                      <Text className="text-xs font-bold uppercase tracking-wide text-text-muted">Sintesi</Text>
                      <Text className="mt-1 text-sm text-text-primary">{selectedDocument.analysis_summary || "-"}</Text>
                    </div>

                    <div className="space-y-1">
                      <Text className="text-sm font-bold text-text-primary">Dettaglio articoli (JSON)</Text>
                      <pre className="max-h-56 overflow-auto rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3 text-xs text-text-secondary">
                        {formatArticleItems(selectedDocument.article_items)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedDocument.status === "error" ? (
                      <p className="text-status-danger-text">
                        <strong>Errore:</strong> {selectedDocument.last_error || "Errore non specificato"}
                      </p>
                    ) : (
                      <Text variant="muted">
                        Il risultato comparirè qui quando l&apos;elaborazione sarà completata.
                      </Text>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted p-5 text-center">
              <Text variant="muted">Seleziona un PDF dalla lista a sinistra.</Text>
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-4 lg:p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock3 size={16} className="text-brand-primary" />
              <Text as="h2" variant="h2" className="text-lg">
                Tempi recenti
              </Text>
            </div>
            <Text variant="caption">
              Ultimi tempi registrati per OCR e risposta IA.
            </Text>
          </div>

          <div className="space-y-3">
            {recentTimings.length === 0 ? (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border-default bg-bg-muted p-4 text-center">
                <Text variant="muted">I tempi compariranno dopo le prime analisi completate.</Text>
              </div>
            ) : (
              recentTimings.map((document) => {
                const isSelected = selectedDocId === document.id;

                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => {
                      setSelectedDocId(document.id);
                      setFeedback("");
                      setError("");
                    }}
                    className={cn(
                      "w-full rounded-[var(--radius-lg)] border p-3 text-left transition-all",
                      isSelected
                        ? "border-brand-primary bg-brand-primary/5 ring-2 ring-ring-primary"
                        : "border-border-default bg-bg-muted/40 hover:border-brand-accent/70",
                    )}
                  >
                    <Text className="truncate text-sm font-bold text-text-primary">{document.original_filename}</Text>
                    <div className="mt-3 space-y-2 text-sm text-text-secondary">
                      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface px-3 py-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">OCR:</span>
                        <span className="text-sm font-semibold text-text-primary">
                          {formatDuration(document.ocr_duration_ms)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface px-3 py-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">Inferenza:</span>
                        <span className="text-sm font-semibold text-text-primary">
                          {formatDuration(document.inference_duration_ms)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
