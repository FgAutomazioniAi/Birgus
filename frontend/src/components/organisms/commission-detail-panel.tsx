"use client";

import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Download, Lock, Paperclip, Pencil, Plus, RefreshCw, Save, Signature, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InputHTMLAttributes, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Checkbox, CheckboxControl, Input, Text } from "@/components/atoms";
import { BirgusLogo, SelectDropdown } from "@/components/molecules";
import { useLanguage } from "@/components/organisms/language-provider";
import { cn } from "@/lib/cn";
import { APP_ROUTES } from "@/lib/routes";

type FieldType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "BOOLEAN"
  | "SELECT"
  | "MULTI_SELECT"
  | "CHECKBOX_GROUP"
  | "TABLE"
  | "SIGNATURE"
  | "DOCUMENT_CHECKLIST";

interface CommissionRecord {
  id: string;
  code: string;
  title: string;
  companyName: string | null;
  status: string;
  priority: string;
  updatedAt: string;
}

interface CommissionFieldOption {
  id: string;
  value: string;
  label: string;
  sortOrder: number;
}

interface CommissionTableColumn {
  id: string;
  key: string;
  label: string;
  placeholder: string | null;
  required: boolean;
}

interface CommissionTableDefinition {
  id: string;
  key: string;
  title: string;
  minRows: number | null;
  maxRows: number | null;
  allowAddRows: boolean;
  defaultRows: Array<Record<string, unknown>>;
  columns: CommissionTableColumn[];
}

interface CommissionFormField {
  id: string;
  key: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  fieldType: FieldType;
  required: boolean;
  options: CommissionFieldOption[];
  table: CommissionTableDefinition | null;
}

interface CommissionFormSection {
  id: string;
  title: string;
  description: string | null;
  fields: CommissionFormField[];
}

interface CommissionFormPage {
  id: string;
  pageNumber: number;
  title: string;
  description: string | null;
  sections: CommissionFormSection[];
}

interface CommissionFieldValue {
  fieldId: string;
  value: unknown;
}

interface CommissionTableCellValue {
  columnKey: string;
  value: unknown;
}

interface CommissionTableRow {
  id: string;
  tableDefinitionId: string;
  rowKey: string | null;
  cells: CommissionTableCellValue[];
}

interface CommissionSignature {
  id: string;
  signerName: string;
  signerRole: string | null;
  statement: string | null;
  signedAt: string;
}

interface CommissionAttachment {
  id: string;
  documentId: string;
  fieldKey: string | null;
  label: string | null;
  note: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
}

interface CommissionChecklistView {
  record: CommissionRecord;
  currentUser: {
    id: string;
    fullName: string;
    canReopenSignedChecklist: boolean;
    canConfigureVendorList: boolean;
  };
  checklist: {
    id: string;
    title: string;
    status: string;
    progressPercent: number;
    signedAt: string | null;
  } | null;
  pages: CommissionFormPage[];
  values: CommissionFieldValue[];
  tableRows: CommissionTableRow[];
  attachments: CommissionAttachment[];
  signatures: CommissionSignature[];
}

interface CompletionIssue {
  pageNumber: number;
  sectionTitle: string;
  label: string;
}

interface LockInfo {
  id: string;
}

interface EditableTableRow {
  rowKey: string | null;
  cells: Record<string, unknown>;
}

interface CommissionDetailPanelProps {
  id: string;
}

