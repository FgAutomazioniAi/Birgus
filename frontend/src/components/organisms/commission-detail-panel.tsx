"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Lock, Paperclip, Plus, RefreshCw, Save, Signature, Trash2 } from "lucide-react";
import Link from "next/link";
import type { InputHTMLAttributes } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Checkbox, CheckboxControl, Input, Text } from "@/components/atoms";
import { SelectDropdown } from "@/components/molecules";
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
  const [isChapterSwitcherPinned, setIsChapterSwitcherPinned] = useState(false);
  const chapterSwitcherSentinelRef = useRef<HTMLDivElement | null>(null);

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
    const sentinel = chapterSwitcherSentinelRef.current;
    if (!sentinel) return;

    const scrollContainer = findScrollParent(sentinel);
    const updatePinnedState = () => {
      const sentinelRect = sentinel.getBoundingClientRect();
      const containerRect = scrollContainer === window
        ? { top: 0 }
        : (scrollContainer as HTMLElement).getBoundingClientRect();
      setIsChapterSwitcherPinned(sentinelRect.top < containerRect.top + 8);
    };

    updatePinnedState();
    scrollContainer.addEventListener("scroll", updatePinnedState, { passive: true });
    window.addEventListener("resize", updatePinnedState);
    return () => {
      scrollContainer.removeEventListener("scroll", updatePinnedState);
      window.removeEventListener("resize", updatePinnedState);
    };
  }, [view?.pages.length]);

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
    if (!view?.checklist || !activePage) return false;

    const fields = activePage.sections.flatMap((section) => section.fields);
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
        setCompletionIssues(getCompletionIssues(activePage, fieldValues, tableValues, view.attachments));
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
    const confirmed = window.confirm(t("commissions.deleteAttachmentConfirm"));
    if (!confirmed) return;
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

  const signChecklist = async () => {
    if (!view?.checklist) return;
    if (signatureName.trim().length < 2) {
      toast.error(t("commissions.signerRequired"));
      return;
    }
    if (activePage) {
      const saved = await savePage({ silent: true });
      if (!saved) return;
    }

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
      {view.pages.length && isChapterSwitcherPinned ? (
        <div className="fixed left-1/2 top-20 z-50 w-[min(64rem,calc(100vw-7rem))] -translate-x-1/2 rounded-[var(--radius-md)] border border-border-default bg-bg-surface/95 p-2 shadow-elevated backdrop-blur">
          <ChapterSwitcher
            activePageId={activePage?.id ?? null}
            compact
            pages={view.pages}
            onSelectPage={setActivePageId}
          />
        </div>
      ) : null}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link href={APP_ROUTES.dataCollectionChecklists} className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-0 text-sm font-bold text-text-secondary transition-colors hover:text-text-primary">
            <ArrowLeft size={16} />
            {t("commissions.back")}
          </Link>
          <div>
            <Text as="h1" variant="h1">{view.record.title}</Text>
            <p className="mt-1 text-sm text-text-muted">{view.record.code} - {view.record.status}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadView()} disabled={isLoading}>
            <RefreshCw size={16} />
            {t("commissions.refresh")}
          </Button>
          <Link href={APP_ROUTES.dataCollectionChecklists} className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-border-default bg-bg-page px-4 text-sm font-bold text-text-secondary transition-colors hover:bg-bg-subtle">
            {t("checklists.list")}
          </Link>
        </div>
      </header>

      {readOnlyReason ? (
        <Card className="flex items-center gap-3 border-status-warning-bg bg-status-warning-bg/15 p-4 text-sm text-status-warning-text">
          <Lock size={18} />
          <span>{readOnlyReason}</span>
        </Card>
      ) : null}

      {isFinalized ? (
        <Card className="flex items-center gap-3 border-status-success-border bg-status-success-bg/30 p-4 text-sm text-status-success-text">
          <CheckCircle2 size={18} />
          <span>{t("commissions.finalizedReadOnly")}</span>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0 space-y-5">
          {view.pages.length ? (
            <>
            <div ref={chapterSwitcherSentinelRef} className="h-px" aria-hidden="true" />
            <Card
              className="overflow-visible p-4"
              aria-label={t("commissions.chapters")}
            >
              <ChapterSwitcher
                activePageId={activePage?.id ?? null}
                pages={view.pages}
                showLine
                onSelectPage={setActivePageId}
              />
            </Card>
            </>
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
                              field={field}
                              showInlineAttachment={isDocumentationPage && isDocumentUploadSlotField(field)}
                              uploadingFieldKey={uploadingFieldKey}
                              value={fieldValues[field.id] ?? null}
                              tableRows={tableId ? tableValues[tableId] ?? [] : []}
                              onDeleteAttachment={(attachmentId) => void deleteAttachment(attachmentId)}
                              onUploadAttachments={(targetField, files) => void uploadAttachments(targetField, files)}
                              onValueChange={(value) => setFieldValues((current) => ({ ...current, [field.id]: value }))}
                              onTableChange={(rows) => {
                                if (!tableId) return;
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
                {t("commissions.savePage")}
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
                onChange={(event) => setSignatureStatement(event.target.value)}
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
    </div>
  );
}

function FieldEditor({
  attachments = [],
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
      if (hasWrittenTableRowContent(lastRow, field.table?.columns ?? [])) {
        const confirmed = window.confirm(t("commissions.deleteLastWrittenRowConfirm"));
        if (!confirmed) return;
      }
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
        {isGroupedTable ? (
          <GroupedChecklistTable disabled={disabled} field={field} onTableChange={onTableChange} rows={rowsForEdit} />
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
                      disabled={disabled}
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

function findScrollParent(element: HTMLElement): HTMLElement | Window {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(`${style.overflowY}${style.overflow}`)) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
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
                  fieldAttachments.length ? "text-status-success-text" : "text-status-warning-text",
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

  if ((field.fieldType === "MULTI_SELECT" || field.fieldType === "CHECKBOX_GROUP" || field.fieldType === "DOCUMENT_CHECKLIST") && isYesNoOptionSet(field)) {
    const selectedValues = Array.isArray(value) ? value.map(String) : [];
    return (
      <SelectDropdown
        allowEmpty
        disabled={disabled}
        value={selectedValues[0] ?? ""}
        placeholder="Seleziona"
        onChange={(nextValue) => onValueChange(nextValue ? [nextValue] : [])}
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
          ? "border-status-success-border bg-status-success-bg text-status-success-text"
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
          ? "border-status-danger-border bg-status-danger-bg text-status-danger-text"
          : current === "Media"
            ? "border-status-warning-bg bg-status-warning-bg/20 text-status-warning-text"
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

function groupChecklistRows(rows: EditableTableRow[]): Array<{ category: string; items: Array<{ row: EditableTableRow; rowIndex: number }> }> {
  const groups = new Map<string, Array<{ row: EditableTableRow; rowIndex: number }>>();
  rows.forEach((row, rowIndex) => {
    const category = unknownToInputValue(row.cells.col_1_categoria) || "Da classificare";
    groups.set(category, [...(groups.get(category) ?? []), { row, rowIndex }]);
  });
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

function GroupedChecklistTable({
  disabled,
  field,
  onTableChange,
  rows,
}: {
  disabled: boolean;
  field: CommissionFormField;
  onTableChange: (rows: EditableTableRow[]) => void;
  rows: EditableTableRow[];
}) {
  const { t } = useLanguage();
  const columns = getVisibleTableColumns(field);
  const groups = ensureOtherGroup(groupChecklistRows(rows));
  const addOtherRow = () => {
    onTableChange([...rows, { rowKey: null, cells: buildOtherTableRowCells(field) }]);
  };
  const deleteLastOtherRow = () => {
    const lastOtherIndex = findLastOtherRowIndex(rows);
    if (lastOtherIndex < 0) return;
    const lastRow = rows[lastOtherIndex];
    if (hasWrittenTableRowContent(lastRow, field.table?.columns ?? [])) {
      const confirmed = window.confirm(t("commissions.deleteLastWrittenRowConfirm"));
      if (!confirmed) return;
    }
    onTableChange(rows.filter((_, rowIndex) => rowIndex !== lastOtherIndex));
  };

  return (
    <div className="min-w-0 space-y-4">
      {groups.map((group) => (
        <div key={group.category} className="min-w-0 overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted/50 px-3 py-2">
            <span className="text-xs font-bold uppercase text-brand-primary">{group.category}</span>
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
                          disabled={disabled}
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
    </div>
  );
}

function ensureOtherGroup(groups: ReturnType<typeof groupChecklistRows>): ReturnType<typeof groupChecklistRows> {
  if (groups.some((group) => isOtherCategory(group.category))) return groups;
  return [...groups, { category: "Altro", items: [] }];
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
  return optionValues.includes("si") && optionValues.includes("no");
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
