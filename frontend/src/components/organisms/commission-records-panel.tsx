"use client";

import { ClipboardList, Plus, RefreshCw, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { useLanguage } from "@/components/organisms/language-provider";
import { APP_ROUTES } from "@/lib/routes";

interface CommissionRecord {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  clientDisplayName: string | null;
  companyName: string | null;
  currentChecklistId: string | null;
  expectedDeliveryAt: string | null;
  estimatedBudgetAmount: string | null;
  currency: string | null;
  updatedAt: string;
}

export function CommissionRecordsPanel() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [jobName, setJobName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.title, record.description, record.clientDisplayName, record.companyName, record.status, record.priority]
        .some((value) => (value ?? "").toLowerCase().includes(query)),
    );
  }, [records, search]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/commission-intake/records", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { records?: CommissionRecord[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("commissions.loadFailed"));
      }
      setRecords(payload.records ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const response = await fetch("/api/commission-intake/records", { cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as { records?: CommissionRecord[]; message?: string };
        if (!response.ok) {
          throw new Error(payload.message ?? t("commissions.loadFailed"));
        }
        if (isMounted) {
          setRecords(payload.records ?? []);
        }
      } catch (error) {
        if (isMounted) {
          toast.error(error instanceof Error ? error.message : t("commissions.loadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const createRecord = async () => {
    const normalizedCompanyName = companyName.trim();
    const normalizedJobName = jobName.trim();
    const normalizedJobDescription = jobDescription.trim();
    if (normalizedCompanyName.length < 2) {
      toast.error(t("commissions.companyNameTooShort"));
      return;
    }
    if (normalizedJobName.length < 2) {
      toast.error(t("commissions.jobNameTooShort"));
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/commission-intake/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: normalizedCompanyName,
          title: normalizedJobName,
          description: normalizedJobDescription || null,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { record?: CommissionRecord; message?: string };
      if (!response.ok || !payload.record) {
        throw new Error(payload.message ?? t("commissions.createFailed"));
      }
      setRecords((current) => [payload.record as CommissionRecord, ...current]);
      setCompanyName("");
      setJobName("");
      setJobDescription("");
      setIsCreateDialogOpen(false);
      toast.success(t("commissions.createSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("commissions.createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Text as="h1" variant="h1">{t("commissions.registryTitle")}</Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadRecords()} disabled={isLoading}>
            <RefreshCw size={16} />
            {t("commissions.refresh")}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} disabled={isCreating}>
            <Plus size={16} />
            {t("commissions.create")}
          </Button>
        </div>
      </header>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("commissions.searchPlaceholder")} className="pl-9" />
        </div>
      </Card>

      <div className="overflow-x-auto rounded-md border border-border-default bg-bg-surface">
        <div className="grid min-w-[860px] grid-cols-[1.5fr_1.2fr_2fr_0.9fr_0.9fr_auto] gap-3 border-b border-border-subtle px-4 py-3 text-xs font-bold uppercase text-text-muted">
          <span>{t("commissions.recordTitle")}</span>
          <span>{t("commissions.customer")}</span>
          <span>{t("commissions.projectDescription")}</span>
          <span>{t("commissions.status")}</span>
          <span>{t("commissions.priority")}</span>
          <span>{t("archive.actions")}</span>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-sm text-text-muted">{t("commissions.loading")}</div>
        ) : filteredRecords.length ? (
          filteredRecords.map((record) => (
            <div key={record.id} className="grid min-w-[860px] grid-cols-[1.5fr_1.2fr_2fr_0.9fr_0.9fr_auto] gap-3 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0">
              <span className="font-semibold text-text-primary">{record.title}</span>
              <span className="text-text-secondary">{record.clientDisplayName ?? record.companyName ?? "-"}</span>
              <span className="line-clamp-2 text-text-secondary">{record.description ?? "-"}</span>
              <span>{record.status}</span>
              <span>{record.priority}</span>
              <Link href={APP_ROUTES.dataCollectionChecklist(record.id)} className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-border-default bg-bg-page px-3 text-xs font-bold text-text-secondary transition-colors hover:bg-bg-subtle">
                {t("checklists.openForm")}
              </Link>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-text-muted">
            <ClipboardList size={22} />
            {t("commissions.empty")}
          </div>
        )}
      </div>
      {isCreateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" onMouseDown={() => setIsCreateDialogOpen(false)}>
          <Card className="w-full max-w-lg p-0 shadow-elevated" onMouseDown={(event) => event.stopPropagation()}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createRecord();
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle p-4">
                <h2 className="text-lg font-bold text-text-primary">{t("commissions.createDialogTitle")}</h2>
                <button
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-text-muted transition-colors hover:bg-bg-muted hover:text-text-primary"
                  aria-label={t("common.close")}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-text-primary">{t("commissions.companyName")}</span>
                  <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoFocus />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-text-primary">{t("commissions.jobName")}</span>
                  <Input value={jobName} onChange={(event) => setJobName(event.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-text-primary">{t("commissions.jobDescription")}</span>
                  <textarea
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    className="min-h-28 w-full rounded-[var(--radius-md)] border border-border-default bg-bg-muted px-4 py-3 text-sm text-text-secondary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-border-subtle p-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isCreating}>
                  <Plus size={16} />
                  {t("commissions.create")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