export function CommissionDetailPanel({ id }: CommissionDetailPanelProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [view, setView] = useState<CommissionChecklistView | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [tableValues, setTableValues] = useState<Record<string, EditableTableRow[]>>({});
  const [signatureStatement, setSignatureStatement] = useState("");
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [completionIssues, setCompletionIssues] = useState<CompletionIssue[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  const loadView = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/commission-intake/records/${id}/checklist`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { view?: CommissionChecklistView; message?: string };
      if (!response.ok || !payload.view) {
        throw new Error(payload.message ?? t("commissions.detailLoadFailed"));
      }

      setView(payload.view);
      setActivePageId((current) => current ?? payload.view?.pages[0]?.id ?? null);
      setFieldValues(Object.fromEntries(payload.view.values.map((value) => [value.fieldId, value.value])));
      setTableValues(buildTableState(payload.view.tableRows));
      setIsDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.detailLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const interceptNavigation = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTarget(`${destination.pathname}${destination.search}${destination.hash}`);
      setLeaveConfirmationOpen(true);
    };
    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  }, [isDirty]);

  useEffect(() => {
    if (!view?.checklist) {
      return;
    }
    if (view.checklist.status === "SIGNED") {
      setLockInfo(null);
      setReadOnlyReason(null);
      return;
    }

    let cancelled = false;
    let acquiredLock: LockInfo | null = null;

    const acquire = async () => {
      try {
        const response = await fetch(`/api/commission-intake/records/${view.record.id}/checklist/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const payload = await response.json().catch(() => ({})) as { lock?: LockInfo; message?: string };
        if (!response.ok || !payload.lock) {
          throw new Error(payload.message ?? t("commissions.lockUnavailable"));
        }
        acquiredLock = payload.lock;
        if (!cancelled) {
          setLockInfo(payload.lock);
          setReadOnlyReason(null);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : t("commissions.lockUnavailable");
          setReadOnlyReason(message);
          toast.warning(message);
        }
      }
    };

    void acquire();

    return () => {
      cancelled = true;
      if (acquiredLock) {
        void fetch(`/api/commission-intake/records/${view.record.id}/checklist/lock/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "page_closed" }),
          keepalive: true,
        });
      }
      setLockInfo(null);
    };
  }, [view?.checklist?.id, view?.checklist?.status, view?.record.id, t]);

  const activePage = useMemo(() => {
    if (!view) return null;
    return view.pages.find((page) => page.id === activePageId) ?? view.pages[0] ?? null;
  }, [activePageId, view]);

  const activePageIndex = useMemo(() => {
    if (!view || !activePage) return -1;
    return view.pages.findIndex((page) => page.id === activePage.id);
  }, [activePage, view]);

  const previousPage = view && activePageIndex > 0 ? view.pages[activePageIndex - 1] : null;
  const nextPage = view && activePageIndex >= 0 && activePageIndex < view.pages.length - 1 ? view.pages[activePageIndex + 1] : null;
  const isLastPage = Boolean(view && activePageIndex === view.pages.length - 1);
  const signatureName = view?.currentUser.fullName ?? "";
  const isFinalized = view?.checklist?.status === "SIGNED";
  const activePageStats = activePage ? getPageCompletionStats(activePage, fieldValues, tableValues, view?.attachments ?? []) : null;
  const activePageAttachmentFields = activePage ? getAttachmentToggleFields(activePage) : [];
  const isDocumentationPage = activePage ? isDocumentationAttachmentsPage(activePage) : false;

  const isReadOnly = isFinalized || Boolean(readOnlyReason) || !lockInfo;

  const savePage = async (options?: { silent?: boolean }): Promise<boolean> => {
    if (!view?.checklist) return false;

    const fields = view.pages.flatMap((page) => page.sections.flatMap((section) => section.fields));
    const plainFields = fields.filter((field) => field.fieldType !== "TABLE" && field.fieldType !== "SIGNATURE");
    const tableFields = fields.filter((field) => field.fieldType === "TABLE" && field.table);

    if (plainFields.length === 0 && tableFields.length === 0) {
      if (!options?.silent) toast.info(t("commissions.noFieldsToSave"));
      return true;
    }

    setIsSaving(true);
    try {
      for (const field of plainFields) {
        const response = await fetch(`/api/commission-intake/records/${view.record.id}/checklists/${view.checklist.id}/fields/${field.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: fieldValues[field.id] ?? null }),
        });
        const payload = await response.json().catch(() => ({})) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? t("commissions.saveFailed"));
      }

      for (const field of tableFields) {
        if (!field.table) continue;
        const response = await fetch(`/api/commission-intake/records/${view.record.id}/checklists/${view.checklist.id}/tables/${field.table.id}/rows`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: tableValues[field.table.id] ?? [] }),
        });
        const payload = await response.json().catch(() => ({})) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? t("commissions.saveFailed"));
      }

      if (!options?.silent) {
        toast.success(t("commissions.saveSuccess"));
      }
      await loadView();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.saveFailed"));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAttachments = async (field: CommissionFormField, files: File[]): Promise<void> => {
    if (!view?.checklist) return;
    if (!files.length) return;
    setUploadingFieldKey(field.key);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fieldKey", field.key);
        formData.append("label", field.label);

        const response = await fetch(`/api/commission-intake/records/${view.record.id}/checklists/${view.checklist.id}/attachments`, {
          method: "POST",
          body: formData,
        });
        const payload = await response.json().catch(() => ({})) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? t("commissions.attachmentUploadFailed"));
      }
      toast.success(files.length > 1 ? t("commissions.attachmentUploadManySuccess") : t("commissions.attachmentUploadSuccess"));
      await loadView();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.attachmentUploadFailed"));
    } finally {
      setUploadingFieldKey(null);
    }
  };

  const deleteAttachment = async (attachmentId: string): Promise<void> => {
    if (!view) return;
    try {
      const response = await fetch(`/api/commission-intake/records/${view.record.id}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? t("commissions.attachmentDeleteFailed"));
      toast.success(t("commissions.attachmentDeleteSuccess"));
      await loadView();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.attachmentDeleteFailed"));
    }
  };

  const saveAndGoToNextPage = async () => {
    if (!nextPage) return;
    const saved = await savePage({ silent: true });
    if (saved) {
      setActivePageId(nextPage.id);
    }
  };

  const requestLeave = (event: ReactMouseEvent<HTMLAnchorElement>, target: string) => {
    if (!isDirty) return;
    event.preventDefault();
    setLeaveTarget(target);
    setLeaveConfirmationOpen(true);
  };

  const leaveChecklist = () => {
    if (!leaveTarget) return;
    setIsDirty(false);
    setLeaveConfirmationOpen(false);
    router.push(leaveTarget);
  };

  const saveAndLeaveChecklist = async () => {
    if (!leaveTarget) return;
    const saved = await savePage({ silent: true });
    if (!saved) return;
    setLeaveConfirmationOpen(false);
    router.push(leaveTarget);
  };

  const signChecklist = async () => {
    if (!view?.checklist) return;
    const saved = await savePage({ silent: true });
    if (!saved) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/commission-intake/records/${view.record.id}/checklists/${view.checklist.id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement: signatureStatement.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? t("commissions.signFailed"));
      setSignatureStatement("");
      toast.success(t("commissions.signSuccess"));
      await loadView();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.signFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const reopenChecklist = async () => {
    if (!view?.checklist) return;
    setIsReopening(true);
    try {
      const response = await fetch(`/api/commission-intake/records/${view.record.id}/checklists/${view.checklist.id}/reopen`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? t("commissions.reopenFailed"));
      toast.success(t("commissions.reopenSuccess"));
      await loadView();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.reopenFailed"));
    } finally {
      setIsReopening(false);
    }
  };

  if (isLoading && !view) {
    return <div className="px-4 py-8 text-sm text-text-muted">{t("commissions.loading")}</div>;
  }

  if (!view) {
    return (
      <Card className="p-5">
        <Text variant="muted">{t("commissions.detailLoadFailed")}</Text>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-clip">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link href={APP_ROUTES.dataCollectionChecklists} onClick={(event) => requestLeave(event, APP_ROUTES.dataCollectionChecklists)} className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-0 text-sm font-bold text-text-secondary transition-colors hover:text-text-primary">
            <ArrowLeft size={16} />
            {t("commissions.back")}
          </Link>
          <div>
            <Text as="h1" variant="h1">{view.record.title}</Text>
            <p className="mt-1 text-sm text-text-muted">{[view.record.companyName, view.record.status].filter(Boolean).join(" - ")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadView()} disabled={isLoading}>
            <RefreshCw size={16} />
            {t("commissions.refresh")}
          </Button>
          <Link href={APP_ROUTES.dataCollectionChecklists} onClick={(event) => requestLeave(event, APP_ROUTES.dataCollectionChecklists)} className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-border-default bg-bg-page px-4 text-sm font-bold text-text-secondary transition-colors hover:bg-bg-subtle">
            {t("checklists.list")}
          </Link>
        </div>
      </header>

      {readOnlyReason ? (
        <Card className="flex items-center gap-3 border-status-warn-text/25 bg-status-warn-bg/40 p-4 text-sm text-status-warn-text">
          <Lock size={18} />
          <span>{readOnlyReason}</span>
        </Card>
      ) : null}

      {isFinalized ? (
        <Card className="flex items-center gap-3 border-status-success-text/25 bg-status-success-bg/30 p-4 text-sm text-status-success-text">
          <CheckCircle2 size={18} />
          <span>{t("commissions.finalizedReadOnly")}</span>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0 space-y-5">
          {view.pages.length ? (
            <Card
              className="sticky top-4 z-20 overflow-visible bg-bg-surface/95 p-4 shadow-elevated backdrop-blur"
              aria-label={t("commissions.chapters")}
            >
              <ChapterSwitcher
                activePageId={activePage?.id ?? null}
                pages={view.pages}
                showLine
                onSelectPage={setActivePageId}
              />
            </Card>
          ) : null}

          {activePage ? (
            <Card className="space-y-5 p-5">
              <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <Text as="h2" variant="h2">{activePage.pageNumber}. {activePage.title}</Text>
                  {activePage.description ? <Text variant="muted" className="mt-1">{activePage.description}</Text> : null}
                </div>
              </div>

              {activePage.sections.length ? (
                activePage.sections.map((section) => (
                  <section key={section.id} className="space-y-3 border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">{section.title}</h3>
                      {section.description ? <p className="mt-1 text-sm text-text-muted">{section.description}</p> : null}
                    </div>
                    {section.fields.length ? (
                      <div className="grid gap-2 xl:grid-cols-2">
                        {section.fields.map((field) => {
                          const tableId = field.table?.id ?? null;
                          return (
                            <FieldEditor
                              key={field.id}
                              attachments={view.attachments}
                              disabled={isReadOnly || isSaving}
                              canConfigureVendorList={view.currentUser.canConfigureVendorList}
                              field={field}
                              showInlineAttachment={isDocumentationPage && isDocumentUploadSlotField(field)}
                              uploadingFieldKey={uploadingFieldKey}
                              value={fieldValues[field.id] ?? null}
                              tableRows={tableId ? tableValues[tableId] ?? [] : []}
                              onDeleteAttachment={(attachmentId) => void deleteAttachment(attachmentId)}
                              onUploadAttachments={(targetField, files) => void uploadAttachments(targetField, files)}
                              onValueChange={(value) => { setIsDirty(true); setFieldValues((current) => ({ ...current, [field.id]: value })); }}
                              onTableChange={(rows) => {
                                if (!tableId) return;
                                setIsDirty(true);
                                setTableValues((current) => ({ ...current, [tableId]: rows }));
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-[var(--radius-md)] border border-dashed border-border-default px-4 py-3 text-sm text-text-muted">{t("commissions.fieldsPending")}</p>
                    )}
                  </section>
                ))
              ) : (
                <p className="rounded-[var(--radius-md)] border border-dashed border-border-default px-4 py-3 text-sm text-text-muted">{t("commissions.sectionsPending")}</p>
              )}
            </Card>
          ) : null}
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <ClipboardList size={18} className="mt-0.5 text-brand-primary" />
              <div className="min-w-0">
                <Text as="h2" variant="h2">{view.checklist?.title ?? t("commissions.noChecklistTitle")}</Text>
                <Text variant="muted">{view.checklist ? t("commissions.progress", { value: String(view.checklist.progressPercent) }) : t("commissions.noChecklist")}</Text>
              </div>
            </div>
            {view.checklist ? (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-bg-muted">
                  <div className="h-full bg-brand-primary" style={{ width: `${view.checklist.progressPercent}%` }} />
                </div>
                {activePageStats ? (
                  <p className="text-xs font-semibold text-text-muted">
                    {t("commissions.pageCompletion", {
                      completed: String(activePageStats.completed),
                      page: String(activePage?.pageNumber ?? ""),
                      total: String(activePageStats.total),
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Save size={16} className="text-brand-primary" />
              <h3 className="text-sm font-bold text-text-primary">{t("commissions.actions")}</h3>
            </div>
            <div className="grid gap-2">
              <Button variant="outline" onClick={() => previousPage ? setActivePageId(previousPage.id) : undefined} disabled={!previousPage || isSaving}>
                <ArrowLeft size={16} />
                {t("commissions.previousPage")}
              </Button>
              <Button variant="outline" onClick={() => void savePage()} disabled={isReadOnly || isSaving}>
                <Save size={16} />
                Salva tutto
              </Button>
              {isFinalized && view.currentUser.canReopenSignedChecklist ? (
                <Button variant="outline" onClick={() => void reopenChecklist()} disabled={isReopening}>
                  <RefreshCw size={16} />
                  {t("commissions.reopen")}
                </Button>
              ) : null}
              {nextPage ? (
                <Button onClick={() => void saveAndGoToNextPage()} disabled={isReadOnly || isSaving}>
                  {t("commissions.saveAndNext")}
                  <ArrowRight size={16} />
                </Button>
              ) : null}
            </div>
          </Card>

          {!isDocumentationPage && activePageAttachmentFields.length ? (
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Paperclip size={16} className="text-brand-primary" />
                <h3 className="text-sm font-bold text-text-primary">{t("commissions.attachments")}</h3>
              </div>
              <AttachmentPanel
                attachments={view.attachments}
                disabled={isReadOnly || isSaving}
                fields={activePageAttachmentFields}
                fieldValues={fieldValues}
                uploadingFieldKey={uploadingFieldKey}
                onDeleteAttachment={(attachmentId) => void deleteAttachment(attachmentId)}
                onUpload={(field, files) => void uploadAttachments(field, files)}
              />
            </Card>
          ) : null}

          {view.checklist && isLastPage ? (
            <Card className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Signature size={18} className="text-brand-primary" />
                <Text as="h2" variant="h2">{t("commissions.signature")}</Text>
              </div>
              <Text variant="muted">{t("commissions.signatureFinalHint")}</Text>
              <label className="space-y-2">
                <span className="block text-sm font-bold text-text-primary">{t("commissions.signerName")}</span>
                <Input value={signatureName} readOnly disabled={isReadOnly || isSaving} />
              </label>
              <textarea
                value={signatureStatement}
                onChange={(event) => { setIsDirty(true); setSignatureStatement(event.target.value); }}
                placeholder={t("commissions.signatureStatement")}
                disabled={isReadOnly || isSaving}
                className="min-h-24 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:opacity-60"
              />
              <Button className="w-full" onClick={() => void signChecklist()} disabled={isReadOnly || isSaving}>
                <CheckCircle2 size={16} />
                {t("commissions.signAndFinalize")}
              </Button>
              {view.signatures.length ? (
                <div className="space-y-2 border-t border-border-subtle pt-3">
                  {view.signatures.map((signature) => (
                    <div key={signature.id} className="text-sm text-text-secondary">
                      <span className="font-bold text-text-primary">{signature.signerName}</span>
                      <span className="text-text-muted"> - {new Date(signature.signedAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ) : null}
        </aside>
      </div>
      {completionIssues ? (
        <CompletionIssuesDialog issues={completionIssues} onClose={() => setCompletionIssues(null)} />
      ) : null}
      {leaveConfirmationOpen ? (
        <ChecklistLeaveDialog
          isSaving={isSaving}
          onCancel={() => {
            setLeaveConfirmationOpen(false);
            setLeaveTarget(null);
          }}
          onDiscard={leaveChecklist}
          onSave={saveAndLeaveChecklist}
        />
      ) : null}
    </div>
  );
}

function FieldEditor({
  attachments = [],
  canConfigureVendorList = false,
  disabled,
  field,
  onDeleteAttachment,
  onUploadAttachments,
  onTableChange,
  onValueChange,
  showInlineAttachment = false,
  tableRows,
  uploadingFieldKey,
  value,
}: {
  attachments?: CommissionAttachment[];
  canConfigureVendorList?: boolean;
  disabled: boolean;
  field: CommissionFormField;
  onDeleteAttachment?: (attachmentId: string) => void;
  onUploadAttachments?: (field: CommissionFormField, files: File[]) => void;
  onTableChange: (rows: EditableTableRow[]) => void;
  onValueChange: (value: unknown) => void;
  showInlineAttachment?: boolean;
  tableRows: EditableTableRow[];
  uploadingFieldKey?: string | null;
  value: unknown;
}) {
  const { t } = useLanguage();
  const fieldUnit = getUnitMeta(field.label);
  const label = `${fieldUnit.label}${field.required ? " *" : ""}`;
  const fieldLayoutClassName = getFieldLayoutClass(field);
  const fieldAttachments = attachments.filter((attachment) => attachment.fieldKey === field.key);
  const canRenderInlineAttachment = showInlineAttachment && onUploadAttachments && onDeleteAttachment;

  if (field.fieldType === "TABLE" && field.table) {
    const displayedRows = tableRows.length ? tableRows : buildDefaultEditableRows(field.table.defaultRows);
    const rowsForEdit = displayedRows.length ? displayedRows : [{ rowKey: null, cells: {} }];
    const visibleColumns = getVisibleTableColumns(field);
    const isGroupedTable = isGroupedChecklistTable(field);
    const deleteLastRow = () => {
      if (rowsForEdit.length <= (field.table?.minRows ?? 0)) return;
      const lastRow = rowsForEdit[rowsForEdit.length - 1];
      onTableChange(rowsForEdit.slice(0, -1));
    };
    return (
      <div className="min-w-0 space-y-3 rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <label className="text-sm font-bold text-text-primary">{label}</label>
            {field.helpText ? <p className="text-xs text-text-muted">{field.helpText}</p> : null}
          </div>
          {field.table.allowAddRows && !isGroupedTable ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" disabled={disabled || rowsForEdit.length <= (field.table.minRows ?? 0)} onClick={deleteLastRow}>
                <Trash2 size={14} />
                {t("commissions.deleteLastRow")}
              </Button>
              <Button size="sm" variant="outline" disabled={disabled || (field.table.maxRows !== null && rowsForEdit.length >= field.table.maxRows)} onClick={() => onTableChange([...rowsForEdit, { rowKey: null, cells: {} }])}>
                <Plus size={14} />
                {t("commissions.addRow")}
              </Button>
            </div>
          ) : null}
        </div>
        {isVendorListTable(field) ? (
          <VendorChecklistTable canConfigureVendorList={canConfigureVendorList} disabled={disabled} field={field} onTableChange={onTableChange} rows={rowsForEdit} />
        ) : isGroupedTable ? (
          <GroupedChecklistTable canConfigureVendorList={canConfigureVendorList} disabled={disabled} field={field} onTableChange={onTableChange} rows={rowsForEdit} />
        ) : (
        <div className="min-w-0 overflow-x-auto">
          <div className="min-w-0 space-y-2">
            <div className="grid min-w-0 gap-2" style={{ gridTemplateColumns: getTableGridTemplate(visibleColumns) }}>
              {visibleColumns.map((column) => (
                <span key={column.id} className="text-xs font-bold uppercase text-text-muted">{getUnitMeta(column.label).label}{column.required ? " *" : ""}</span>
              ))}
            </div>
            {rowsForEdit.map((row, rowIndex) => (
              <div key={`${field.id}-${rowIndex}`} className="grid min-w-0 gap-2" style={{ gridTemplateColumns: getTableGridTemplate(visibleColumns) }}>
                {visibleColumns.map((column) => (
                  isManualAutomaticColumn(column.label) ? (
                    <ManualAutomaticSwitch
                      key={column.id}
                      disabled={disabled}
                      value={unknownToInputValue(row.cells[column.key])}
                      onChange={(nextValue) => {
                        const nextRows = rowsForEdit.map((editableRow) => ({ ...editableRow, cells: { ...editableRow.cells } }));
                        nextRows[rowIndex] = {
                          ...nextRows[rowIndex],
                          cells: { ...nextRows[rowIndex].cells, [column.key]: nextValue },
                        };
                        onTableChange(nextRows);
                      }}
                    />
                  ) : isConfirmedColumn(column) ? (
                    <ConfirmedToggle
                      key={column.id}
                      disabled={disabled}
                      value={row.cells[column.key]}
                      onChange={(nextValue) => {
                        const nextRows = rowsForEdit.map((editableRow) => ({ ...editableRow, cells: { ...editableRow.cells } }));
                        nextRows[rowIndex] = {
                          ...nextRows[rowIndex],
                          cells: { ...nextRows[rowIndex].cells, [column.key]: nextValue },
                        };
                        onTableChange(nextRows);
                      }}
                    />
                  ) : (
                    <TableCellInput
                      key={column.id}
                      column={column}
                      placeholder={column.placeholder ?? undefined}
                      value={unknownToInputValue(row.cells[column.key])}
                      disabled={disabled || (isVendorListTable(field) && !isOtherCategory(unknownToInputValue(row.cells.col_1_categoria)) && column.key === "col_2_componente")}
                      className={isVendorListTable(field) && column.key === "col_3_marche_di_riferimento" ? "placeholder:opacity-40" : undefined}
                      onChange={(event) => {
                        const nextRows = rowsForEdit.map((editableRow) => ({ ...editableRow, cells: { ...editableRow.cells } }));
                        nextRows[rowIndex] = {
                          ...nextRows[rowIndex],
                          cells: { ...nextRows[rowIndex].cells, [column.key]: event.target.value },
                        };
                        onTableChange(nextRows);
                      }}
                    />
                  )
                ))}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    );
  }

  if (field.fieldType === "SIGNATURE") {
    return null;
  }

  return (
    <div className={cn("min-w-0 space-y-2 rounded-[var(--radius-md)] border border-transparent p-2", fieldLayoutClassName)}>
      <span className="block text-sm font-bold text-text-primary">{label}</span>
      {field.helpText ? <span className="block text-xs text-text-muted bg-bg-page">{field.helpText}</span> : null}
      {canRenderInlineAttachment ? null : renderControl({ disabled, field, value, onValueChange })}
      {canRenderInlineAttachment ? (
        <CompactAttachmentControl
          attachments={fieldAttachments}
          disabled={disabled}
          enabled={true}
          field={field}
          uploading={uploadingFieldKey === field.key}
          onDeleteAttachment={onDeleteAttachment}
          onUpload={onUploadAttachments}
        />
      ) : null}
    </div>
  );
}

function ChapterSwitcher({
  activePageId,
  compact = false,
  onSelectPage,
  pages,
  showLine = false,
}: {
  activePageId: string | null;
  compact?: boolean;
  onSelectPage: (pageId: string) => void;
  pages: CommissionFormPage[];
  showLine?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative grid w-full grid-cols-8 gap-2 md:grid-cols-16">
      {showLine ? (
        <div className="pointer-events-none absolute left-5 right-5 top-5 h-px bg-border-default" aria-hidden="true" />
      ) : null}
      {pages.map((page, pageIndex) => (
        <div key={page.id} className="group relative z-10 justify-self-center">
          <button
            type="button"
            aria-label={t("commissions.openChapter", {
              value: String(page.pageNumber),
              title: page.title,
            })}
            onClick={() => onSelectPage(page.id)}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border font-bold transition-all",
              compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
              activePageId === page.id
                ? "border-brand-primary bg-brand-primary text-text-inverse"
                : "border-border-default bg-bg-surface text-text-secondary hover:bg-bg-subtle",
            )}
          >
            <span>{page.pageNumber}</span>
          </button>
          <span className={cn(
            "pointer-events-none absolute bottom-full z-30 mb-2 hidden w-80 max-w-[min(20rem,calc(100vw-3rem))] rounded-[var(--radius-sm)] border border-border-default bg-bg-surface px-3 py-1.5 text-center text-xs font-semibold leading-snug text-text-primary shadow-elevated group-hover:block",
            pageIndex === 0
              ? "left-0"
              : pageIndex === pages.length - 1
                ? "right-0"
                : "left-1/2 -translate-x-1/2",
          )}>
            {page.title}
          </span>
        </div>
      ))}
    </div>
  );
}

function AttachmentPanel({
  attachments,
  disabled,
  fields,
  fieldValues,
  onDeleteAttachment,
  onUpload,
  uploadingFieldKey,
}: {
  attachments: CommissionAttachment[];
  disabled: boolean;
  fields: CommissionFormField[];
  fieldValues: Record<string, unknown>;
  onDeleteAttachment: (attachmentId: string) => void;
  onUpload: (field: CommissionFormField, files: File[]) => void;
  uploadingFieldKey: string | null;
}) {
  const { t } = useLanguage();

  if (!fields.length) {
    return <p className="text-sm text-text-muted">{t("commissions.noPageAttachments")}</p>;
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const enabled = isAffirmativeValue(fieldValues[field.id]);
        const fieldAttachments = attachments.filter((attachment) => attachment.fieldKey === field.key);
        return (
          <div key={field.id} className="space-y-2 rounded-[var(--radius-md)] border border-border-subtle bg-bg-page p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary">{getUnitMeta(field.label).label}</p>
                <p className="text-xs text-text-muted">
                  {enabled ? t("commissions.attachmentEnabled") : t("commissions.attachmentDisabled")}
                </p>
                <p className={cn(
                  "text-xs font-semibold",
                  fieldAttachments.length ? "text-status-success-text" : "text-status-warn-text",
                )}>
                  {fieldAttachments.length
                    ? t("commissions.attachmentLoadedCount", { count: fieldAttachments.length })
                    : t("commissions.attachmentMissing")}
                </p>
              </div>
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                enabled ? "bg-status-success-bg text-status-success-text" : "bg-bg-muted text-text-muted",
              )}>
                {enabled ? "SI" : "NO"}
              </span>
            </div>

            <label className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-dashed px-3 text-sm font-bold transition-colors",
              enabled && !disabled ? "border-brand-primary text-brand-primary hover:bg-bg-subtle" : "cursor-not-allowed border-border-default text-text-muted opacity-70",
            )}>
              <input
                type="file"
                multiple
                className="hidden"
                disabled={!enabled || disabled || uploadingFieldKey === field.key}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (!files.length) return;
                  onUpload(field, files);
                }}
              />
              {uploadingFieldKey === field.key
                ? t("commissions.attachmentUploading")
                : fieldAttachments.length
                  ? t("commissions.attachmentUploadMore")
                  : t("commissions.attachmentUpload")}
            </label>

            {fieldAttachments.length ? (
              <div className="space-y-2">
                {fieldAttachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border-subtle bg-bg-surface px-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{attachment.fileName ?? t("commissions.attachmentUnnamed")}</p>
                      <p className="text-xs text-text-muted">{formatFileSize(attachment.sizeBytes)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onDeleteAttachment(attachment.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-bg-muted hover:text-status-danger-text disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={t("commissions.deleteAttachment")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CompactAttachmentControl({
  attachments,
  disabled,
  enabled,
  field,
  onDeleteAttachment,
  onUpload,
  uploading,
}: {
  attachments: CommissionAttachment[];
  disabled: boolean;
  enabled: boolean;
  field: CommissionFormField;
  onDeleteAttachment: (attachmentId: string) => void;
  onUpload: (field: CommissionFormField, files: File[]) => void;
  uploading: boolean;
}) {
  const { t } = useLanguage();
  const attachmentTitle = attachments
    .map((attachment) => attachment.fileName ?? t("commissions.attachmentUnnamed"))
    .join("\n");

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-bg-page px-2 py-2">
      <label className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 text-xs font-bold transition-colors",
        enabled && !disabled ? "border-brand-primary text-brand-primary hover:bg-bg-subtle" : "cursor-not-allowed border-border-default text-text-muted opacity-70",
      )}>
        <input
          type="file"
          multiple
          className="hidden"
          disabled={!enabled || disabled || uploading}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (!files.length) return;
            onUpload(field, files);
          }}
        />
        <Paperclip size={13} />
        {uploading
          ? t("commissions.attachmentUploading")
          : attachments.length
            ? t("commissions.attachmentUploadMore")
            : t("commissions.attachmentUpload")}
      </label>
      <span
        className={cn(
          "min-w-0 truncate text-xs font-semibold",
          attachments.length ? "text-status-success-text" : "text-text-muted",
        )}
        title={attachmentTitle || undefined}
      >
        {attachments.length
          ? t("commissions.attachmentLoadedCount", { count: attachments.length })
          : t("commissions.attachmentMissing")}
      </span>
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          disabled={disabled}
          title={attachment.fileName ?? t("commissions.attachmentUnnamed")}
          onClick={() => onDeleteAttachment(attachment.id)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-text-muted transition-colors hover:bg-bg-muted hover:text-status-danger-text disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={t("commissions.deleteAttachment")}
        >
          <Trash2 size={13} />
        </button>
      ))}
    </div>
  );
}

function CompletionIssuesDialog({ issues, onClose }: { issues: CompletionIssue[]; onClose: () => void }) {
  const { t } = useLanguage();
  const shownIssues = issues.slice(0, 30);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-border-default bg-bg-surface shadow-elevated" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-border-subtle p-4">
          <h2 className="text-lg font-bold text-text-primary">{issues.length ? t("commissions.completionIssuesTitle") : t("commissions.completionCompleteTitle")}</h2>
          <p className="mt-1 text-sm text-text-muted">
            {issues.length ? t("commissions.completionIssuesHint") : t("commissions.completionCompleteHint")}
          </p>
        </div>
        {issues.length ? (
          <div className="max-h-[52vh] overflow-auto p-4">
            <div className="space-y-2">
              {shownIssues.map((issue, index) => (
                <div key={`${issue.pageNumber}-${issue.sectionTitle}-${issue.label}-${index}`} className="rounded-[var(--radius-md)] border border-border-subtle bg-bg-page px-3 py-2">
                  <p className="text-xs font-bold uppercase text-text-muted">{t("commissions.chapter")} {issue.pageNumber} - {issue.sectionTitle}</p>
                  <p className="text-sm font-semibold text-text-primary">{issue.label}</p>
                </div>
              ))}
            </div>
            {issues.length > shownIssues.length ? (
              <p className="mt-3 text-sm text-text-muted">{t("commissions.completionIssuesMore", { value: String(issues.length - shownIssues.length) })}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end border-t border-border-subtle p-4">
          <Button onClick={onClose}>{t("common.close")}</Button>
        </div>
      </div>
    </div>
  );
}

function ChecklistLeaveDialog({
  isSaving,
  onCancel,
  onDiscard,
  onSave,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="checklist-leave-title" onMouseDown={onCancel}>
      <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-border-default bg-bg-surface shadow-elevated" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border-subtle p-4">
          <BirgusLogo className="h-9 w-9 shrink-0" />
          <div>
            <p className="text-sm font-bold text-brand-primary">Birgus dice:</p>
            <h2 id="checklist-leave-title" className="text-lg font-bold text-text-primary">Modifiche non salvate</h2>
          </div>
        </div>
        <p className="p-4 text-sm text-text-secondary">Salva le modifiche prima di uscire oppure scartale definitivamente.</p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle p-4">
          <Button variant="outline" disabled={isSaving} onClick={onCancel}>Continua modifica</Button>
          <Button variant="danger" disabled={isSaving} onClick={onDiscard}>Scarta</Button>
          <Button disabled={isSaving} onClick={() => void onSave()}><Save size={16} />Salva e esci</Button>
        </div>
      </div>
    </div>
  );
}

function renderControl({
  disabled,
  field,
  onValueChange,
  value,
}: {
  disabled: boolean;
  field: CommissionFormField;
  onValueChange: (value: unknown) => void;
  value: unknown;
}) {
  if (field.fieldType === "LONG_TEXT") {
    return (
      <textarea
        value={unknownToInputValue(value)}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        className="min-h-28 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:opacity-60"
      />
    );
  }

  if (field.fieldType === "BOOLEAN") {
    return <CheckboxControl checked={value === true} disabled={disabled} onChange={(event) => onValueChange(event.target.checked)} />;
  }

  if (isYesNoOptionSet(field)) {
    return <YesNoChoiceControl disabled={disabled} field={field} value={value} onValueChange={onValueChange} />;
  }

  if (field.fieldType === "SELECT") {
    return (
      <SelectDropdown
        allowEmpty
        disabled={disabled}
        value={unknownToInputValue(value)}
        placeholder="Seleziona"
        onChange={(nextValue) => onValueChange(nextValue || null)}
        options={field.options.map((option) => ({ label: option.label, value: option.value }))}
      />
    );
  }

  if (field.fieldType === "MULTI_SELECT" || field.fieldType === "CHECKBOX_GROUP" || field.fieldType === "DOCUMENT_CHECKLIST") {
    const selectedValues = Array.isArray(value) ? value.map(String) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((option) => (
          <Checkbox
            key={option.id}
            checked={selectedValues.includes(option.value)}
            disabled={disabled}
            label={option.label}
            onChange={(event) => {
              const next = event.target.checked
                ? [...selectedValues, option.value]
                : selectedValues.filter((item) => item !== option.value);
              onValueChange(next);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <UnitInput
      unit={getUnitMeta(field.label).unit}
      type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
      value={unknownToInputValue(value)}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={disabled}
      className="min-w-0"
    />
  );
}

function UnitInput({ unit, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { unit: string | null }) {
  if (!unit) {
    return <Input {...props} className={cn("min-w-0", className)} />;
  }

  return (
    <div className="flex min-w-0">
      <Input {...props} className={cn("min-w-0 rounded-r-none border-r-0", className)} />
      <span className="flex h-11 shrink-0 items-center rounded-r-[var(--radius-md)] border border-border-default bg-bg-page px-3 text-sm font-bold text-text-muted">
        {unit}
      </span>
    </div>
  );
}

function YesNoChoiceControl({ disabled, field, onValueChange, value }: { disabled: boolean; field: CommissionFormField; onValueChange: (value: unknown) => void; value: unknown }) {
  const selected = selectedChoiceValue(value);
  const quantitySelected = isQuantityChoice(selected);
  const quantity = quantityValue(value);
  const storesArray = field.fieldType !== "SELECT";
  const setSelection = (next: string) => {
    if (!next) return onValueChange(storesArray ? [] : null);
    if (isQuantityChoice(next)) return onValueChange({ selection: next, quantity: quantity || "" });
    onValueChange(storesArray ? [next] : next);
  };
  return <div className="flex flex-wrap items-end gap-2"><div className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-border-default">{field.options.map((option) => <button key={option.id} type="button" disabled={disabled} aria-pressed={selected === option.value} onClick={() => setSelection(option.value)} className={cn("h-10 border-r border-border-default px-3 text-sm font-semibold last:border-r-0 disabled:cursor-not-allowed disabled:opacity-60", selected === option.value ? "bg-brand-primary text-text-inverse" : "bg-bg-page text-text-secondary hover:bg-bg-subtle")}>{option.label}</button>)}</div>{quantitySelected ? <label className="block min-w-32 text-xs font-semibold text-text-muted">Quantità<Input type="number" min="0" step="1" disabled={disabled} value={quantity} onChange={(event) => onValueChange({ selection: selected, quantity: event.target.value })} className="mt-1" /></label> : null}</div>;
}

function TableCellInput({ column, className, placeholder, ...props }: InputHTMLAttributes<HTMLInputElement> & { column: CommissionTableColumn }) {
  return <UnitInput {...props} placeholder={placeholder ?? column.placeholder ?? undefined} unit={getUnitMeta(column.label).unit} className={cn("px-3", className)} />;
}

function ConfirmedToggle({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string | null) => void;
  value: unknown;
}) {
  const confirmed = isConfirmedValue(value);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(confirmed ? null : "Confermato")}
      className={cn(
        "h-11 rounded-[var(--radius-md)] border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        confirmed
          ? "border-status-success-text/25 bg-status-success-bg text-status-success-text"
          : "border-border-default bg-bg-muted text-text-muted hover:text-text-primary",
      )}
    >
      {confirmed ? "Confermato" : "Non presente"}
    </button>
  );
}

function PriorityToggle({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  value: unknown;
}) {
  const priorities = ["Bassa", "Media", "Alta"];
  const current = priorities.includes(unknownToInputValue(value)) ? unknownToInputValue(value) : "Bassa";
  const nextPriority = priorities[(priorities.indexOf(current) + 1) % priorities.length];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(nextPriority)}
      className={cn(
        "h-11 rounded-[var(--radius-md)] border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        current === "Alta"
          ? "border-status-danger-text/25 bg-status-danger-bg text-status-danger-text"
          : current === "Media"
            ? "border-status-warn-text/25 bg-status-warn-bg/50 text-status-warn-text"
            : "border-border-default bg-bg-muted text-text-muted hover:text-text-primary",
      )}
    >
      {current}
    </button>
  );
}

function ManualAutomaticSwitch({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const options = ["Manuale", "Automatico"];
  return (
    <div className="grid h-11 min-w-0 grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-bg-muted p-1">
      {options.map((option) => {
        const isActive = value === option || (option === "Automatico" && value === "Auto");
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-[var(--radius-sm)] px-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isActive ? "bg-brand-primary text-text-inverse" : "text-text-muted hover:text-text-primary",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function isManualAutomaticColumn(label: string): boolean {
  const normalized = label.toLowerCase();
  return normalized.includes("manuale") && (normalized.includes("auto") || normalized.includes("automatico"));
}

function isConfirmedColumn(column: CommissionTableColumn): boolean {
  return column.label.toLowerCase().includes("confermato");
}

function isPriorityColumn(column: CommissionTableColumn): boolean {
  return normalizeLoose(column.label) === "priorita";
}

function isConfirmedValue(value: unknown): boolean {
  const normalized = unknownToInputValue(value).toLowerCase();
  return normalized === "true" || normalized === "si" || normalized === "sì" || normalized === "confermato";
}

function isVendorListTable(field: CommissionFormField): boolean {
  return Boolean(field.table?.key.includes("vendor_list"));
}

function isAutomationOperationsTable(field: CommissionFormField): boolean {
  return Boolean(field.table?.key.includes("operazioni_da_automatizzare"));
}

function isGroupedChecklistTable(field: CommissionFormField): boolean {
  return isVendorListTable(field) || isAutomationOperationsTable(field);
}

function getVisibleTableColumns(field: CommissionFormField): CommissionTableColumn[] {
  if (!field.table) return [];
  if (!isGroupedChecklistTable(field)) return field.table.columns;
  return field.table.columns
    .filter((column) => column.key !== "col_1_categoria")
    .map((column) => column.key === "col_5_altro" ? { ...column, label: "Note", placeholder: column.placeholder ?? "Note" } : column);
}

function groupChecklistRows(rows: EditableTableRow[]): Array<{ category: string; note: string; items: Array<{ row: EditableTableRow; rowIndex: number }> }> {
  const groups = new Map<string, { note: string; items: Array<{ row: EditableTableRow; rowIndex: number }> }>();
  rows.forEach((row, rowIndex) => {
    const category = unknownToInputValue(row.cells.col_1_categoria) || "Da classificare";
    const current = groups.get(category) ?? { note: unknownToInputValue(row.cells._vendor_category_note), items: [] };
    groups.set(category, { ...current, items: [...current.items, { row, rowIndex }] });
  });
  return [...groups.entries()].map(([category, group]) => ({ category, note: group.note, items: group.items }));
}

function VendorChecklistTable({
  canConfigureVendorList,
  disabled,
  field,
  onTableChange,
  rows,
}: {
  canConfigureVendorList: boolean;
  disabled: boolean;
  field: CommissionFormField;
  onTableChange: (rows: EditableTableRow[]) => void;
  rows: EditableTableRow[];
}) {
  const [isVendorEditorOpen, setIsVendorEditorOpen] = useState(false);
  const groups = ensureOtherGroup(groupChecklistRows(rows));
  const updateRow = (rowIndex: number, patch: Record<string, unknown>) => onTableChange(rows.map((row, index) => index === rowIndex ? { ...row, cells: { ...row.cells, ...patch } } : row));

  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => downloadVendorListHtml(groups)}><Download size={14} />Esporta HTML</Button>
      {canConfigureVendorList ? <Button size="sm" variant="outline" onClick={() => setIsVendorEditorOpen(true)}><Pencil size={14} />Modifica Vendor List</Button> : null}
    </div>
    {groups.map((group) => <section key={group.category} className="min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface">
      <div className="border-b border-border-subtle bg-bg-muted/50 px-3 py-2"><span className="text-xs font-bold uppercase text-brand-primary">{group.category}</span></div>
      <div className="min-w-0 overflow-x-auto"><div className="min-w-[760px]">
        <div className="grid grid-cols-[52px_minmax(180px,0.9fr)_minmax(220px,1.1fr)_minmax(260px,1.2fr)] gap-3 border-b border-border-subtle bg-bg-muted/30 px-3 py-2 text-xs font-bold uppercase text-text-muted"><span className="text-center" title="Componente presente"><Check size={15} className="mx-auto" /></span><span>Componente</span><span>Marche di riferimento</span><span>Selezione cliente</span></div>
        {group.items.map(({ row, rowIndex }) => {
          const isOther = isOtherCategory(group.category);
          const brandsText = unknownToInputValue(row.cells._vendor_reference_brands) || unknownToInputValue(row.cells.col_3_marche_di_riferimento) || getTableCellPlaceholder(row, field.table!.columns.find((column) => column.key === "col_3_marche_di_riferimento")! ) || "";
          const brands = splitVendorBrands(brandsText);
          const present = isConfirmedValue(row.cells.col_4_confermato);
          const selection = parseVendorSelection(row.cells.col_5_altro);
          const selectBrand = (brand: string | null) => updateRow(rowIndex, { col_4_confermato: brand ? "true" : "", col_5_altro: brand ? JSON.stringify({ brand, otherBrand: brand === "__other__" ? selection.otherBrand : "" }) : "" });
          return <div key={`${field.id}-${rowIndex}`} className="grid grid-cols-[52px_minmax(180px,0.9fr)_minmax(220px,1.1fr)_minmax(260px,1.2fr)] gap-3 border-b border-border-subtle px-3 py-3 last:border-b-0">
            <button type="button" disabled={disabled} title={present ? "Componente presente" : "Componente non presente"} aria-label={present ? "Componente presente" : "Componente non presente"} aria-pressed={present} onClick={() => updateRow(rowIndex, { col_4_confermato: present ? "" : "true", col_5_altro: present ? "" : row.cells.col_5_altro })} className={cn("mx-auto flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border transition-colors disabled:opacity-60", present ? "border-status-success-text bg-status-success-bg text-status-success-text" : "border-border-default bg-bg-page text-transparent hover:border-brand-primary")}><Check size={16} strokeWidth={3} /></button>
            {isOther ? <Input disabled={disabled} value={unknownToInputValue(row.cells.col_2_componente)} placeholder="Componente" onChange={(event) => updateRow(rowIndex, { col_2_componente: event.target.value })} /> : <span className="pt-2 text-sm font-semibold text-text-primary">{unknownToInputValue(row.cells.col_2_componente)}</span>}
            {isOther ? <Input disabled={disabled} value={brandsText} placeholder="Marche di riferimento" onChange={(event) => updateRow(rowIndex, { col_3_marche_di_riferimento: event.target.value })} /> : <span className="pt-2 text-sm leading-5 text-text-secondary">{brandsText}</span>}
            <div className="space-y-1.5">{brands.map((brand) => <button key={brand} type="button" disabled={disabled} role="checkbox" aria-checked={selection.brand === brand} onClick={() => selectBrand(selection.brand === brand ? null : brand)} className="flex w-full items-start gap-2 text-left text-xs text-text-secondary disabled:opacity-60"><span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border", selection.brand === brand ? "border-brand-primary bg-brand-primary text-text-inverse" : "border-border-default bg-bg-page text-transparent")}><Check size={12} strokeWidth={3} /></span><span>{brand}</span></button>)}<div className="mt-2 border-t border-dashed border-border-default pt-2"><label className="flex items-center gap-2 text-xs text-text-secondary"><button type="button" disabled={disabled} role="checkbox" aria-checked={selection.brand === "__other__"} onClick={() => selectBrand(selection.brand === "__other__" ? null : "__other__")} className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border", selection.brand === "__other__" ? "border-brand-primary bg-brand-primary text-text-inverse" : "border-border-default bg-bg-page text-transparent")}><Check size={12} strokeWidth={3} /></button>Altro</label><Input className="mt-1 h-9" disabled={disabled || selection.brand !== "__other__"} value={selection.otherBrand} placeholder="Marca non in elenco" onChange={(event) => updateRow(rowIndex, { col_4_confermato: "true", col_5_altro: JSON.stringify({ brand: "__other__", otherBrand: event.target.value }) })} /></div></div>
          </div>;
        })}
      </div></div>
    </section>)}
    {isVendorEditorOpen ? <VendorListEditorDialog onClose={() => setIsVendorEditorOpen(false)} /> : null}
  </div>;
}

function splitVendorBrands(value: string): string[] {
  const result: string[] = []; let current = ""; let depth = 0;
  for (const character of value) { if (character === "(") depth += 1; if (character === ")") depth = Math.max(0, depth - 1); if (character === "," && depth === 0) { if (current.trim()) result.push(current.trim()); current = ""; } else current += character; }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseVendorSelection(value: unknown): { brand: string | null; otherBrand: string } {
  const raw = unknownToInputValue(value); if (!raw) return { brand: null, otherBrand: "" };
  try { const parsed = JSON.parse(raw) as { brand?: unknown; otherBrand?: unknown }; return { brand: typeof parsed.brand === "string" ? parsed.brand : null, otherBrand: typeof parsed.otherBrand === "string" ? parsed.otherBrand : "" }; } catch { return { brand: "__other__", otherBrand: raw }; }
}

function downloadVendorListHtml(groups: Array<{ category: string; note: string; items: Array<{ row: EditableTableRow; rowIndex: number }> }>): void {
  const sections = groups.map((group) => {
    const rows = group.items.map(({ row }) => {
      const component = unknownToInputValue(row.cells.col_2_componente).trim();
      const present = isConfirmedValue(row.cells.col_4_confermato);
      const selection = parseVendorSelection(row.cells.col_5_altro);
      const brand = selection.brand === "__other__" ? selection.otherBrand.trim() : selection.brand;
      if (!component || (!present && !brand)) return "";
      const detail = brand ? `: ${escapeHtml(brand)}` : "";
      const status = present ? "" : " <span>(non presente)</span>";
      return `<li><strong>${escapeHtml(component)}</strong>${detail}${status}</li>`;
    }).filter(Boolean).join("\n");
    return rows ? `<section><h2>${escapeHtml(group.category)}</h2><ul>${rows}</ul></section>` : "";
  }).filter(Boolean).join("\n");
  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vendor List</title><style>body{font-family:Arial,sans-serif;color:#172033;max-width:900px;margin:40px auto;padding:0 24px}h1{font-size:24px;margin:0 0 28px}h2{font-size:16px;margin:26px 0 8px;padding-bottom:6px;border-bottom:1px solid #d9dee8}ul{margin:0;padding-left:22px}li{margin:7px 0}span{color:#667085;font-size:13px}</style></head><body><h1>Vendor List</h1>${sections || "<p>Nessuna selezione compilata.</p>"}</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "vendor-list.html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function GroupedChecklistTable({
  canConfigureVendorList,
  disabled,
  field,
  onTableChange,
  rows,
}: {
  canConfigureVendorList: boolean;
  disabled: boolean;
  field: CommissionFormField;
  onTableChange: (rows: EditableTableRow[]) => void;
  rows: EditableTableRow[];
}) {
  const { t } = useLanguage();
  const columns = getVisibleTableColumns(field);
  const groups = ensureOtherGroup(groupChecklistRows(rows));
  const [isVendorEditorOpen, setIsVendorEditorOpen] = useState(false);
  const addOtherRow = () => {
    onTableChange([...rows, { rowKey: null, cells: buildOtherTableRowCells(field) }]);
  };
  const deleteLastOtherRow = () => {
    const lastOtherIndex = findLastOtherRowIndex(rows);
    if (lastOtherIndex < 0) return;
    const lastRow = rows[lastOtherIndex];
    onTableChange(rows.filter((_, rowIndex) => rowIndex !== lastOtherIndex));
  };

  return (
    <div className="min-w-0 space-y-4">
      {isVendorListTable(field) && canConfigureVendorList ? (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setIsVendorEditorOpen(true)}>
            <Pencil size={14} />
            Modifica Vendor List
          </Button>
        </div>
      ) : null}
      {groups.map((group) => (
        <div key={group.category} className="min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted/50 px-3 py-2">
            <div className="min-w-0"><span className="text-xs font-bold uppercase text-brand-primary">{group.category}</span>{group.note ? <p className="mt-1 text-xs text-text-muted">{group.note}</p> : null}</div>
            {isOtherCategory(group.category) ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="outline" disabled={disabled || findLastOtherRowIndex(rows) < 0} onClick={deleteLastOtherRow}>
                  <Trash2 size={14} />
                  {t("commissions.deleteLastRow")}
                </Button>
                <Button size="sm" variant="outline" disabled={disabled} onClick={addOtherRow}>
                  <Plus size={14} />
                  {t("commissions.addRow")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="min-w-0 overflow-x-auto p-3">
            <div className="min-w-[720px] space-y-2">
              <div className="grid min-w-0 gap-2" style={{ gridTemplateColumns: getTableGridTemplate(columns) }}>
                {columns.map((column) => (
                  <span key={column.id} className="text-xs font-bold uppercase text-text-muted">
                    {getUnitMeta(column.label).label}{column.required ? " *" : ""}
                  </span>
                ))}
              </div>
              {group.items.length ? (
                group.items.map(({ row, rowIndex }) => (
                  <div key={`${field.id}-${rowIndex}`} className="grid min-w-0 gap-2" style={{ gridTemplateColumns: getTableGridTemplate(columns) }}>
                    {columns.map((column) => (
                      isPriorityColumn(column) ? (
                        <PriorityToggle
                          key={column.id}
                          disabled={disabled}
                          value={row.cells[column.key]}
                          onChange={(nextValue) => {
                            const nextRows = rows.map((editableRow) => ({ ...editableRow, cells: { ...editableRow.cells } }));
                            nextRows[rowIndex] = {
                              ...nextRows[rowIndex],
                              cells: { ...nextRows[rowIndex].cells, [column.key]: nextValue },
                            };
                            onTableChange(nextRows);
                          }}
                        />
                      ) : isConfirmedColumn(column) ? (
                        <ConfirmedToggle
                          key={column.id}
                          disabled={disabled}
                          value={row.cells[column.key]}
                          onChange={(nextValue) => {
                            const nextRows = rows.map((editableRow) => ({ ...editableRow, cells: { ...editableRow.cells } }));
                            nextRows[rowIndex] = {
                              ...nextRows[rowIndex],
                              cells: { ...nextRows[rowIndex].cells, [column.key]: nextValue },
                            };
                            onTableChange(nextRows);
                          }}
                        />
                      ) : (
                        <TableCellInput
                          key={column.id}
                          column={column}
                          placeholder={getTableCellPlaceholder(row, column)}
                          value={unknownToInputValue(row.cells[column.key])}
                          disabled={disabled || (isVendorListTable(field) && !isOtherCategory(group.category) && column.key === "col_2_componente")}
                          className={isVendorListTable(field) && column.key === "col_3_marche_di_riferimento" ? "placeholder:opacity-40" : undefined}
                          onChange={(event) => {
                            const nextRows = rows.map((editableRow) => ({ ...editableRow, cells: { ...editableRow.cells } }));
                            nextRows[rowIndex] = {
                              ...nextRows[rowIndex],
                              cells: { ...nextRows[rowIndex].cells, [column.key]: event.target.value },
                            };
                            onTableChange(nextRows);
                          }}
                        />
                      )
                    ))}
                  </div>
                ))
              ) : (
                <p className="rounded-[var(--radius-md)] border border-dashed border-border-default px-3 py-2 text-sm text-text-muted">
                  {t("commissions.fieldsPending")}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
      {isVendorEditorOpen ? <VendorListEditorDialog onClose={() => setIsVendorEditorOpen(false)} /> : null}
    </div>
  );
}

interface VendorListCategoryDraft {
  name: string;
  note: string;
  items: Array<{ component: string; brands: string }>;
}

function VendorListEditorDialog({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<VendorListCategoryDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/commission-intake/vendor-list", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { vendorList?: { categories?: VendorListCategoryDraft[]; isCustomized?: boolean }; message?: string };
      if (!response.ok || !payload.vendorList?.categories) throw new Error(payload.message ?? "Impossibile caricare la Vendor List.");
      setCategories(payload.vendorList.categories);
      setIsCustomized(payload.vendorList.isCustomized === true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare la Vendor List.");
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [onClose]);

  useEffect(() => { void load(); }, [load]);

  const updateCategory = (index: number, patch: Partial<VendorListCategoryDraft>) => setCategories((current) => current.map((category, currentIndex) => currentIndex === index ? { ...category, ...patch } : category));
  const updateItem = (categoryIndex: number, itemIndex: number, patch: Partial<VendorListCategoryDraft["items"][number]>) => setCategories((current) => current.map((category, currentIndex) => currentIndex === categoryIndex ? { ...category, items: category.items.map((item, currentItemIndex) => currentItemIndex === itemIndex ? { ...item, ...patch } : item) } : category));
  const moveCategory = (index: number, direction: -1 | 1) => setCategories((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const save = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/commission-intake/vendor-list", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories }) });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Impossibile salvare la Vendor List.");
      toast.success("Vendor List aggiornata per le nuove checklist.");
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossibile salvare la Vendor List."); }
    finally { setIsSaving(false); }
  };
  const reset = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/commission-intake/vendor-list", { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { vendorList?: { categories?: VendorListCategoryDraft[] }; message?: string };
      if (!response.ok || !payload.vendorList?.categories) throw new Error(payload.message ?? "Impossibile ripristinare la Vendor List.");
      setCategories(payload.vendorList.categories); setIsCustomized(false);
      toast.success("Ripristinata la Vendor List standard.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossibile ripristinare la Vendor List."); }
    finally { setIsSaving(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-labelledby="vendor-list-editor-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}>
    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border-default bg-bg-surface shadow-elevated">
      <header className="flex items-start gap-3 border-b border-border-default px-5 py-4"><BirgusLogo className="h-9 w-9 shrink-0" /><div className="min-w-0 flex-1"><h2 id="vendor-list-editor-title" className="text-base font-bold text-text-primary">Birgus dice:</h2><p className="mt-1 text-sm text-text-secondary">Modifica Vendor List</p><p className="mt-1 text-xs text-text-muted">Le modifiche saranno usate dalle nuove checklist; quelle esistenti mantengono la loro lista.</p></div><Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 px-0" title="Chiudi" disabled={isSaving} onClick={onClose}><X size={16} /></Button></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
        {isLoading ? <p className="text-sm text-text-muted">Caricamento Vendor List...</p> : categories.map((category, categoryIndex) => <section key={`${categoryIndex}-${category.name}`} className="rounded-[var(--radius-md)] border border-border-default bg-bg-page p-3"><div className="flex flex-col gap-2 md:flex-row md:items-center"><Input value={category.name} onChange={(event) => updateCategory(categoryIndex, { name: event.target.value })} placeholder="Nome categoria" /><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" title="Sposta su" disabled={categoryIndex === 0 || isSaving} onClick={() => moveCategory(categoryIndex, -1)}><ChevronUp size={16} /></Button><Button size="sm" variant="outline" title="Sposta giù" disabled={categoryIndex === categories.length - 1 || isSaving} onClick={() => moveCategory(categoryIndex, 1)}><ChevronDown size={16} /></Button><Button size="sm" variant="danger" title="Elimina categoria" disabled={isSaving} onClick={() => setCategories((current) => current.filter((_, index) => index !== categoryIndex))}><Trash2 size={16} /></Button></div></div><textarea value={category.note} onChange={(event) => updateCategory(categoryIndex, { note: event.target.value })} placeholder="Nota categoria (facoltativa)" className="mt-2 min-h-20 w-full resize-y rounded-[var(--radius-md)] border border-border-default bg-bg-surface p-3 text-sm text-text-secondary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary" />
          <div className="mt-3 space-y-2">{category.items.map((item, itemIndex) => <div key={`${categoryIndex}-${itemIndex}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Input value={item.component} onChange={(event) => updateItem(categoryIndex, itemIndex, { component: event.target.value })} placeholder="Componente" /><Input value={item.brands} onChange={(event) => updateItem(categoryIndex, itemIndex, { brands: event.target.value })} placeholder="Marche di riferimento" /><Button size="sm" variant="danger" title="Elimina voce" disabled={isSaving} onClick={() => updateCategory(categoryIndex, { items: category.items.filter((_, index) => index !== itemIndex) })}><Trash2 size={16} /></Button></div>)}</div><Button className="mt-3" size="sm" variant="outline" disabled={isSaving} onClick={() => updateCategory(categoryIndex, { items: [...category.items, { component: "", brands: "" }] })}><Plus size={14} />Aggiungi voce</Button></section>)}
        {!isLoading ? <Button variant="outline" disabled={isSaving} onClick={() => setCategories((current) => [...current, { name: "Nuova categoria", note: "", items: [] }])}><Plus size={16} />Aggiungi categoria</Button> : null}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-border-default px-5 py-4"><Button variant="outline" disabled={isSaving} onClick={onClose}>Chiudi</Button>{isCustomized ? <Button variant="outline" disabled={isSaving} onClick={() => void reset()}>Ripristina standard</Button> : null}<Button disabled={isLoading || isSaving || !categories.length} onClick={() => void save()}>{isSaving ? "Salvataggio..." : "Salva Vendor List"}</Button></footer>
    </div>
  </div>;
}

