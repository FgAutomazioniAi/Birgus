"use client";

import { useEffect, useState } from "react";

import { Button, Input } from "@/components/atoms";

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
  confirmLabel = "Elimina",
  expectedText,
  isBusy = false,
  onCancel,
  onConfirm,
  open,
  title = "Conferma Eliminazione",
}: ConfirmDeleteDialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[var(--radius-xl)] border border-border-default bg-bg-surface p-5 shadow-elevated">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-primary">{title}</h3>
        <p className="mt-1 text-xs text-text-muted">Sei sicuro di voler cancellare questo elemento?</p>
        <p className="mt-3 text-xs text-text-secondary">
          Digita esattamente: <span className="font-mono font-semibold">{expectedText}</span>
        </p>

        <div className="mt-3">
          <Input
            value={typedText}
            onChange={(event) => setTypedText(event.target.value)}
            placeholder="Inserisci il testo di conferma"
            disabled={isBusy}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isBusy}>
            Annulla
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void onConfirm(typedText.trim())}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
