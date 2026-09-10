"use client";

import { useEffect, useState } from "react";

import { Button, Input } from "@/components/atoms";
import { useLanguage } from "@/components/organisms/language-provider";
import { BirgusLogo } from "./birgus-logo";

interface ConfirmDeleteDialogProps {
  confirmLabel?: string;
  expectedText: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: (typedText: string) => Promise<void> | void;
  open: boolean;
  title?: string;
}

export function ConfirmDeleteDialog({
  confirmLabel,
  expectedText,
  isBusy = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDeleteDialogProps) {
  const { t } = useLanguage();
  const [typedText, setTypedText] = useState("");

  useEffect(() => {
    if (!open) {
      setTypedText("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const canConfirm = typedText.trim() === expectedText.trim() && !isBusy;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget && !isBusy) onCancel(); }}>
      <div className="w-full max-w-lg border border-border-default bg-bg-surface p-5 shadow-elevated">
        <div className="flex items-center gap-3"><BirgusLogo className="h-9 w-9 shrink-0" /><div><h3 className="text-base font-bold text-text-primary">Birgus dice:</h3><p className="text-sm font-semibold text-text-secondary">{title ?? t("common.confirmDelete")}</p></div></div>
        <p className="mt-1 text-xs text-text-muted">{t("common.confirmDeletePrompt")}</p>
        <p className="mt-3 text-xs text-text-secondary">
          {t("common.typeExactly")} <span className="font-mono font-semibold">{expectedText}</span>
        </p>

        <div className="mt-3">
          <Input
            value={typedText}
            onChange={(event) => setTypedText(event.target.value)}
            placeholder={t("common.confirmationText")}
            disabled={isBusy}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
            {t("auth.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void onConfirm(typedText.trim())}
            disabled={!canConfirm}
          >
            {confirmLabel ?? t("common.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