function ensureOtherGroup(groups: ReturnType<typeof groupChecklistRows>): ReturnType<typeof groupChecklistRows> {
  if (groups.some((group) => isOtherCategory(group.category))) return groups;
  return [...groups, { category: "Altro", note: "", items: [] }];
}

function findLastOtherRowIndex(rows: EditableTableRow[]): number {
  for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
    if (isOtherCategory(unknownToInputValue(rows[rowIndex].cells.col_1_categoria))) return rowIndex;
  }
  return -1;
}

function isOtherCategory(category: string): boolean {
  return category.trim().toLowerCase() === "altro";
}

function buildOtherTableRowCells(field: CommissionFormField): Record<string, unknown> {
  const cells: Record<string, unknown> = { col_1_categoria: "Altro" };
  for (const column of field.table?.columns ?? []) {
    if (column.key === "col_1_categoria") continue;
    cells[column.key] = isPriorityColumn(column) ? "Bassa" : "";
  }
  return cells;
}

function getTableCellPlaceholder(row: EditableTableRow, column: CommissionTableColumn): string | undefined {
  const rowPlaceholder = row.cells[`_placeholder_${column.key}`];
  const placeholder = typeof rowPlaceholder === "string" && rowPlaceholder.trim().length > 0
    ? rowPlaceholder
    : column.placeholder;
  return placeholder ?? undefined;
}

