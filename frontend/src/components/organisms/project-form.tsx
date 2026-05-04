"use client";

import { ArrowLeft, Briefcase, CheckCircle2, Eye, FileCheck, FileSpreadsheet, FileText, Loader2, PlusCircle, RefreshCw, Save, Sparkles, Trash2, Upload, Users, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { FormField, PageHelpHint } from "@/components/molecules";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-status";
import { APP_ROUTES } from "@/lib/routes";
import type { ProjectStatus } from "@/lib/types";

interface ProjectFormValues {
  clientId: string;
  enableAi: boolean;
  projectName: string;
  status: ProjectStatus;
}

interface ClientApiItem {
  id: string;
  name: string;
}

interface ProjectApiDetail {
  clientId: string | null;
  projectName: string;
  status: ProjectStatus;
}

interface QuotationApiDetail {
  fileName?: string;
  found: boolean;
  previewUrl?: string;
}

interface GenericProjectFileDetail {
  fileName?: string;
  found: boolean;
  previewUrl?: string;
}

interface ProjectVersionOption {
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
  description: string;
  isDefault: boolean;
  status: ProjectStatus;
  versionLabel: string;
}

interface ProjectVersionsApiResponse {
  selectedVersionLabel?: string;
  versions: ProjectVersionOption[];
}

interface OrchestratorJobState {
  error?: string | null;
  message?: string;
  progress?: number;
  status?: "queued" | "running" | "completed" | "failed";
  step?: string;
}

type LocalPdfKey = "emailPdf" | "techPdf";
const LOCAL_PDF_KIND_MAP: Record<LocalPdfKey, string> = {
  emailPdf: "email-pdf",
  techPdf: "tech-pdf",
};

const buildVersionQuery = (versionLabel: string) => `version=${encodeURIComponent(versionLabel)}`;
const withVersion = (url: string, versionLabel: string) =>
  `${url}${url.includes("?") ? "&" : "?"}${buildVersionQuery(versionLabel)}`;

export interface ProjectFormProps {
  id?: string;
}

export function ProjectForm({ id }: ProjectFormProps) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [clientOptions, setClientOptions] = useState<ClientApiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingQuotation, setIsUploadingQuotation] = useState(false);
  const [isDeletingQuotation, setIsDeletingQuotation] = useState(false);
  const [quotationFileName, setQuotationFileName] = useState<string | null>(null);
  const [quotationPreviewUrl, setQuotationPreviewUrl] = useState<string | null>(null);
  const [showQuotationPopup, setShowQuotationPopup] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<"queued" | "running" | "completed" | "failed">("queued");
  const [jobMessage, setJobMessage] = useState("In coda");
  const [showProgressWidget, setShowProgressWidget] = useState(false);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [localPdfNames, setLocalPdfNames] = useState<Record<LocalPdfKey, string | null>>({
    emailPdf: null,
    techPdf: null,
  });
  const [localPdfPreviewUrls, setLocalPdfPreviewUrls] = useState<Record<LocalPdfKey, string | null>>({
    emailPdf: null,
    techPdf: null,
  });
  const [quotationDocxName, setQuotationDocxName] = useState<string | null>(null);
  const [quotationDocxPreviewUrl, setQuotationDocxPreviewUrl] = useState<string | null>(null);
  const [quotationXlsxName, setQuotationXlsxName] = useState<string | null>(null);
  const [quotationXlsxPreviewUrl, setQuotationXlsxPreviewUrl] = useState<string | null>(null);
  const [isUploadingQuotationXlsx, setIsUploadingQuotationXlsx] = useState(false);
  const [isDeletingQuotationXlsx, setIsDeletingQuotationXlsx] = useState(false);
  const [projectVersions, setProjectVersions] = useState<ProjectVersionOption[]>([]);
  const [selectedVersionLabel, setSelectedVersionLabel] = useState("v1");
  const [isSwitchingVersion, setIsSwitchingVersion] = useState(false);
  const [showNewVersionForm, setShowNewVersionForm] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [newVersionDescription, setNewVersionDescription] = useState("");
  const [newVersionClientId, setNewVersionClientId] = useState("");
  const [newVersionStatus, setNewVersionStatus] = useState<ProjectStatus>(PROJECT_STATUS_OPTIONS[0].key);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [activeJobVersionLabel, setActiveJobVersionLabel] = useState<string | null>(null);
  const progressPollRef = useRef<number | null>(null);
  const finalStatusNotifiedRef = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    defaultValues: {
      clientId: "",
      projectName: "",
      enableAi: false,
      status: PROJECT_STATUS_OPTIONS[0].key,
    },
  });
  const selectedProjectClientId = watch("clientId");

  const getVersionDisplayLabel = (version: ProjectVersionOption) =>
    `${version.description} (${version.versionLabel.toUpperCase()})`;

  const resetVersionedFiles = useCallback(() => {
    setQuotationFileName(null);
    setQuotationPreviewUrl(null);
    setLocalPdfNames({
      emailPdf: null,
      techPdf: null,
    });
    setLocalPdfPreviewUrls({
      emailPdf: null,
      techPdf: null,
    });
    setQuotationDocxName(null);
    setQuotationDocxPreviewUrl(null);
    setQuotationXlsxName(null);
    setQuotationXlsxPreviewUrl(null);
  }, []);

  const loadVersionedProjectFiles = useCallback(async (projectId: string, versionLabel: string) => {
    resetVersionedFiles();

    const [quotationResponse, emailResponse, techResponse, docxResponse, xlsxResponse] = await Promise.all([
      fetch(withVersion(`/api/projects/${projectId}/quotation`, versionLabel), { cache: "no-store" }),
      fetch(withVersion(`/api/projects/${projectId}/files/email-pdf`, versionLabel), { cache: "no-store" }),
      fetch(withVersion(`/api/projects/${projectId}/files/tech-pdf`, versionLabel), { cache: "no-store" }),
      fetch(withVersion(`/api/projects/${projectId}/files/quotation-docx`, versionLabel), { cache: "no-store" }),
      fetch(withVersion(`/api/projects/${projectId}/files/quotation-xlsx`, versionLabel), { cache: "no-store" }),
    ]);

    if (quotationResponse.ok) {
      const quotation = (await quotationResponse.json()) as QuotationApiDetail;
      if (quotation.found) {
        setQuotationFileName(quotation.fileName ?? "preventivo.pdf");
        setQuotationPreviewUrl(quotation.previewUrl ?? withVersion(`/api/projects/${projectId}/quotation/file`, versionLabel));
      }
    }

    if (emailResponse.ok) {
      const emailFile = (await emailResponse.json()) as GenericProjectFileDetail;
      setLocalPdfNames((prev) => ({ ...prev, emailPdf: emailFile.found ? (emailFile.fileName ?? "email.pdf") : null }));
      setLocalPdfPreviewUrls((prev) => ({
        ...prev,
        emailPdf: emailFile.found ? (emailFile.previewUrl ?? withVersion(`/api/projects/${projectId}/files/email-pdf/content`, versionLabel)) : null,
      }));
    }

    if (techResponse.ok) {
      const techFile = (await techResponse.json()) as GenericProjectFileDetail;
      setLocalPdfNames((prev) => ({ ...prev, techPdf: techFile.found ? (techFile.fileName ?? "specifica-tecnica.pdf") : null }));
      setLocalPdfPreviewUrls((prev) => ({
        ...prev,
        techPdf: techFile.found ? (techFile.previewUrl ?? withVersion(`/api/projects/${projectId}/files/tech-pdf/content`, versionLabel)) : null,
      }));
    }

    if (docxResponse.ok) {
      const docxFile = (await docxResponse.json()) as GenericProjectFileDetail;
      setQuotationDocxName(docxFile.found ? (docxFile.fileName ?? "preventivo.docx") : null);
      setQuotationDocxPreviewUrl(
        docxFile.found ? (docxFile.previewUrl ?? withVersion(`/api/projects/${projectId}/files/quotation-docx/content`, versionLabel)) : null,
      );
    }

    if (xlsxResponse.ok) {
      const xlsxFile = (await xlsxResponse.json()) as GenericProjectFileDetail;
      setQuotationXlsxName(xlsxFile.found ? (xlsxFile.fileName ?? "preventivo.xlsx") : null);
      setQuotationXlsxPreviewUrl(
        xlsxFile.found ? (xlsxFile.previewUrl ?? withVersion(`/api/projects/${projectId}/files/quotation-xlsx/content`, versionLabel)) : null,
      );
    }
  }, [resetVersionedFiles]);

  const loadClientOptions = useCallback(async (): Promise<ClientApiItem[]> => {
    const clientsResponse = await fetch("/api/clients", { cache: "no-store" });
    if (!clientsResponse.ok) {
      throw new Error("Errore caricamento clienti");
    }

    const clients = (await clientsResponse.json()) as ClientApiItem[];
    setClientOptions(clients);
    return clients;
  }, []);

  const resetNewClientForm = () => {
    setNewClientName("");
    setNewClientEmail("");
    setNewClientPhone("");
    setNewClientNotes("");
  };

  const handleCreateClientInline = async () => {
    if (!newClientName.trim() || !newClientEmail.trim() || !newClientPhone.trim() || !newClientNotes.trim()) {
      toast.error("Compila tutti i campi del nuovo cliente.");
      return;
    }

    try {
      setIsCreatingClient(true);
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newClientEmail.trim(),
          name: newClientName.trim(),
          notes: newClientNotes.trim(),
          phone: newClientPhone.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Creazione cliente fallita");
      }

      const created = (await response.json()) as ClientApiItem;
      const refreshed = await loadClientOptions();
      const selected = refreshed.find((client) => client.id === created.id) ?? created;
      setValue("clientId", selected.id, { shouldValidate: true });
      setNewVersionClientId(selected.id);
      setIsClientModalOpen(false);
      resetNewClientForm();
      toast.success("Nuovo cliente creato.");
    } catch {
      toast.error("Impossibile creare il cliente.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const clients = await loadClientOptions();

        if (isEdit && id) {
          const [projectResponse, versionsResponse] = await Promise.all([
            fetch(`/api/projects/${id}`, { cache: "no-store" }),
            fetch(`/api/projects/${id}/versions`, { cache: "no-store" }),
          ]);

          if (!projectResponse.ok) {
            throw new Error("Errore caricamento progetto");
          }

          const project = (await projectResponse.json()) as ProjectApiDetail;
          reset({
            clientId: project.clientId ?? "",
            projectName: project.projectName,
            enableAi: false,
            status: project.status,
          });

          let versionsPayload: ProjectVersionsApiResponse = {
            selectedVersionLabel: "v1",
            versions: [
              {
                clientId: project.clientId,
                clientName: clients.find((item) => item.id === project.clientId)?.name ?? null,
                createdAt: new Date().toISOString(),
                description: "Versione iniziale",
                isDefault: true,
                status: project.status,
                versionLabel: "v1",
              },
            ],
          };

          if (versionsResponse.ok) {
            versionsPayload = (await versionsResponse.json()) as ProjectVersionsApiResponse;
          }

          const availableVersions = versionsPayload.versions.length ? versionsPayload.versions : [];
          const resolvedVersion =
            versionsPayload.selectedVersionLabel ??
            availableVersions.find((version) => version.isDefault)?.versionLabel ??
            availableVersions[0]?.versionLabel ??
            "v1";

          setProjectVersions(availableVersions);
          setSelectedVersionLabel(resolvedVersion);
          const resolvedVersionData =
            availableVersions.find((version) => version.versionLabel === resolvedVersion) ?? availableVersions[0] ?? null;
          setNewVersionClientId(resolvedVersionData?.clientId ?? project.clientId ?? "");
          setNewVersionStatus(resolvedVersionData?.status ?? project.status ?? PROJECT_STATUS_OPTIONS[0].key);
          await loadVersionedProjectFiles(id, resolvedVersion);
        } else if (clients.length > 0) {
          setValue("clientId", clients[0]?.id ?? "", { shouldValidate: true });
          setNewVersionClientId(clients[0]?.id ?? "");
        }
      } catch {
        toast.error("Impossibile caricare i dati del form progetto.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [id, isEdit, loadClientOptions, loadVersionedProjectFiles, reset, setValue]);

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      setIsSubmitting(true);

      const endpoint = isEdit && id ? `/api/projects/${id}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          projectName: data.projectName,
          status: data.status,
        }),
      });

      if (!response.ok) {
        throw new Error("Operazione progetto fallita");
      }

      toast.success(isEdit ? "Progetto aggiornato con successo." : "Progetto creato con successo.");
      router.push(APP_ROUTES.dashboard);
      router.refresh();
    } catch {
      toast.error("Salvataggio progetto non riuscito.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/orchestrator/jobs/${activeJobId}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as OrchestratorJobState;
        const progress = Math.max(0, Math.min(100, payload.progress ?? 0));
        const status = payload.status ?? "running";
        const message = payload.status === "failed" && payload.error
          ? payload.error
          : payload.message ?? "Elaborazione in corso";

        setJobProgress(progress);
        setJobStatus(status);
        setJobMessage(message);

        if (status === "completed") {
          const completionKey = `${activeJobId}:completed`;
          if (finalStatusNotifiedRef.current !== completionKey) {
            finalStatusNotifiedRef.current = completionKey;
            toast.success(message || "Elaborazione completata con successo.");
          }

          if (id) {
            try {
              const targetVersionLabel = activeJobVersionLabel ?? selectedVersionLabel;
              const docxResponse = await fetch(withVersion(`/api/projects/${id}/files/quotation-docx`, targetVersionLabel), { cache: "no-store" });
              if (docxResponse.ok) {
                const docxFile = (await docxResponse.json()) as GenericProjectFileDetail;
                if (targetVersionLabel === selectedVersionLabel) {
                  setQuotationDocxName(docxFile.found ? (docxFile.fileName ?? "preventivo.docx") : null);
                  setQuotationDocxPreviewUrl(
                    docxFile.found ? (docxFile.previewUrl ?? withVersion(`/api/projects/${id}/files/quotation-docx/content`, targetVersionLabel)) : null,
                  );
                }
              }
            } catch {
              // no-op
            }
          }

          if (progressPollRef.current) {
            window.clearInterval(progressPollRef.current);
            progressPollRef.current = null;
          }
          window.setTimeout(() => {
            setShowProgressWidget(false);
            setActiveJobId(null);
            setActiveJobVersionLabel(null);
          }, 6000);
        }

        if (status === "failed") {
          const failedKey = `${activeJobId}:failed`;
          if (finalStatusNotifiedRef.current !== failedKey) {
            finalStatusNotifiedRef.current = failedKey;
            toast.error(message || "Elaborazione terminata con errore.");
          }

          if (progressPollRef.current) {
            window.clearInterval(progressPollRef.current);
            progressPollRef.current = null;
          }
        }
      } catch {
        // no-op
      }
    };

    void fetchProgress();
    progressPollRef.current = window.setInterval(() => {
      void fetchProgress();
    }, 1500);

    return () => {
      if (progressPollRef.current) {
        window.clearInterval(progressPollRef.current);
        progressPollRef.current = null;
      }
    };
  }, [activeJobId, activeJobVersionLabel, id, selectedVersionLabel]);

  const handleQuotationUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Carica un file PDF valido per il preventivo.");
      return;
    }

    if (!isEdit || !id) {
      toast.info("Salva prima il progetto, poi carica il preventivo.");
      return;
    }

    try {
      setIsUploadingQuotation(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(withVersion(`/api/projects/${id}/quotation`, selectedVersionLabel), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload preventivo fallito");
      }

      const payload = (await response.json()) as { filename?: string; orchestratorJobId?: string | null; previewUrl?: string };
      setQuotationFileName(payload.filename ?? "preventivo.pdf");
      setQuotationPreviewUrl(payload.previewUrl ?? withVersion(`/api/projects/${id}/quotation/file`, selectedVersionLabel));
      setShowQuotationPopup(true);

      if (payload.orchestratorJobId) {
        setActiveJobId(payload.orchestratorJobId);
        setActiveJobVersionLabel(selectedVersionLabel);
        setJobStatus("queued");
        setJobProgress(1);
        setJobMessage("Job OCR/LM Studio avviato");
        setShowProgressWidget(true);
      }

      window.setTimeout(() => {
        setShowQuotationPopup(false);
      }, 2600);
    } catch {
      toast.error("Caricamento preventivo non riuscito.");
    } finally {
      setIsUploadingQuotation(false);
    }
  };

  const handleLocalPdfUpload =
    (field: LocalPdfKey) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Carica un file PDF valido.");
        return;
      }

      if (!isEdit || !id) {
        toast.info("Salva prima il progetto, poi carica il documento.");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("versionLabel", selectedVersionLabel);
        const fileKind = LOCAL_PDF_KIND_MAP[field];
        const response = await fetch(withVersion(`/api/projects/${id}/files/${fileKind}`, selectedVersionLabel), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload file fallito");
        }

        const payload = (await response.json()) as { fileName?: string };
        setLocalPdfNames((prev) => ({
          ...prev,
          [field]: payload.fileName ?? file.name,
        }));
        setLocalPdfPreviewUrls((prev) => ({
          ...prev,
          [field]: withVersion(`/api/projects/${id}/files/${fileKind}/content`, selectedVersionLabel),
        }));
        toast.success("PDF caricato con successo.");
      } catch {
        toast.error("Caricamento PDF non riuscito.");
      }
    };

  const handleDeleteLocalPdf = async (field: LocalPdfKey) => {
    if (!isEdit || !id || !localPdfNames[field]) {
      return;
    }

    try {
      const fileKind = LOCAL_PDF_KIND_MAP[field];
      const response = await fetch(withVersion(`/api/projects/${id}/files/${fileKind}`, selectedVersionLabel), { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Delete file fallita");
      }

      setLocalPdfNames((prev) => ({
        ...prev,
        [field]: null,
      }));
      setLocalPdfPreviewUrls((prev) => ({
        ...prev,
        [field]: null,
      }));
      toast.success("PDF eliminato.");
    } catch {
      toast.error("Eliminazione PDF non riuscita.");
    }
  };

  const isSpreadsheetFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    return lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsm");
  };

  const handleQuotationXlsxUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!isSpreadsheetFile(file)) {
      toast.error("Carica un file Excel valido (.xlsx, .xls, .xlsm).");
      return;
    }

    if (!isEdit || !id) {
      toast.info("Salva prima il progetto, poi carica il file Excel.");
      return;
    }

    try {
      setIsUploadingQuotationXlsx(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("versionLabel", selectedVersionLabel);
      const response = await fetch(withVersion(`/api/projects/${id}/files/quotation-xlsx`, selectedVersionLabel), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload Excel fallito");
      }

      const payload = (await response.json()) as { fileName?: string };
      setQuotationXlsxName(payload.fileName ?? file.name);
      setQuotationXlsxPreviewUrl(withVersion(`/api/projects/${id}/files/quotation-xlsx/content`, selectedVersionLabel));
      toast.success("File Excel caricato con successo.");
    } catch {
      toast.error("Caricamento file Excel non riuscito.");
    } finally {
      setIsUploadingQuotationXlsx(false);
    }
  };

  const handleDeleteQuotationXlsx = async () => {
    if (!isEdit || !id || !quotationXlsxName) {
      return;
    }

    try {
      setIsDeletingQuotationXlsx(true);
      const response = await fetch(withVersion(`/api/projects/${id}/files/quotation-xlsx`, selectedVersionLabel), { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Eliminazione Excel fallita");
      }

      setQuotationXlsxName(null);
      setQuotationXlsxPreviewUrl(null);
      toast.success("File Excel eliminato.");
    } catch {
      toast.error("Eliminazione file Excel non riuscita.");
    } finally {
      setIsDeletingQuotationXlsx(false);
    }
  };

  const handleDeleteQuotation = async () => {
    if (!isEdit || !id || !quotationFileName) {
      return;
    }

    try {
      setIsDeletingQuotation(true);
      const response = await fetch(withVersion(`/api/projects/${id}/quotation`, selectedVersionLabel), { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Eliminazione preventivo fallita");
      }

      setQuotationFileName(null);
      setQuotationPreviewUrl(null);
      toast.success("Preventivo eliminato.");
    } catch {
      toast.error("Eliminazione preventivo non riuscita.");
    } finally {
      setIsDeletingQuotation(false);
    }
  };

  const handleReanalyzeQuotation = async () => {
    if (!isEdit || !id || !quotationFileName) {
      return;
    }

    try {
      setIsStartingAnalysis(true);
      const response = await fetch(withVersion(`/api/projects/${id}/quotation/analyze`, selectedVersionLabel), { method: "POST" });
      if (!response.ok) {
        throw new Error("Impossibile avviare rianalisi");
      }

      const payload = (await response.json()) as { jobId?: string };
      if (!payload.jobId) {
        throw new Error("Job ID non ricevuto");
      }

      setActiveJobId(payload.jobId);
      setActiveJobVersionLabel(selectedVersionLabel);
      setJobStatus("queued");
      setJobProgress(1);
      setJobMessage("Rianalisi OCR/LM Studio avviata");
      setShowProgressWidget(true);
      toast.success("Rianalisi avviata.");
    } catch {
      toast.error("Rianalisi non avviata.");
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  const handleVersionSelection = async (nextVersionLabel: string) => {
    if (!isEdit || !id || nextVersionLabel === selectedVersionLabel) {
      return;
    }

    const previousVersion = selectedVersionLabel;
    try {
      setIsSwitchingVersion(true);
      setSelectedVersionLabel(nextVersionLabel);

      const response = await fetch(`/api/projects/${id}/versions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionLabel: nextVersionLabel }),
      });

      if (response.ok) {
        const payload = (await response.json()) as ProjectVersionsApiResponse;
        if (payload.versions?.length) {
          setProjectVersions(payload.versions);
          const selectedVersion = payload.versions.find((version) => version.versionLabel === nextVersionLabel) ?? null;
          if (selectedVersion) {
            setNewVersionClientId(selectedVersion.clientId ?? "");
            setNewVersionStatus(selectedVersion.status);
          }
        }
      }

      await loadVersionedProjectFiles(id, nextVersionLabel);
      toast.success(`Versione attiva: ${nextVersionLabel.toUpperCase()}`);
    } catch {
      setSelectedVersionLabel(previousVersion);
      toast.error("Impossibile cambiare versione.");
    } finally {
      setIsSwitchingVersion(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!isEdit || !id) {
      return;
    }

    const description = newVersionDescription.trim();
    if (description.length < 2) {
      toast.error("Inserisci una descrizione di almeno 2 caratteri.");
      return;
    }

    try {
      setIsCreatingVersion(true);
      const response = await fetch(`/api/projects/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: newVersionClientId || null,
          description,
          status: newVersionStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Creazione versione fallita");
      }

      const payload = (await response.json()) as ProjectVersionsApiResponse & { selectedVersionLabel?: string };
      const nextVersionLabel = payload.selectedVersionLabel ?? payload.versions?.find((version) => version.isDefault)?.versionLabel ?? "v1";
      const versions = payload.versions ?? [];
      const activeVersion = versions.find((version) => version.versionLabel === nextVersionLabel) ?? null;

      setProjectVersions(versions);
      setSelectedVersionLabel(nextVersionLabel);
      setShowNewVersionForm(false);
      setNewVersionDescription("");
      setNewVersionClientId(activeVersion?.clientId ?? newVersionClientId);
      setNewVersionStatus(activeVersion?.status ?? newVersionStatus);
      await loadVersionedProjectFiles(id, nextVersionLabel);
      toast.success("Nuova versione creata.");
    } catch {
      toast.error("Creazione nuova versione non riuscita.");
    } finally {
      setIsCreatingVersion(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(APP_ROUTES.dashboard)}
            className="rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-2 text-text-secondary shadow-card transition-colors hover:bg-bg-muted hover:text-brand-primary"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Text as="h1" variant="h1">
                {isEdit ? "Modifica Progetto" : "Nuovo Progetto"}
              </Text>
              <PageHelpHint text="Compila i dati progetto e salva la commessa." />
            </div>
            <Text variant="muted">{isEdit ? "Modifica Commessa" : "Nuova Commessa"}</Text>
          </div>
        </div>

        {isEdit && (
          <div className="hidden items-center gap-2 rounded-lg border border-blue-100 bg-status-info-bg px-3 py-1 text-xs font-bold text-status-info-text sm:flex">
            UUID: <span className="font-mono text-[10px]">{id}</span>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 p-6 lg:p-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-10">
            <FormField label="Nome Cliente" icon={<Users size={18} className="text-brand-primary" />} error={errors.clientId?.message}>
              <div className="space-y-2">
                <select
                  {...register("clientId", { required: "Seleziona un cliente" })}
                  disabled={isLoading || isSubmitting}
                  className="h-12 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">Seleziona un cliente...</option>
                  {clientOptions.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border-default px-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                >
                  <PlusCircle size={13} />
                  Nuovo cliente
                </button>
              </div>
            </FormField>

            <FormField
              label="Nome Progetto"
              icon={<Briefcase size={18} className="text-brand-primary" />}
              error={errors.projectName?.message}
            >
              <Input
                type="text"
                placeholder="Inserisci il nome progetto..."
                disabled={isLoading || isSubmitting}
                {...register("projectName", { required: "Il nome progetto e obbligatorio" })}
              />
            </FormField>

            <FormField label="Stato Progetto" icon={<CheckCircle2 size={18} className="text-brand-primary" />} error={errors.status?.message}>
              <select
                {...register("status", { required: "Seleziona lo stato progetto" })}
                disabled={isLoading || isSubmitting}
                className="h-12 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {PROJECT_STATUS_OPTIONS.map((status) => (
                  <option key={status.key} value={status.key}>
                    {status.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {isEdit && (
            <div className="rounded-[var(--radius-xl)] border border-border-default bg-bg-muted p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Versione Progetto</h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Seleziona la versione attiva e visualizza/carica i file associati a quella revisione.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewVersionForm((prev) => {
                      const next = !prev;
                      if (next) {
                        setNewVersionClientId((current) => current || selectedProjectClientId || clientOptions[0]?.id || "");
                      }
                      if (!next) {
                        setNewVersionDescription("");
                      }
                      return next;
                    });
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border-default px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                >
                  <PlusCircle size={14} />
                  Nuova versione
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr),auto] md:items-center">
                <select
                  value={selectedVersionLabel}
                  onChange={(event) => void handleVersionSelection(event.target.value)}
                  disabled={isSwitchingVersion || isCreatingVersion || !projectVersions.length}
                  className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-surface px-4 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {!projectVersions.length && (
                    <option value="v1">Versione iniziale (V1)</option>
                  )}
                  {projectVersions.map((version) => (
                    <option key={version.versionLabel} value={version.versionLabel}>
                      {getVersionDisplayLabel(version)}
                    </option>
                  ))}
                </select>

                <span className="inline-flex h-11 items-center rounded-md border border-border-subtle bg-bg-surface px-3 text-xs font-medium text-text-muted">
                  URL: {selectedVersionLabel}
                </span>
              </div>

              {showNewVersionForm && (
                <div className="mt-4 rounded-lg border border-border-subtle bg-bg-surface p-3">
                  <p className="text-xs font-semibold text-text-secondary">Descrizione breve versione</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      type="text"
                      value={newVersionDescription}
                      maxLength={80}
                      onChange={(event) => setNewVersionDescription(event.target.value)}
                      placeholder="Es: Aggiornamento prezzi aprile 2026"
                      disabled={isCreatingVersion}
                    />
                    <select
                      value={newVersionStatus}
                      onChange={(event) => setNewVersionStatus(event.target.value as ProjectStatus)}
                      disabled={isCreatingVersion}
                      className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {PROJECT_STATUS_OPTIONS.map((status) => (
                        <option key={status.key} value={status.key}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr),auto]">
                    <select
                      value={newVersionClientId}
                      onChange={(event) => setNewVersionClientId(event.target.value)}
                      disabled={isCreatingVersion}
                      className="h-11 w-full cursor-pointer appearance-none rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Nessun cliente</option>
                      {clientOptions.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsClientModalOpen(true)}
                      className="inline-flex h-11 items-center justify-center gap-1 rounded-md border border-border-default px-3 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                    >
                      <PlusCircle size={13} />
                      Nuovo cliente
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleCreateVersion()}
                        disabled={isCreatingVersion}
                        className="h-11 px-4"
                      >
                        {isCreatingVersion ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Crea
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowNewVersionForm(false);
                          setNewVersionDescription("");
                        }}
                        disabled={isCreatingVersion}
                        className="h-11 px-4"
                      >
                        <X size={16} />
                        Annulla
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="h-px bg-border-subtle" />

          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Caricamento Documenti (PDF)</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                { desc: "Storico comunicazioni", label: "Email PDF", name: "emailPdf" as const },
                { desc: "Dettagli tecnici", label: "Specifica Tecnica", name: "techPdf" as const },
                { desc: "Prezzi e condizioni", label: "Preventivo PDF", name: "quotationPdf" as const },
              ].map((file) => (
                <div key={file.name} className="group relative">
                  {file.name === "quotationPdf" && showQuotationPopup && (
                    <div className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-md border border-status-success-border bg-status-success-bg px-2.5 py-1 text-[11px] font-semibold text-status-success-text shadow-sm">
                      PDF collegato con successo
                    </div>
                  )}

                  <label className="group block cursor-pointer rounded-[var(--radius-xl)] border-2 border-dashed border-border-default p-6 text-center transition-all hover:border-brand-primary hover:bg-status-info-bg">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={
                        file.name === "quotationPdf"
                          ? handleQuotationUpload
                          : handleLocalPdfUpload(file.name as LocalPdfKey)
                      }
                      disabled={
                        isSwitchingVersion ||
                        (file.name === "quotationPdf" && (isUploadingQuotation || isDeletingQuotation))
                      }
                    />
                    <div className="flex flex-col items-center">
                      <div className="mb-3 rounded-[var(--radius-md)] bg-bg-subtle p-3 transition-colors group-hover:bg-blue-100">
                        {file.name === "quotationPdf" && isUploadingQuotation ? (
                          <Loader2 size={24} className="animate-spin text-brand-primary" />
                        ) : file.name === "quotationPdf" && quotationFileName ? (
                          <CheckCircle2 size={24} className="text-status-success-text" />
                        ) : (
                          <Upload size={24} className="text-slate-400 group-hover:text-blue-600" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-text-secondary">{file.label}</span>
                      <span className="mt-1 text-xs text-text-muted">{file.desc}</span>
                      {file.name === "quotationPdf" && quotationFileName && (
                        <span className="mt-2 max-w-full truncate text-xs font-medium text-status-success-text" title={quotationFileName}>
                          {quotationFileName}
                        </span>
                      )}
                      {file.name !== "quotationPdf" && localPdfNames[file.name as LocalPdfKey] && (
                        <span
                          className="mt-2 max-w-full truncate text-xs font-medium text-status-success-text"
                          title={localPdfNames[file.name as LocalPdfKey] ?? ""}
                        >
                          {localPdfNames[file.name as LocalPdfKey]}
                        </span>
                      )}
                    </div>
                  </label>

                  <div className="mt-2 flex items-center justify-center gap-2">
                    {file.name === "quotationPdf" && quotationPreviewUrl && quotationFileName && (
                      <a
                        href={quotationPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                      >
                        <Eye size={13} />
                        Anteprima
                      </a>
                    )}

                    {file.name !== "quotationPdf" && localPdfNames[file.name as LocalPdfKey] && localPdfPreviewUrls[file.name as LocalPdfKey] && (
                      <a
                        href={localPdfPreviewUrls[file.name as LocalPdfKey] ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                      >
                        <Eye size={13} />
                        Anteprima
                      </a>
                    )}

                    {file.name === "quotationPdf" && quotationFileName && (
                      <button
                        type="button"
                        onClick={() => void handleReanalyzeQuotation()}
                        disabled={isSwitchingVersion || isStartingAnalysis || isUploadingQuotation || isDeletingQuotation}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-default px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={isStartingAnalysis ? "animate-spin" : ""} />
                        Rianalizza PDF
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={
                        file.name === "quotationPdf"
                          ? () => void handleDeleteQuotation()
                          : () => void handleDeleteLocalPdf(file.name as LocalPdfKey)
                      }
                      disabled={
                        file.name === "quotationPdf"
                          ? !quotationFileName || isSwitchingVersion || isUploadingQuotation || isDeletingQuotation
                          : !localPdfNames[file.name as LocalPdfKey] || isSwitchingVersion
                      }
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-status-danger-border px-2 py-1 text-[11px] font-medium text-status-danger-text transition-colors hover:bg-status-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      Elimina PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isEdit && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Output Di Versione</h3>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-[var(--radius-xl)] border border-border-default bg-bg-muted p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-[var(--radius-md)] bg-bg-surface p-2 text-brand-primary">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-secondary">Preventivo Word (DOCX)</p>
                      <p className="mt-1 text-xs text-text-muted">Generato dall'orchestrator dopo l'analisi.</p>
                      <p className="mt-2 truncate text-xs font-medium text-text-secondary" title={quotationDocxName ?? ""}>
                        {quotationDocxName ?? "Non ancora disponibile"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    {quotationDocxPreviewUrl ? (
                      <a
                        href={quotationDocxPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-default px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                      >
                        <Eye size={13} />
                        Apri DOCX
                      </a>
                    ) : (
                      <span className="text-xs text-text-muted">Disponibile al completamento dell'elaborazione.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-[var(--radius-xl)] border border-border-default bg-bg-muted p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-[var(--radius-md)] bg-bg-surface p-2 text-brand-primary">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-secondary">Preventivo Excel (XLSX)</p>
                      <p className="mt-1 text-xs text-text-muted">Caricabile per la stessa versione progetto.</p>
                      <p className="mt-2 truncate text-xs font-medium text-text-secondary" title={quotationXlsxName ?? ""}>
                        {quotationXlsxName ?? "Nessun file Excel collegato"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border-default px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        className="hidden"
                        onChange={handleQuotationXlsxUpload}
                        disabled={isSwitchingVersion || isUploadingQuotationXlsx || isDeletingQuotationXlsx}
                      />
                      {isUploadingQuotationXlsx ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      Carica Excel
                    </label>

                    {quotationXlsxPreviewUrl && quotationXlsxName && (
                      <a
                        href={quotationXlsxPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-default px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:bg-bg-subtle"
                      >
                        <Eye size={13} />
                        Apri Excel
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleDeleteQuotationXlsx()}
                      disabled={!quotationXlsxName || isSwitchingVersion || isUploadingQuotationXlsx || isDeletingQuotationXlsx}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-status-danger-border px-3 py-1 text-[11px] font-medium text-status-danger-text transition-colors hover:bg-status-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      Elimina Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isEdit && (
            <>
              <div className="h-px bg-border-subtle" />

              <div className="flex flex-col justify-between gap-4 rounded-[var(--radius-xl)] border border-border-subtle bg-bg-muted p-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <div className="rounded-[var(--radius-md)] bg-status-warn-bg p-3 text-status-warn-text">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary">Abilita Motore AI</h4>
                    <p className="text-xs text-text-muted">
                      Analizza in automatico le specifiche e suggerisce dettagli per il preventivo.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" {...register("enableAi")} className="peer sr-only" />
                  <div className="peer h-7 w-14 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:border after:border-gray-300 after:bg-bg-surface after:transition-all after:content-[''] peer-checked:bg-brand-primary peer-checked:after:translate-x-full peer-checked:after:border-bg-surface peer-focus:ring-4 peer-focus:ring-blue-300" />
                </label>
              </div>
            </>
          )}

          <div className="flex flex-col items-center justify-end gap-3 pt-6 sm:flex-row">
            <Button
              variant="outline"
              className="h-12 w-full rounded-[var(--radius-md)] px-6 py-3 text-text-muted sm:w-auto"
              onClick={() => router.push(APP_ROUTES.dashboard)}
              disabled={isSubmitting}
            >
              <XCircle size={18} />
              Annulla
            </Button>

            <Button type="submit" className="h-12 w-full rounded-[var(--radius-md)] px-8 py-3 sm:w-auto" disabled={isSubmitting}>
              <Save size={18} />
              {isEdit ? "Salva modifiche" : "Crea progetto"}
            </Button>

            {!isEdit && (
              <Button variant="accent" className="h-12 w-full rounded-[var(--radius-md)] px-8 py-3 sm:w-auto">
                <FileCheck size={18} />
                Genera preventivo
              </Button>
            )}
          </div>
        </form>
      </Card>

      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-border-default bg-bg-surface p-5 shadow-elevated">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">Nuovo Cliente</h3>
            <p className="mt-1 text-xs text-text-muted">Crea il cliente senza uscire dalla pagina corrente.</p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <Input
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                placeholder="Nome e cognome"
                disabled={isCreatingClient}
              />
              <Input
                type="email"
                value={newClientEmail}
                onChange={(event) => setNewClientEmail(event.target.value)}
                placeholder="Email"
                disabled={isCreatingClient}
              />
              <Input
                value={newClientPhone}
                onChange={(event) => setNewClientPhone(event.target.value)}
                placeholder="Telefono"
                disabled={isCreatingClient}
              />
              <Input
                value={newClientNotes}
                onChange={(event) => setNewClientNotes(event.target.value)}
                placeholder="Note"
                disabled={isCreatingClient}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsClientModalOpen(false);
                  resetNewClientForm();
                }}
                disabled={isCreatingClient}
              >
                <X size={16} />
                Annulla
              </Button>
              <Button type="button" onClick={() => void handleCreateClientInline()} disabled={isCreatingClient}>
                {isCreatingClient ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salva cliente
              </Button>
            </div>
          </div>
        </div>
      )}

      {showProgressWidget && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(460px,calc(100vw-2rem))] rounded-xl border border-border-default bg-bg-surface/95 p-4 shadow-elevated backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Elaborazione preventivo</p>
              <p className="mt-1 text-sm font-medium text-text-secondary">
                {jobStatus === "completed"
                  ? "Completata"
                  : jobStatus === "failed"
                    ? "Terminata con errore"
                    : "In esecuzione"}
              </p>
              <p className="mt-0.5 text-xs text-text-muted line-clamp-2">{jobMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowProgressWidget(false);
                setActiveJobId(null);
              }}
              className="rounded-md border border-border-default p-1 text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary"
              title="Chiudi"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-muted">
            <div
              className={`h-full transition-all duration-500 ${
                jobStatus === "failed"
                  ? "bg-status-danger-text"
                  : jobStatus === "completed"
                    ? "bg-status-success-text"
                    : "bg-brand-primary"
              }`}
              style={{ width: `${jobProgress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
            <span>{activeJobId ? `Job: ${activeJobId.slice(0, 8)}` : "Job in attesa"}</span>
            <span>{jobProgress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
