"use client";

import { ClipboardList, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button, Card, Input, Text } from "@/components/atoms";
import { useLanguage } from "@/components/organisms/language-provider";
import { APP_ROUTES } from "@/lib/routes";

interface ChecklistRecord {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  clientDisplayName: string | null;
  companyName: string | null;
  currentChecklistId: string | null;
  updatedAt: string;
}

export function DataCollectionChecklistPanel() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<ChecklistRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.code, record.title, record.description, record.clientDisplayName, record.companyName, record.status]
        .some((value) => (value ?? "").toLowerCase().includes(query)),
    );
  }, [records, search]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/commission-intake/checklists", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as { records?: ChecklistRecord[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? t("checklists.loadFailed"));
      }
      setRecords(payload.records ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("checklists.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Text as="h1" variant="h1">{t("checklists.title")}</Text>
        </div>
        <Button variant="outline" onClick={() => void loadRecords()} disabled={isLoading}>
          <RefreshCw size={16} />
          {t("commissions.refresh")}
        </Button>
      </header>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("checklists.searchPlaceholder")} className="pl-9" />
        </div>
      </Card>

      <div className="overflow-x-auto rounded-md border border-border-default bg-bg-surface">
        <div className="grid min-w-[940px] grid-cols-[1fr_1.5fr_1.3fr_2fr_0.8fr_auto] gap-3 border-b border-border-subtle px-4 py-3 text-xs font-bold uppercase text-text-muted">
          <span>{t("commissions.code")}</span>
          <span>{t("checklists.commission")}</span>
          <span>{t("checklists.customer")}</span>
          <span>{t("checklists.projectDescription")}</span>
          <span>{t("commissions.status")}</span>
          <span>{t("archive.actions")}</span>
        </div>
        {isLoading ? (
          <div className="px-4 py-8 text-sm text-text-muted">{t("commissions.loading")}</div>
        ) : filteredRecords.length ? (
          filteredRecords.map((record) => (
            <div key={record.id} className="grid min-w-[940px] grid-cols-[1fr_1.5fr_1.3fr_2fr_0.8fr_auto] gap-3 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0">
              <span className="font-mono text-xs text-text-secondary">{record.code}</span>
              <span className="font-semibold text-text-primary">{record.title}</span>
              <span className="text-text-secondary">{record.clientDisplayName ?? record.companyName ?? "-"}</span>
              <span className="line-clamp-2 text-text-secondary">{record.description ?? "-"}</span>
              <span>{record.status}</span>
              <Link href={APP_ROUTES.dataCollectionChecklist(record.id)} className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] bg-brand-primary px-3 text-xs font-bold text-text-inverse transition-colors hover:bg-brand-primary-hover">
                {t("checklists.openForm")}
              </Link>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-text-muted">
            <ClipboardList size={22} />
            {t("checklists.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