function getAttachmentToggleFields(page: CommissionFormPage): CommissionFormField[] {
  if (!isDocumentationAttachmentsPage(page)) return [];
  return page.sections
    .flatMap((section) => section.fields)
    .filter((field) => isDocumentUploadSlotField(field));
}

function isDocumentationAttachmentsPage(page: CommissionFormPage): boolean {
  const normalized = normalizeLoose(page.title);
  return normalized.includes("documentazione") && normalized.includes("allegati");
}

function isDocumentUploadSlotField(field: CommissionFormField): boolean {
  return field.fieldType !== "TABLE" && field.fieldType !== "SIGNATURE";
}

function isYesNoOptionSet(field: CommissionFormField): boolean {
  const optionValues = field.options.map((option) => normalizeLoose(option.label || option.value));
  return optionValues.some((value) => value === "si" || value.startsWith("siquantita")) && optionValues.includes("no");
}

function selectedChoiceValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  if (value && typeof value === "object" && typeof (value as { selection?: unknown }).selection === "string") return (value as { selection: string }).selection;
  return typeof value === "string" ? value : "";
}

function quantityValue(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const quantity = (value as { quantity?: unknown }).quantity;
    return typeof quantity === "string" || typeof quantity === "number" ? String(quantity) : "";
  }
  return "";
}

