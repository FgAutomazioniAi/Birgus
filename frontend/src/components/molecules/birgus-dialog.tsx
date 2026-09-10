"use client";

import { X } from "lucide-react";

import { Button } from "@/components/atoms";
import { BirgusLogo } from "./birgus-logo";

interface BirgusDialogProps {
  confirmLabel?: string;
  message: string;
  onCancel: () => void;
  onConfirm?: () => void;
  open: boolean;
}

export function BirgusDialog({ confirmLabel = "Conferma", message, onCancel, onConfirm, open }: BirgusDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay p-4" role="dialog" aria-modal="true" aria-label="Birgus dice" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="w-full max-w-md border border-border-default bg-bg-surface p-5 shadow-elevated">
        <div className="flex items-start gap-3"><BirgusLogo className="h-9 w-9 shrink-0" /><div className="min-w-0 flex-1"><h2 className="text-base font-bold text-text-primary">Birgus dice:</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{message}</p></div><Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 px-0" title="Chiudi" onClick={onCancel}><X size={16} /></Button></div>
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{onConfirm ? "Annulla" : "Chiudi"}</Button>{onConfirm ? <Button type="button" variant="danger" onClick={onConfirm}>{confirmLabel}</Button> : null}</div>
      </div>
    </div>
  );
}