function isQuantityChoice(value: string): boolean {
  return normalizeLoose(value).includes("quantita");
}

function isAffirmativeValue(value: unknown): boolean {
  if (value === true) return true;
  if (Array.isArray(value)) return value.some((item) => normalizeLoose(String(item)) === "si" || normalizeLoose(String(item)) === "yes");
  const normalized = normalizeLoose(unknownToInputValue(value));
  return normalized === "si" || normalized === "yes" || normalized === "true";
}

function formatFileSize(value: string | null): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function getCompletionIssues(
  page: CommissionFormPage,
  fieldValues: Record<string, unknown>,
  tableValues: Record<string, EditableTableRow[]>,
  attachments: CommissionAttachment[],
): CompletionIssue[] {
  const issues: CompletionIssue[] = [];
  for (const section of page.sections) {
    for (const field of section.fields) {
      if (field.fieldType === "SIGNATURE") continue;
      if (field.fieldType === "TABLE" && field.table) {
        addTableCompletionIssues(issues, page, section, field, tableValues[field.table.id] ?? buildDefaultEditableRows(field.table.defaultRows));
        continue;
      }

      if (isDocumentationAttachmentsPage(page) && isDocumentUploadSlotField(field)) {
        const hasAttachment = attachments.some((attachment) => attachment.fieldKey === field.key);
        if (!hasAttachment) {
          issues.push({ pageNumber: page.pageNumber, sectionTitle: section.title, label: `Allegato: ${getUnitMeta(field.label).label}` });
        }
        continue;
      }

      if (isQuantityChoice(selectedChoiceValue(fieldValues[field.id])) && !hasFieldValue(quantityValue(fieldValues[field.id]))) {
        issues.push({ pageNumber: page.pageNumber, sectionTitle: section.title, label: `${getUnitMeta(field.label).label}: quantità` });
        continue;
      }
      if (!hasFieldValue(fieldValues[field.id]) && !isIgnorableEmptyField(field)) {
        issues.push({ pageNumber: page.pageNumber, sectionTitle: section.title, label: getUnitMeta(field.label).label });
      }
    }
  }
  return issues;
}

function addTableCompletionIssues(
  issues: CompletionIssue[],
  page: CommissionFormPage,
  section: CommissionFormSection,
  field: CommissionFormField,
  rows: EditableTableRow[],
): void {
  if (!field.table) return;
  for (const [rowIndex, row] of rows.entries()) {
    if (isOtherCategory(unknownToInputValue(row.cells.col_1_categoria)) && !hasWrittenTableRowContent(row, field.table.columns)) {
      continue;
    }

    for (const column of field.table.columns) {
      if (column.key === "col_1_categoria" || isPriorityColumn(column) || isConfirmedColumn(column) || isManualAutomaticColumn(column.label) || isIgnorableTableColumn(column)) {
        continue;
      }
      if (!hasFieldValue(row.cells[column.key])) {
        issues.push({
          pageNumber: page.pageNumber,
          sectionTitle: section.title,
          label: `${field.label} - riga ${rowIndex + 1}: ${getUnitMeta(column.label).label}`,
        });
      }
    }
  }
}

function isIgnorableEmptyField(field: CommissionFormField): boolean {
  return normalizeLoose(field.label) === "altro";
}

function isIgnorableTableColumn(column: CommissionTableColumn): boolean {
  const normalized = normalizeLoose(column.label);
  return normalized === "note" || normalized.includes("marchediriferimento");
}

function getTableGridTemplate(columns: CommissionTableColumn[]): string {
  if (!columns.length) return "minmax(0, 1fr)";
  return columns.map((column) => {
    const normalized = column.label.toLowerCase();
    if (normalized === "n" || normalized.includes("confermato") || isPriorityColumn(column)) return "minmax(92px, 0.45fr)";
    if (isManualAutomaticColumn(column.label)) return "minmax(150px, 0.85fr)";
    if (normalized.includes("tempo") || normalized.includes("peso") || normalized.includes("%")) return "minmax(96px, 0.7fr)";
    return "minmax(0, 1fr)";
  }).join(" ");
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function hasWrittenTableRowContent(row: EditableTableRow, columns: CommissionTableColumn[]): boolean {
  return columns.some((column) => {
    if (isManualAutomaticColumn(column.label)) return false;
    const value = row.cells[column.key];
    return value !== null && typeof value !== "undefined" && String(value).trim().length > 0;
  });
}

function getPageCompletionStats(
  page: CommissionFormPage,
  fieldValues: Record<string, unknown>,
  tableValues: Record<string, EditableTableRow[]>,
  attachments: CommissionAttachment[],
): { total: number; completed: number } {
  let total = 0;
  let completed = 0;

  for (const field of page.sections.flatMap((section) => section.fields)) {
    if (field.fieldType === "SIGNATURE") continue;
    total += 1;

    if (isDocumentationAttachmentsPage(page) && isDocumentUploadSlotField(field)) {
      if (attachments.some((attachment) => attachment.fieldKey === field.key)) completed += 1;
      continue;
    }

    if (field.fieldType === "TABLE" && field.table) {
      const rows = tableValues[field.table.id] ?? buildDefaultEditableRows(field.table.defaultRows);
      if (rows.some((row) => hasWrittenTableRowContent(row, field.table?.columns ?? []))) completed += 1;
      continue;
    }

    if (hasFieldValue(fieldValues[field.id])) completed += 1;
  }

  return { total, completed };
}

function hasFieldValue(value: unknown): boolean {
  if (value === null || typeof value === "undefined") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "object") return Object.values(value).some((item) => hasFieldValue(item));
  return String(value).trim().length > 0;
}

const COMMISSION_FIELD_LAYOUT_BY_KEY: Record<string, string> = {
  // Esempio: p02_f001_cadenza_produttiva_attuale_pz_h_pz_turno: "sm:max-w-xs",
};

function extractDirectUnit(label: string): { label: string; unit: string | null } | null {
  const trimmed = label.trim();
  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex <= 0) return null;

  const unit = trimmed.slice(colonIndex + 1).trim();
  const knownUnits = ["+/- mm", "x mm", "pz/minuto", "pz/turno", "pz/h", "Nl/min", "kg/m2", "mm", "cm", "metri", "m", "kg", "%", "bar", "mbar", "kW", "N", "ms", "mesi", "lux", "C", "°C"];
  if (!knownUnits.some((knownUnit) => unit.toLowerCase() === knownUnit.toLowerCase())) {
    return null;
  }

  return { label: trimmed.slice(0, colonIndex).trim(), unit };
}

function getUnitMeta(label: string): { label: string; unit: string | null } {
  const directUnit = extractDirectUnit(label);
  if (directUnit) return directUnit;
  const colonMatch = label.match(/^(.*?):\s*([A-Za-zÀ-ÿ0-9/%^.\- ]{1,18})$/);
  if (colonMatch && looksLikeUnit(colonMatch[2])) {
    return { label: colonMatch[1].trim(), unit: colonMatch[2].trim() };
  }

  const parenMatch = label.match(/^(.*?)\s*\(([^)]{1,40})\)$/);
  if (parenMatch) {
    const content = parenMatch[2].trim();
    const split = content.match(/^(.*\b)(mm|cm|metri|m|kg|kg\/m2|pz\/h|pz\/turno|%|bar|mbar|Nl\/min|kW|mesi)$/i);
    if (split) {
      const context = split[1].trim();
      const unit = split[2].trim();
      return {
        label: context ? `${parenMatch[1].trim()} (${context})` : parenMatch[1].trim(),
        unit,
      };
    }
  }

  return { label, unit: null };
}

function looksLikeUnit(value: string): boolean {
  return /^(%|mm|cm|m|metri|kg|kg\/m2|bar|mbar|nl\/min|kw|mesi|ore|min|lux)$/i.test(value.trim());
}

function getFieldLayoutClass(field: CommissionFormField): string {
  const explicitClass = COMMISSION_FIELD_LAYOUT_BY_KEY[field.key];
  if (explicitClass) return explicitClass;
  if (field.fieldType === "LONG_TEXT") return "xl:col-span-2";
  return "";
}

function buildTableState(rows: CommissionTableRow[]): Record<string, EditableTableRow[]> {
  const result: Record<string, EditableTableRow[]> = {};
  for (const row of rows) {
    result[row.tableDefinitionId] = [
      ...(result[row.tableDefinitionId] ?? []),
      {
        rowKey: row.rowKey,
        cells: Object.fromEntries(row.cells.map((cell) => [cell.columnKey, cell.value])),
      },
    ];
  }
  return result;
}

function buildDefaultEditableRows(rows: Array<Record<string, unknown>>): EditableTableRow[] {
  return rows.map((cells) => ({ rowKey: null, cells }));
}

function unknownToInputValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
